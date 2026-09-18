const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Transaction = require('../models/Transaction');
const Shop = require('../models/Shop');
const User = require('../models/User');
const PlatformConfig = require('../models/PlatformConfig');
const AuditLog = require('../models/AuditLog');
const walletService = require('../services/walletService');

/** Super Admin: search/browse all transactions platform-wide. */
const listTransactions = asyncHandler(async (req, res) => {
  const { shopId, staffCardUid, status } = req.query;
  const filter = {};
  if (shopId) filter.shop = shopId;
  if (status) filter.status = status;

  let query = Transaction.find(filter).sort({ createdAt: -1 }).limit(200);
  if (staffCardUid) {
    const staff = await User.findOne({ cardUid: staffCardUid, role: 'staff' });
    query = Transaction.find({ ...filter, staff: staff?._id || null }).sort({ createdAt: -1 }).limit(200);
  }

  const transactions = await query
    .populate('staff', 'name serviceNumber cardUid')
    .populate('shop', 'name')
    .populate('operator', 'name');

  res.json({ transactions });
});

/** Super Admin or the shop that made the sale can raise a dispute, within the configured window. */
const disputeTransaction = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  if (req.user.role === 'shop_operator' && transaction.shop.toString() !== req.user.shop?.toString()) {
    res.status(403);
    throw new Error('Forbidden');
  }

  if (transaction.status !== 'completed') {
    res.status(400);
    throw new Error(`Cannot dispute a transaction with status "${transaction.status}"`);
  }

  if (transaction.settlement) {
    res.status(400);
    throw new Error('This transaction has already been settled and paid out — raise this with the Super Admin directly');
  }

  const config = await PlatformConfig.getSingleton();
  const ageHours = (Date.now() - transaction.createdAt.getTime()) / (60 * 60 * 1000);
  if (ageHours > config.disputeWindowHours) {
    res.status(400);
    throw new Error(`Dispute window (${config.disputeWindowHours}h) has passed for this transaction`);
  }

  transaction.status = 'disputed';
  transaction.disputeReason = reason || 'No reason given';
  await transaction.save();

  await AuditLog.create({
    actor: req.user._id,
    action: 'TRANSACTION_DISPUTED',
    meta: { transactionId: transaction._id, reason: transaction.disputeReason },
  });

  res.json({ transaction });
});

/** Super Admin resolves a dispute as legitimate: refunds the customer and reverses the shop's receivable. */
const refundTransaction = asyncHandler(async (req, res) => {
  const original = await Transaction.findById(req.params.id);
  if (!original) {
    res.status(404);
    throw new Error('Transaction not found');
  }
  if (!['completed', 'disputed'].includes(original.status)) {
    res.status(400);
    throw new Error(`Cannot refund a transaction with status "${original.status}"`);
  }

  const session = await mongoose.startSession();
  let refundTx;
  try {
    await session.withTransaction(async () => {
      await walletService.creditWallet({
        staffId: original.staff,
        amount: original.amount,
        actorId: req.user._id,
        action: 'PURCHASE_REFUND',
        meta: { originalTransactionId: original._id },
        session,
      });

      await Shop.updateOne({ _id: original.shop }, { $inc: { receivableBalance: -original.amount } }, { session });

      const [created] = await Transaction.create(
        [
          {
            staff: original.staff,
            shop: original.shop,
            operator: req.user._id,
            amount: original.amount,
            type: 'refund',
            status: 'completed',
            refundOf: original._id,
          },
        ],
        { session }
      );

      original.status = 'refunded';
      await original.save({ session });

      refundTx = created;
    });
  } finally {
    session.endSession();
  }

  await AuditLog.create({
    actor: req.user._id,
    action: 'TRANSACTION_REFUNDED',
    meta: { originalTransactionId: original._id, refundTransactionId: refundTx._id, amount: original.amount },
  });

  res.json({ refund: refundTx, original });
});

/** Super Admin resolves a dispute as not warranting a refund — the sale stands and re-enters the settlement pool. */
const clearTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }
  if (transaction.status !== 'disputed') {
    res.status(400);
    throw new Error('Only a disputed transaction can be cleared');
  }

  transaction.status = 'completed';
  await transaction.save();

  await AuditLog.create({
    actor: req.user._id,
    action: 'TRANSACTION_CLEARED',
    meta: { transactionId: transaction._id },
  });

  res.json({ transaction });
});

module.exports = { listTransactions, disputeTransaction, refundTransaction, clearTransaction };
