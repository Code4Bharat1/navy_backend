const express = require('express');
const {
  createShop,
  listShops,
  createShopOperator,
  getMyShop,
  getMyShopSummary,
  listMyShopTransactions,
} = require('../controllers/shopController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/', authorize('super_admin'), createShop);
router.get('/', authorize('super_admin'), listShops);
router.post('/:shopId/operators', authorize('super_admin'), createShopOperator);

router.get('/me', authorize('shop_operator'), getMyShop);
router.get('/me/summary', authorize('shop_operator'), getMyShopSummary);
router.get('/me/transactions', authorize('shop_operator'), listMyShopTransactions);

module.exports = router;
