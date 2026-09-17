const express = require('express');
const { createPurchase } = require('../controllers/purchaseController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.post('/', authorize('shop_operator'), createPurchase);

module.exports = router;
