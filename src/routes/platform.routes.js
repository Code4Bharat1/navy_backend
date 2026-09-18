const express = require('express');
const { getOverview, getConfig, updateConfig } = require('../controllers/platformController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('super_admin'));

router.get('/overview', getOverview);
router.get('/config', getConfig);
router.put('/config', updateConfig);

module.exports = router;
