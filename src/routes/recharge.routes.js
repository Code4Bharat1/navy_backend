const express = require('express');
const {
  initiateRecharge,
  verifyRecharge,
  cashRecharge,
  listAllRecharges,
} = require('../controllers/rechargeController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Note: POST /razorpay/webhook is mounted separately in app.js, ahead of the global
// JSON body parser, because webhook signature verification needs the raw request body.

router.use(protect);

router.post('/initiate', authorize('staff'), initiateRecharge);
router.post('/verify', authorize('staff'), verifyRecharge);
router.post('/cash', authorize('recharge_operator', 'super_admin'), cashRecharge);
router.get('/', authorize('super_admin'), listAllRecharges);

module.exports = router;
