const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

async function applyBalanceChange({ staffId, amount, actorId, action, meta, session, direction }) {
  const staff = await User.findById(staffId).session(session);
  if (!staff || staff.role !== 'staff') {
    throw new Error('Target user is not a valid staff cardholder');
  }
  if (staff.cardStatus !== 'active') {
    throw new Error(`Cannot ${direction === 1 ? 'credit' : 'debit'} wallet: card status is "${staff.cardStatus}"`);
  }
  if (direction === -1 && staff.walletBalance < amount) {
    throw new Error('Insufficient wallet balance');
  }

  const balanceBefore = staff.walletBalance;
  staff.walletBalance = balanceBefore + direction * amount;
  await staff.save({ session });

  await AuditLog.create(
    [{ actor: actorId, action, targetUser: staffId, amount, balanceBefore, balanceAfter: staff.walletBalance, meta }],
    { session }
  );

  return staff;
}

/**
 * Credits a staff member's wallet ledger. Used after a successful recharge payment
 * has already landed in the pooled/nodal account — this only updates the internal
 * ledger, it never moves real money itself.
 *
 * Pass an existing `session` (already inside a `withTransaction` block) to make this
 * commit atomically together with other writes in that same transaction — e.g. so a
 * recharge can never end up marked "success" without the wallet actually being
 * credited. Omit it to run as its own self-contained transaction.
 */
async function creditWallet({ staffId, amount, actorId, action = 'WALLET_CREDIT', meta, session }) {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const args = { staffId, amount, actorId, action, meta, direction: 1 };

  if (session) {
    return applyBalanceChange({ ...args, session });
  }

  const ownSession = await mongoose.startSession();
  try {
    let result;
    await ownSession.withTransaction(async () => {
      result = await applyBalanceChange({ ...args, session: ownSession });
    });
    return result;
  } finally {
    ownSession.endSession();
  }
}

/**
 * Debits a staff member's wallet ledger (e.g. shop purchase in later phases).
 * Rejects if it would drive the balance negative. Accepts an existing `session`
 * the same way `creditWallet` does.
 */
async function debitWallet({ staffId, amount, actorId, action = 'WALLET_DEBIT', meta, session }) {
  if (amount <= 0) {
    throw new Error('Debit amount must be positive');
  }

  const args = { staffId, amount, actorId, action, meta, direction: -1 };

  if (session) {
    return applyBalanceChange({ ...args, session });
  }

  const ownSession = await mongoose.startSession();
  try {
    let result;
    await ownSession.withTransaction(async () => {
      result = await applyBalanceChange({ ...args, session: ownSession });
    });
    return result;
  } finally {
    ownSession.endSession();
  }
}

module.exports = { creditWallet, debitWallet };
