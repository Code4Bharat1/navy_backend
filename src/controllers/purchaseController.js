const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Transaction = require('../models/Transaction');
const walletService = require('../services/walletService');

/**
 * Scan & Pay: the shopkeeper enters an amount, the customer taps their card on the
 * handheld RFID reader (which behaves as a keyboard-wedge device, so the scanned UID
 * just arrives as normal form input — no special browser API needed). This debits the
 * wallet, credits the shop's receivable balance, and records the transaction — all in
 * one transaction, so a purchase can never partially apply.
 */
const createPurchase = asyncHandler(async (req, res) => {
  const { cardUid, amount, idempotencyKey } = req.body;
  const numericAmount = Number(amount);
  if (!cardUid || !numericAmount || numericAmount <= 0) {
    res.status(400);
    throw new Error('cardUid and a positive amount are required');
  }

  if (!req.user.shop) {
    res.status(400);
    throw new Error('This account is not linked to a shop');
  }

  // The offline queue retries a submission it's not sure landed — if we've already
  // recorded this exact attempt, hand back the original result instead of charging twice.
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey }).populate('staff', 'name cardUid');
    if (existing) {
      return res.status(200).json({
        transaction: existing,
        staffName: existing.staff.name,
        cardUid: existing.staff.cardUid,
        replay: true,
      });
    }
  }

  const staff = await User.findOne({ cardUid, role: 'staff' });
  if (!staff) {
    res.status(404);
    throw new Error('No card found with this UID');
  }

  const session = await mongoose.startSession();
  let transaction;
  try {
    await session.withTransaction(async () => {
      await walletService.debitWallet({
        staffId: staff._id,
        amount: numericAmount,
        actorId: req.user._id,
        action: 'PURCHASE_DEBIT',
        meta: { shopId: req.user.shop.toString() },
        session,
      });

      await Shop.updateOne(
        { _id: req.user.shop },
        { $inc: { receivableBalance: numericAmount } },
        { session }
      );

      const [created] = await Transaction.create(
        [
          {
            staff: staff._id,
            shop: req.user.shop,
            operator: req.user._id,
            amount: numericAmount,
            type: 'purchase',
            status: 'completed',
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session }
      );

      transaction = created;
    });
  } finally {
    session.endSession();
  }

  res.status(201).json({
    transaction,
    staffName: staff.name,
    cardUid: staff.cardUid,
  });
});

module.exports = { createPurchase };
