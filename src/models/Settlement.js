const mongoose = require('mongoose');

// Settlement is a record of an offline event — the admin paid a shop (cash, bank transfer,
// however) outside the system — not a payment-gateway payout, so there's no pending/failed
// state to track; it's created already 'paid'.
const STATUSES = ['paid'];

const settlementSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    cycleStart: { type: Date, required: true },
    cycleEnd: { type: Date, required: true },
    grossAmount: { type: Number, required: true },
    commission: { type: Number, default: 0 },
    netPaid: { type: Number, required: true },
    transactionCount: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: 'paid' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settlement', settlementSchema);
module.exports.STATUSES = STATUSES;
