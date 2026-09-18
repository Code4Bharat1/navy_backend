const mongoose = require('mongoose');

// Singleton document (one row, fixed _id) holding platform-wide settings the Super
// Admin can tune, e.g. the commission percentage taken out of each shop's settlement.
const platformConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'singleton' },
    commissionPercent: { type: Number, default: 0, min: 0, max: 100 },
    disputeWindowHours: { type: Number, default: 48, min: 0 },
  },
  { timestamps: true }
);

platformConfigSchema.statics.getSingleton = async function getSingleton() {
  let config = await this.findById('singleton');
  if (!config) {
    config = await this.create({ _id: 'singleton' });
  }
  return config;
};

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
