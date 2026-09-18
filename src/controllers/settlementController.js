const asyncHandler = require('express-async-handler');
const Settlement = require('../models/Settlement');
const settlementService = require('../services/settlementService');

/** Super Admin manually triggers a settlement cycle for every active shop right now. */
const runSettlement = asyncHandler(async (req, res) => {
  const results = await settlementService.runSettlementForAllShops({ actorId: req.user._id });
  res.json({ results });
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

module.exports = { runSettlement, listSettlements, listMySettlements };
