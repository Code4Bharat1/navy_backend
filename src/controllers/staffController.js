const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/** Super Admin enrolls a new staff member with a zero-balance wallet. */
const enrollStaff = asyncHandler(async (req, res) => {
  const { name, email, password, serviceNumber, cardUid } = req.body;
  if (!name || !email || !password || !serviceNumber || !cardUid) {
    res.status(400);
    throw new Error('name, email, password, serviceNumber and cardUid are required');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'staff',
    serviceNumber,
    cardUid,
    walletBalance: 0,
    cardStatus: 'active',
  });

  await AuditLog.create({
    actor: req.user._id,
    action: 'STAFF_ENROLLED',
    targetUser: staff._id,
    balanceBefore: 0,
    balanceAfter: 0,
    meta: { serviceNumber, cardUid },
  });

  res.status(201).json({ staff: staff.toSafeJSON() });
});

const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: 'staff' }).sort({ createdAt: -1 });
  res.json({ staff: staff.map((s) => s.toSafeJSON()) });
});

const getStaff = asyncHandler(async (req, res) => {
  const isSelf = req.user._id.toString() === req.params.id;
  if (!isSelf && req.user.role !== 'super_admin') {
    res.status(403);
    throw new Error('Forbidden');
  }

  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) {
    res.status(404);
    throw new Error('Staff not found');
  }
  res.json({ staff: staff.toSafeJSON() });
});

const setCardStatus = (targetStatus, action) =>
  asyncHandler(async (req, res) => {
    const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
    if (!staff) {
      res.status(404);
      throw new Error('Staff not found');
    }

    const previousStatus = staff.cardStatus;
    staff.cardStatus = targetStatus;
    await staff.save();

    await AuditLog.create({
      actor: req.user._id,
      action,
      targetUser: staff._id,
      meta: { previousStatus, newStatus: targetStatus },
    });

    res.json({ staff: staff.toSafeJSON() });
  });

const deactivateCard = setCardStatus('inactive', 'CARD_DEACTIVATED');
const reactivateCard = setCardStatus('active', 'CARD_REACTIVATED');
const reportLost = setCardStatus('lost', 'CARD_DEACTIVATED');

/** Issues a replacement card UID for a staff member. Wallet balance carries over untouched. */
const replaceCard = asyncHandler(async (req, res) => {
  const { newCardUid } = req.body;
  if (!newCardUid) {
    res.status(400);
    throw new Error('newCardUid is required');
  }

  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) {
    res.status(404);
    throw new Error('Staff not found');
  }

  const existing = await User.findOne({ cardUid: newCardUid });
  if (existing) {
    res.status(409);
    throw new Error('This card UID is already assigned to another cardholder');
  }

  const previousCardUid = staff.cardUid;
  staff.cardUid = newCardUid;
  staff.cardStatus = 'active';
  await staff.save();

  await AuditLog.create({
    actor: req.user._id,
    action: 'CARD_REPLACED',
    targetUser: staff._id,
    meta: { previousCardUid, newCardUid, walletBalanceCarriedOver: staff.walletBalance },
  });

  res.json({ staff: staff.toSafeJSON() });
});

module.exports = {
  enrollStaff,
  listStaff,
  getStaff,
  deactivateCard,
  reactivateCard,
  reportLost,
  replaceCard,
};
