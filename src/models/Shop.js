const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    // Points owed to this shop for sales made, cleared to 0 whenever the admin records an
    // offline (cash/bank transfer, done outside the system) settlement with them.
    receivableBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shop', shopSchema);
