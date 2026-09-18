const mongoose = require('mongoose');

const ACTIONS = [
  'STAFF_ENROLLED',
  'CARD_DEACTIVATED',
  'CARD_REACTIVATED',
  'CARD_REPLACED',
  'RECHARGE_INITIATED',
  'RECHARGE_SUCCESS',
  'RECHARGE_FAILED',
  'WALLET_CREDIT',
  'WALLET_DEBIT',
  'PURCHASE_DEBIT',
  'PURCHASE_REFUND',
  'SHOP_CREATED',
  'SHOP_OPERATOR_ENROLLED',
  'SETTLEMENT_PAID',
  'SETTLEMENT_FAILED',
  'TRANSACTION_DISPUTED',
  'TRANSACTION_REFUNDED',
  'TRANSACTION_CLEARED',
  'PLATFORM_CONFIG_UPDATED',
];

// Audit entries are append-only: no update/delete routes are exposed for this collection.
const auditLogSchema = new mongoose.Schema(
  {
    // Absent for actions the system itself triggers (e.g. the scheduled settlement cron)
    // rather than a logged-in user.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ACTIONS, required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.ACTIONS = ACTIONS;
