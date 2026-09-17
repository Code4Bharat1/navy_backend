const crypto = require('crypto');
const Razorpay = require('razorpay');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

let client = null;
function getClient() {
  if (!client) {
    assertConfigured();
    client = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }
  return client;
}

function assertConfigured() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new Error(
      'Razorpay recharge is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env ' +
        '(Razorpay Dashboard > Settings > API Keys, for the pooled/nodal account).'
    );
  }
}

function generateReceipt() {
  return `RCHG_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
}

/** Creates a Razorpay order for a recharge. Amount is in rupees; Razorpay wants paise. */
async function createOrder({ amount, receipt }) {
  return getClient().orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt,
    payment_capture: 1,
  });
}

/** Verifies the HMAC-SHA256 signature Razorpay Checkout returns to the browser after payment. */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  assertConfigured();
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

/** Verifies the X-Razorpay-Signature header on webhook deliveries against the raw request body. */
function verifyWebhookSignature({ rawBody, signature }) {
  if (!env.razorpay.webhookSecret) {
    throw new Error('Razorpay webhook is not configured: set RAZORPAY_WEBHOOK_SECRET in backend/.env');
  }
  const expected = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  return expected === signature;
}

/** Never trust the client's reported outcome alone — re-fetch the payment from Razorpay before crediting. */
async function fetchPayment(paymentId) {
  return getClient().payments.fetch(paymentId);
}

module.exports = {
  generateReceipt,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
};
