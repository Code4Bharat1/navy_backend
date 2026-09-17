const express = require('express');
const {
  enrollStaff,
  listStaff,
  getStaff,
  deactivateCard,
  reactivateCard,
  reportLost,
  replaceCard,
} = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/', authorize('super_admin'), enrollStaff);
router.get('/', authorize('super_admin'), listStaff);
router.get('/:id', getStaff); // self or super_admin, enforced in controller
router.patch('/:id/deactivate', authorize('super_admin'), deactivateCard);
router.patch('/:id/reactivate', authorize('super_admin'), reactivateCard);
router.patch('/:id/report-lost', authorize('super_admin'), reportLost);
router.post('/:id/replace-card', authorize('super_admin'), replaceCard);

module.exports = router;
