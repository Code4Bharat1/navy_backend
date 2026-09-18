const express = require('express');
const {
  runSettlement,
  runSettlementForOneShop,
  listSettlements,
  listMySettlements,
} = require('../controllers/settlementController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/run', authorize('super_admin'), runSettlement);
router.post('/run/:shopId', authorize('super_admin'), runSettlementForOneShop);
router.get('/', authorize('super_admin'), listSettlements);
router.get('/me', authorize('shop_operator'), listMySettlements);

module.exports = router;
