const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    bankAccountDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true },
    },
    // What the pooled account owes this shop, accumulated by purchases and zeroed out
    // by settlement payouts — not real money movement by itself.
    receivableBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // Cached RazorpayX Contact/Fund Account ids so a payout doesn't recreate them every cycle.
    razorpayContactId: { type: String },
    razorpayFundAccountId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop', shopSchema);
