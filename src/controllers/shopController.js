const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');

const createShop = asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('name is required');
  }

  const shop = await Shop.create({ name, location });

  await AuditLog.create({ actor: req.user._id, action: 'SHOP_CREATED', meta: { shopId: shop._id, name } });

  res.status(201).json({ shop });
});

const listShops = asyncHandler(async (req, res) => {
  const shops = await Shop.find().sort({ createdAt: -1 });
  const operatorCounts = await User.aggregate([
    { $match: { role: 'shop_operator' } },
    { $group: { _id: '$shop', count: { $sum: 1 } } },
  ]);
  const countByShop = Object.fromEntries(operatorCounts.map((o) => [o._id?.toString(), o.count]));

  res.json({
    shops: shops.map((s) => ({ ...s.toObject(), operatorCount: countByShop[s._id.toString()] || 0 })),
  });
});

/** Super Admin enrolls a login for a shop's operator. */
const createShopOperator = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { shopId } = req.params;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email and password are required');
  }

  const shop = await Shop.findById(shopId);
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const operator = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'shop_operator',
    shop: shop._id,
  });

  await AuditLog.create({
    actor: req.user._id,
    action: 'SHOP_OPERATOR_ENROLLED',
    targetUser: operator._id,
    meta: { shopId: shop._id, shopName: shop.name },
  });

  res.status(201).json({ operator: operator.toSafeJSON() });
});

const getMyShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.user.shop);
  if (!shop) {
    res.status(404);
    throw new Error('No shop linked to this account');
  }
  res.json({ shop });
});

const getMyShopSummary = asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayAgg] = await Transaction.aggregate([
    { $match: { shop: req.user.shop, status: 'completed', createdAt: { $gte: startOfToday } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const shop = await Shop.findById(req.user.shop);

  res.json({
    todayTotal: todayAgg?.total || 0,
    todayCount: todayAgg?.count || 0,
    receivableBalance: shop?.receivableBalance || 0,
  });
});

const listMyShopTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ shop: req.user.shop })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('staff', 'name serviceNumber cardUid');
  res.json({ transactions });
});

module.exports = {
  createShop,
  listShops,
  createShopOperator,
  getMyShop,
  getMyShopSummary,
  listMyShopTransactions,
};
