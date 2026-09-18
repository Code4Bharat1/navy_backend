const Shop = require('../models/Shop');
const User = require('../models/User');
const Recharge = require('../models/Recharge');
const Transaction = require('../models/Transaction');
const Settlement = require('../models/Settlement');
const PlatformConfig = require('../models/PlatformConfig');
const AuditLog = require('../models/AuditLog');
const razorpayxService = require('./razorpayxService');

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Settles one shop's unsettled purchases since its last successful settlement (or since
 * the shop was created, for the first cycle) up to `cycleEnd`. Disputed/refunded purchases
 * are excluded by construction — only status:'completed' transactions are picked up, and a
 * disputed transaction is moved out of 'completed' the moment it's raised (see
 * transactionController.disputeTransaction), so it simply won't appear here until resolved.
 */
async function runSettlementForShop(shop, { actorId, cycleEnd = new Date() } = {}) {
  const config = await PlatformConfig.getSingleton();

  const lastPaid = await Settlement.findOne({ shop: shop._id, status: 'paid' }).sort({ cycleEnd: -1 });
  const cycleStart = lastPaid ? lastPaid.cycleEnd : shop.createdAt;

  // A transaction only becomes payable once it's cleared the dispute window — this is
  // what actually gives "disputed within 48h" its teeth; otherwise a purchase could be
  // settled and paid out to the shop before the customer even had a chance to dispute it.
  const disputeWindowMs = config.disputeWindowHours * 60 * 60 * 1000;
  const safeCycleEnd = new Date(Math.min(cycleEnd.getTime(), Date.now() - disputeWindowMs));

  if (safeCycleEnd <= cycleStart) {
    return { shopId: shop._id, shopName: shop.name, skipped: true, reason: 'nothing past the dispute window yet' };
  }

  const eligible = await Transaction.find({
    shop: shop._id,
    type: 'purchase',
    status: 'completed',
    settlement: { $exists: false },
    createdAt: { $gte: cycleStart, $lt: safeCycleEnd },
  });

  if (eligible.length === 0) {
    return { shopId: shop._id, shopName: shop.name, skipped: true, reason: 'nothing to settle' };
  }

  const grossAmount = round2(eligible.reduce((sum, t) => sum + t.amount, 0));
  const commission = round2(grossAmount * (config.commissionPercent / 100));
  const netPaid = round2(grossAmount - commission);

  const settlement = await Settlement.create({
    shop: shop._id,
    cycleStart,
    cycleEnd: safeCycleEnd,
    grossAmount,
    commission,
    netPaid,
    transactionCount: eligible.length,
    status: 'pending',
  });

  // Tag these transactions as claimed by this settlement so a concurrent/overlapping run
  // (or a retry) can't pick them up twice while this one is in flight.
  const transactionIds = eligible.map((t) => t._id);
  await Transaction.updateMany({ _id: { $in: transactionIds } }, { settlement: settlement._id });

  try {
    const { contactId, fundAccountId } = await razorpayxService.ensureFundAccount(shop);
    if (shop.razorpayContactId !== contactId || shop.razorpayFundAccountId !== fundAccountId) {
      shop.razorpayContactId = contactId;
      shop.razorpayFundAccountId = fundAccountId;
      await shop.save();
    }

    const payout = await razorpayxService.createPayout({
      fundAccountId,
      amount: netPaid,
      idempotencyKey: settlement._id.toString(),
      narration: `${shop.name} settlement ${cycleStart.toISOString().slice(0, 10)}_${cycleEnd.toISOString().slice(0, 10)}`,
    });

    settlement.status = 'paid';
    settlement.payoutRef = payout.id;
    settlement.payoutStatus = payout.status;
    await settlement.save();

    await Shop.updateOne({ _id: shop._id }, { $inc: { receivableBalance: -grossAmount } });

    await AuditLog.create({
      actor: actorId,
      action: 'SETTLEMENT_PAID',
      meta: { shopId: shop._id, settlementId: settlement._id, grossAmount, commission, netPaid, payoutRef: payout.id },
    });

    return { shopId: shop._id, shopName: shop.name, ...settlement.toObject() };
  } catch (err) {
    settlement.status = 'failed';
    settlement.failureReason = err.message;
    await settlement.save();
    // Release the transactions so the next run retries them instead of losing them.
    await Transaction.updateMany({ _id: { $in: transactionIds } }, { $unset: { settlement: 1 } });

    await AuditLog.create({
      actor: actorId,
      action: 'SETTLEMENT_FAILED',
      meta: { shopId: shop._id, settlementId: settlement._id, error: err.message },
    });

    return { shopId: shop._id, shopName: shop.name, ...settlement.toObject() };
  }
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
 * The invariant the whole platform's money-in/money-out should hold at all times:
 * everything ever recharged into the pooled account is accounted for by wallets that
 * still hold it, shops still owed for a sale, or shops already paid (net of commission).
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
