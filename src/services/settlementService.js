const mongoose = require('mongoose');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Recharge = require('../models/Recharge');
const Transaction = require('../models/Transaction');
const Settlement = require('../models/Settlement');
const PlatformConfig = require('../models/PlatformConfig');
const AuditLog = require('../models/AuditLog');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Settles one shop's unsettled purchases since its last settlement (or since the shop was
 * created, for the first cycle) up to `cycleEnd`. This platform has no payment gateway or
 * payout API — the admin pays the shop in cash (or however they choose) outside the system,
 * and this just records that it happened and clears the shop's receivable balance. Disputed/
 * refunded purchases are excluded by construction — only status:'completed' transactions are
 * picked up, and a disputed transaction is moved out of 'completed' the moment it's raised
 * (see transactionController.disputeTransaction), so it simply won't appear here until resolved.
 * Settlement is manual and admin-triggered (e.g. end of day) rather than on a fixed schedule,
 * so the admin's own timing is the protection window — there's no separate artificial delay
 * here holding back same-day sales.
 */
async function runSettlementForShop(shop, { actorId, cycleEnd = new Date() } = {}) {
  const config = await PlatformConfig.getSingleton();

  const lastPaid = await Settlement.findOne({ shop: shop._id, status: 'paid' }).sort({ cycleEnd: -1 });
  const cycleStart = lastPaid ? lastPaid.cycleEnd : shop.createdAt;

  const eligible = await Transaction.find({
    shop: shop._id,
    type: 'purchase',
    status: 'completed',
    settlement: { $exists: false },
    createdAt: { $gte: cycleStart, $lt: cycleEnd },
  });

  if (eligible.length === 0) {
    return { shopId: shop._id, shopName: shop.name, skipped: true, reason: 'nothing to settle' };
  }

  const grossAmount = round2(eligible.reduce((sum, t) => sum + t.amount, 0));
  const commission = round2(grossAmount * (config.commissionPercent / 100));
  const netPaid = round2(grossAmount - commission);
  const transactionIds = eligible.map((t) => t._id);

  const session = await mongoose.startSession();
  let settlement;
  try {
    await session.withTransaction(async () => {
      const [created] = await Settlement.create(
        [
          {
            shop: shop._id,
            cycleStart,
            cycleEnd,
            grossAmount,
            commission,
            netPaid,
            transactionCount: eligible.length,
            status: 'paid',
          },
        ],
        { session }
      );

      await Transaction.updateMany({ _id: { $in: transactionIds } }, { settlement: created._id }, { session });
      await Shop.updateOne({ _id: shop._id }, { $inc: { receivableBalance: -grossAmount } }, { session });

      await AuditLog.create(
        [
          {
            actor: actorId,
            action: 'SETTLEMENT_PAID',
            meta: { shopId: shop._id, settlementId: created._id, grossAmount, commission, netPaid },
          },
        ],
        { session }
      );

      settlement = created;
    });
  } finally {
    session.endSession();
  }

  return { shopId: shop._id, shopName: shop.name, ...settlement.toObject() };
}

async function runSettlementForAllShops({ actorId } = {}) {
  const shops = await Shop.find({ isActive: true });
  const results = [];
  for (const shop of shops) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runSettlementForShop(shop, { actorId }));
  }
  return results;
}

/**
 * The invariant the whole platform's points ledger should hold at all times: everything
 * ever recharged is accounted for by wallets that still hold it, shops still owed for a
 * sale, or shops already settled (net of commission).
 */
async function getLedgerIntegrity() {
  const [rechargeAgg] = await Recharge.aggregate([
    { $match: { status: 'success' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const [walletAgg] = await User.aggregate([
    { $match: { role: 'staff' } },
    { $group: { _id: null, total: { $sum: '$walletBalance' } } },
  ]);
  const [receivableAgg] = await Shop.aggregate([{ $group: { _id: null, total: { $sum: '$receivableBalance' } } }]);
  const [paidAgg] = await Settlement.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: null, netPaid: { $sum: '$netPaid' }, commission: { $sum: '$commission' } } },
  ]);

  const totalRecharged = round2(rechargeAgg?.total || 0);
  const totalWalletBalances = round2(walletAgg?.total || 0);
  const totalReceivables = round2(receivableAgg?.total || 0);
  const totalPaidOut = round2(paidAgg?.netPaid || 0);
  const totalCommission = round2(paidAgg?.commission || 0);

  const expected = round2(totalWalletBalances + totalReceivables + totalPaidOut + totalCommission);
  const discrepancy = round2(totalRecharged - expected);

  return {
    totalRecharged,
    totalWalletBalances,
    totalReceivables,
    totalPaidOut,
    totalCommission,
    discrepancy,
    healthy: Math.abs(discrepancy) < 0.01,
  };
}

module.exports = { runSettlementForShop, runSettlementForAllShops, getLedgerIntegrity };
