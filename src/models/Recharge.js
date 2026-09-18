const mongoose = require('mongoose');

// Every recharge is a cash handoff at the counter — no payment gateway. 'success' is set
// the moment it's recorded, there's no async settlement step to wait on.
const METHODS = ['cash'];
const STATUSES = ['success', 'failed'];

const rechargeSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: METHODS, default: 'cash' },
    orderId: { type: String, required: true, unique: true },
    paymentRef: { type: String }, // cash receipt number
    status: { type: String, enum: STATUSES, default: 'success' },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recharge', rechargeSchema);
module.exports.METHODS = METHODS;
module.exports.STATUSES = STATUSES;
