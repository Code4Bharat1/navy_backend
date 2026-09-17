const mongoose = require('mongoose');

const ROLES = ['super_admin', 'shop_operator', 'recharge_operator', 'staff'];
const CARD_STATUSES = ['active', 'inactive', 'lost', 'replaced'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true },

    // Cardholder (staff) only fields — RFID UID is never used as a login credential by itself.
    serviceNumber: { type: String, trim: true, unique: true, sparse: true },
    cardUid: { type: String, trim: true, unique: true, sparse: true },
    walletBalance: { type: Number, default: 0, min: 0 },
    cardStatus: { type: String, enum: CARD_STATUSES, default: undefined },

    // Shop operator only field.
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.CARD_STATUSES = CARD_STATUSES;
