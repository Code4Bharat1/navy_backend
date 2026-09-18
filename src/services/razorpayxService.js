const axios = require('axios');
const env = require('../config/env');

const BASE_URL = 'https://api.razorpay.com/v1';

function assertConfigured() {
  if (!env.razorpayx.keyId || !env.razorpayx.keySecret || !env.razorpayx.accountNumber) {
    throw new Error(
      'RazorpayX payouts are not configured: set RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET and ' +
        'RAZORPAYX_ACCOUNT_NUMBER in backend/.env (RazorpayX Dashboard — this is a separate ' +
        'product from the regular Razorpay Payment Gateway keys and needs its own business account).'
    );
  }
}

function client() {
  return axios.create({
    baseURL: BASE_URL,
    auth: { username: env.razorpayx.keyId, password: env.razorpayx.keySecret },
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates (or reuses, via the ids cached on the Shop doc) the RazorpayX Contact and
 * Fund Account a shop's payouts get sent to. Returns { contactId, fundAccountId }.
 */
async function ensureFundAccount(shop) {
  assertConfigured();
  const http = client();

  let contactId = shop.razorpayContactId;
  if (!contactId) {
    const { data } = await http.post('/contacts', {
      name: shop.name,
      type: 'vendor',
      reference_id: shop._id.toString(),
    });
    contactId = data.id;
  }

  let fundAccountId = shop.razorpayFundAccountId;
  if (!fundAccountId) {
    const { accountHolderName, accountNumber, ifsc } = shop.bankAccountDetails || {};
    if (!accountNumber || !ifsc) {
      throw new Error(`Shop "${shop.name}" has no bank account details on file — cannot create a payout destination.`);
    }
    const { data } = await http.post('/fund_accounts', {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: accountHolderName || shop.name,
        ifsc,
        account_number: accountNumber,
      },
    });
    fundAccountId = data.id;
  }

  return { contactId, fundAccountId };
}

/**
 * Triggers a real bank payout. `idempotencyKey` (the Settlement's own id is used for this)
 * makes a retried call safe — RazorpayX returns the original payout instead of creating a
 * second one for the same key.
 */
async function createPayout({ fundAccountId, amount, idempotencyKey, narration }) {
  assertConfigured();
  const http = client();

  const { data } = await http.post(
    '/payouts',
    {
      account_number: env.razorpayx.accountNumber,
      fund_account_id: fundAccountId,
      amount: Math.round(amount * 100),
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: idempotencyKey,
      narration: narration || 'Navy Cashless shop settlement',
    },
    { headers: { 'X-Payout-Idempotency': idempotencyKey } }
  );

  return data;
}

module.exports = { ensureFundAccount, createPayout };
