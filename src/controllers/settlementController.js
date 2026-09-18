const asyncHandler = require('express-async-handler');
const Shop = require('../models/Shop');
const Settlement = require('../models/Settlement');
const settlementService = require('../services/settlementService');

/** Super Admin manually triggers a settlement cycle for every active shop right now. */
const runSettlement = asyncHandler(async (req, res) => {
  const results = await settlementService.runSettlementForAllShops({ actorId: req.user._id });
  res.json({ results });
});

/** Super Admin settles one specific shop's account right now — "Account Settled" for that shop. */
const runSettlementForOneShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findById(req.params.shopId);
  if (!shop) {
    res.status(404);
    throw new Error('Shop not found');
  }

  const result = await settlementService.runSettlementForShop(shop, { actorId: req.user._id });
  res.json({ result });
});

const listSettlements = asyncHandler(async (req, res) => {
  const filter = req.query.shopId ? { shop: req.query.shopId } : {};
  const settlements = await Settlement.find(filter).sort({ createdAt: -1 }).populate('shop', 'name location');
  res.json({ settlements });
});

const listMySettlements = asyncHandler(async (req, res) => {
  const settlements = await Settlement.find({ shop: req.user.shop }).sort({ createdAt: -1 });
  res.json({ settlements });
});

module.exports = { runSettlement, runSettlementForOneShop, listSettlements, listMySettlements };
