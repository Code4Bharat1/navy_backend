const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Recharge = require('../models/Recharge');

const getMyWallet = asyncHandler(async (req, res) => {
  res.json({ walletBalance: req.user.walletBalance, cardStatus: req.user.cardStatus });
});

const getWalletByStaffId = asyncHandler(async (req, res) => {
  const staff = await User.findOne({ _id: req.params.staffId, role: 'staff' });
  if (!staff) {
    res.status(404);
    throw new Error('Staff not found');
  }
  res.json({ walletBalance: staff.walletBalance, cardStatus: staff.cardStatus });
});

const getMyRechargeHistory = asyncHandler(async (req, res) => {
  const recharges = await Recharge.find({ staff: req.user._id }).sort({ createdAt: -1 });
  res.json({ recharges });
});

module.exports = { getMyWallet, getWalletByStaffId, getMyRechargeHistory };
