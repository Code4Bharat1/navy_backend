const mongoose = require('mongoose');

const TYPES = ['purchase', 'refund'];
const STATUSES = ['completed', 'refunded'];

const transactionSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // cardholder charged
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // shop_operator who scanned
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, enum: TYPES, default: 'purchase' },
    status: { type: String, enum: STATUSES, default: 'completed' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TYPES = TYPES;
module.exports.STATUSES = STATUSES;
