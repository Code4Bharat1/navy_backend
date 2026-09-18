const mongoose = require('mongoose');

const TYPES = ['purchase', 'refund'];
const STATUSES = ['completed', 'disputed', 'refunded'];

const transactionSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // cardholder charged
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // shop_operator who scanned
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, enum: TYPES, default: 'purchase' },
    status: { type: String, enum: STATUSES, default: 'completed' },

    // A completed purchase this one reverses, when type === 'refund'.
    refundOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    disputeReason: { type: String },

    // Settlement cycle this purchase was paid out in, if any. Only 'completed' purchases
    // outside any settlement's cycle window and not disputed are eligible to be picked up.
    settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement' },

    // Lets the shop's offline queue safely retry a submission without double-charging —
    // a second request with the same key returns the original transaction instead of
    // creating a new one.
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TYPES = TYPES;
module.exports.STATUSES = STATUSES;
