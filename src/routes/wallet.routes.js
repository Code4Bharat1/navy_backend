const express = require('express');
const { getMyWallet, getWalletByStaffId, getMyRechargeHistory } = require('../controllers/walletController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/me', authorize('staff'), getMyWallet);
router.get('/me/recharges', authorize('staff'), getMyRechargeHistory);
router.get('/:staffId', authorize('super_admin', 'recharge_operator'), getWalletByStaffId);

module.exports = router;
