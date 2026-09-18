const express = require('express');
const { cashRecharge, listAllRecharges } = require('../controllers/rechargeController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/cash', authorize('recharge_operator', 'super_admin'), cashRecharge);
router.get('/', authorize('super_admin'), listAllRecharges);

module.exports = router;
