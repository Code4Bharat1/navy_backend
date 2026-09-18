const crypto = require('crypto');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Recharge = require('../models/Recharge');
const walletService = require('../services/walletService');

/**
 * Recharge Operator (or Super Admin) tops up a staff member's card after collecting cash
 * in person. There is no payment gateway in this system — every recharge is a cash handoff
 * recorded against whoever processed it, credited to the wallet atomically alongside the
 * Recharge record itself so the two can never drift apart.
 */
const cashRecharge = asyncHandler(async (req, res) => {
  const { staffId, amount, receiptNumber } = req.body;
  const numericAmount = Number(amount);
  if (!staffId || !numericAmount || numericAmount <= 0 || !receiptNumber) {
    res.status(400);
    throw new Error('staffId, a positive amount, and receiptNumber are required');
  }

  const orderId = crypto.randomUUID();
  const session = await mongoose.startSession();
  let recharge;
  try {
    await session.withTransaction(async () => {
      const [created] = await Recharge.create(
        [
          {
            staff: staffId,
            amount: numericAmount,
            method: 'cash',
            orderId,
            paymentRef: receiptNumber,
            status: 'success',
            initiatedBy: req.user._id,
          },
        ],
        { session }
      );

      await walletService.creditWallet({
        staffId,
        amount: numericAmount,
        actorId: req.user._id,
        action: 'RECHARGE_SUCCESS',
        meta: { orderId, receiptNumber, method: 'cash' },
        session,
      });

      recharge = created;
    });
  } finally {
    session.endSession();
  }

  res.status(201).json({ recharge });
});

const listAllRecharges = asyncHandler(async (req, res) => {
  const recharges = await Recharge.find().sort({ createdAt: -1 }).populate('staff', 'name serviceNumber');
  res.json({ recharges });
});

module.exports = { cashRecharge, listAllRecharges };
