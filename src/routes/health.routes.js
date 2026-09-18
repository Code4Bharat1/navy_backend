const express = require('express');
const { getHealth } = require('../controllers/healthController');

const router = express.Router();

// No auth — this is what a load balancer / uptime monitor / reverse proxy hits.
router.get('/', getHealth);

module.exports = router;
