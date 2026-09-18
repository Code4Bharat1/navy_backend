const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Transaction = require('../models/Transaction');
const PlatformConfig = require('../models/PlatformConfig');
const AuditLog = require('../models/AuditLog');
const settlementService = require('../services/settlementService');

const getOverview = asyncHandler(async (req, res) => {
  const ledger = await settlementService.getLedgerIntegrity();

  const [staffCount, shopCount, disputedCount] = await Promise.all([
    User.countDocuments({ role: 'staff' }),
    Shop.countDocuments({ isActive: true }),
    Transaction.countDocuments({ status: 'disputed' }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [todayAgg] = await Transaction.aggregate([
    { $match: { type: 'purchase', status: { $ne: 'refunded' }, createdAt: { $gte: startOfToday } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  res.json({
    ledger,
    staffCount,
    shopCount,
    disputedCount,
    todaySales: todayAgg?.total || 0,
    todayTransactionCount: todayAgg?.count || 0,
  });
});

const getConfig = asyncHandler(async (req, res) => {
  const config = await PlatformConfig.getSingleton();
  res.json({ config });
});

const updateConfig = asyncHandler(async (req, res) => {
  const { commissionPercent, disputeWindowHours } = req.body;
  const config = await PlatformConfig.getSingleton();

  if (commissionPercent !== undefined) {
    const value = Number(commissionPercent);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      res.status(400);
      throw new Error('commissionPercent must be a number between 0 and 100');
    }
    config.commissionPercent = value;
  }

  if (disputeWindowHours !== undefined) {
    const value = Number(disputeWindowHours);
    if (Number.isNaN(value) || value < 0) {
      res.status(400);
      throw new Error('disputeWindowHours must be a non-negative number');
    }
    config.disputeWindowHours = value;
  }

  await config.save();

  await AuditLog.create({
    actor: req.user._id,
    action: 'PLATFORM_CONFIG_UPDATED',
    meta: { commissionPercent: config.commissionPercent, disputeWindowHours: config.disputeWindowHours },
  });

  res.json({ config });
});

module.exports = { getOverview, getConfig, updateConfig };
