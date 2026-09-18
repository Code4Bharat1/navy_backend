const mongoose = require('mongoose');

const STATUSES = ['pending', 'paid', 'failed'];

const settlementSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    cycleStart: { type: Date, required: true },
    cycleEnd: { type: Date, required: true },
    grossAmount: { type: Number, required: true },
    commission: { type: Number, default: 0 },
    netPaid: { type: Number, required: true },
    transactionCount: { type: Number, default: 0 },
    payoutRef: { type: String },
    payoutStatus: { type: String }, // raw RazorpayX status: queued/processing/processed/...
    status: { type: String, enum: STATUSES, default: 'pending' },
    failureReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settlement', settlementSchema);
module.exports.STATUSES = STATUSES;
