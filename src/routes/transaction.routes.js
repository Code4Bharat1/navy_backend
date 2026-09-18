const express = require('express');
const {
  listTransactions,
  disputeTransaction,
  refundTransaction,
  clearTransaction,
} = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', authorize('super_admin'), listTransactions);
router.post('/:id/dispute', authorize('super_admin', 'shop_operator'), disputeTransaction);
router.post('/:id/refund', authorize('super_admin'), refundTransaction);
router.post('/:id/clear', authorize('super_admin'), clearTransaction);

module.exports = router;
