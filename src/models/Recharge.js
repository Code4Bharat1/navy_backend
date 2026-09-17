const mongoose = require('mongoose');

const METHODS = ['razorpay', 'cash'];
const STATUSES = ['initiated', 'success', 'failed'];

const rechargeSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: METHODS, required: true },
    orderId: { type: String, required: true, unique: true }, // Razorpay order id, or our generated id for cash
    paymentRef: { type: String }, // Razorpay payment ID, or receipt number for cash
    status: { type: String, enum: STATUSES, default: 'initiated' },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recharge', rechargeSchema);
module.exports.METHODS = METHODS;
module.exports.STATUSES = STATUSES;
