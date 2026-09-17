const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Recharge = require('../models/Recharge');
const razorpayService = require('../services/razorpayService');
const walletService = require('../services/walletService');
const env = require('../config/env');

/** Staff initiates a self-service recharge. Real money is collected into the pooled Razorpay account. */
const initiateRecharge = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error('A positive amount is required');
  }

  const receipt = razorpayService.generateReceipt();
  const order = await razorpayService.createOrder({ amount, receipt });

  await Recharge.create({
    staff: req.user._id,
    amount,
    method: 'razorpay',
    orderId: order.id,
    status: 'initiated',
    initiatedBy: req.user._id,
    gatewayResponse: { receipt },
  });

  res.status(201).json({
    keyId: env.razorpay.keyId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  });
});

/**
 * Marks a recharge successful and credits the wallet exactly once, no matter how many times
 * (client callback, webhook retries) this gets called for the same order. The status flip and
 * the wallet credit happen in the same transaction — either both land or neither does, so a
 * recharge can never end up "success" with the wallet left uncredited.
 */
async function settleSuccessfulRecharge({ orderId, paymentId, gatewayResponse }) {
  const session = await mongoose.startSession();
  try {
    let recharge = null;
    await session.withTransaction(async () => {
      const updated = await Recharge.findOneAndUpdate(
        { orderId, status: 'initiated' },
        { status: 'success', paymentRef: paymentId, gatewayResponse },
        { new: true, session }
      );

      // null means it was already settled by a concurrent call (webhook vs. client verify) — nothing left to do.
      if (!updated) return;

      await walletService.creditWallet({
        staffId: updated.staff,
        amount: updated.amount,
        actorId: updated.staff,
        action: 'RECHARGE_SUCCESS',
        meta: { orderId, paymentId, method: 'razorpay' },
        session,
      });

      recharge = updated;
    });
    return recharge;
  } finally {
    session.endSession();
  }
}

/**
 * Called by the browser (Razorpay Checkout's handler) right after a payment attempt.
 * The client's word alone is never trusted: the signature proves the response came from
 * Razorpay, and we still re-fetch the payment server-side to confirm it's actually captured
 * and for the expected amount before crediting anything.
 */
const verifyRecharge = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    res.status(400);
    throw new Error('razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
  }

  const recharge = await Recharge.findOne({ orderId });
  if (!recharge || recharge.staff.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Recharge order not found');
  }

  const signatureOk = razorpayService.verifyPaymentSignature({ orderId, paymentId, signature });
  if (!signatureOk) {
    await Recharge.updateOne({ orderId, status: 'initiated' }, { status: 'failed' });
    res.status(400);
    throw new Error('Payment signature verification failed');
  }

  const payment = await razorpayService.fetchPayment(paymentId);
  if (payment.status !== 'captured' || Math.round(recharge.amount * 100) !== payment.amount) {
    await Recharge.updateOne({ orderId, status: 'initiated' }, { status: 'failed', gatewayResponse: payment });
    res.status(400);
    throw new Error('Payment could not be confirmed as captured for the expected amount');
  }

  await settleSuccessfulRecharge({ orderId, paymentId, gatewayResponse: payment });
  res.json({ status: 'success' });
});

/**
 * Authoritative server-to-server confirmation from Razorpay. This is what should be relied on
 * in production even if the browser never calls /verify (tab closed, network drop, etc).
 */
const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const signatureOk = razorpayService.verifyWebhookSignature({ rawBody: req.body, signature });
  if (!signatureOk) {
    res.status(400);
    throw new Error('Invalid webhook signature');
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  if (payload.event === 'payment.captured') {
    const payment = payload.payload.payment.entity;
    const recharge = await Recharge.findOne({ orderId: payment.order_id });
    if (recharge && Math.round(recharge.amount * 100) === payment.amount) {
      await settleSuccessfulRecharge({ orderId: payment.order_id, paymentId: payment.id, gatewayResponse: payment });
    }
  }

  res.json({ received: true });
});

/** Recharge Operator tops up a staff member's card on their behalf (e.g. cash handed over). */
const cashRecharge = asyncHandler(async (req, res) => {
  const { staffId, amount, receiptNumber } = req.body;
  const numericAmount = Number(amount);
  if (!staffId || !numericAmount || numericAmount <= 0 || !receiptNumber) {
    res.status(400);
    throw new Error('staffId, a positive amount, and receiptNumber are required');
  }

  const orderId = razorpayService.generateReceipt();
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

module.exports = { initiateRecharge, verifyRecharge, razorpayWebhook, cashRecharge, listAllRecharges };
