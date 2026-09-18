const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

// mongoose.connection.readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

const getHealth = asyncHandler(async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbHealthy = dbState === 1;

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    db: DB_STATES[dbState] || 'unknown',
  });
});

module.exports = { getHealth };
