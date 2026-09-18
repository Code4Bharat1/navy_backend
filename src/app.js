const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const staffRoutes = require('./routes/staff.routes');
const walletRoutes = require('./routes/wallet.routes');
const rechargeRoutes = require('./routes/recharge.routes');
const shopRoutes = require('./routes/shop.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const settlementRoutes = require('./routes/settlement.routes');
const platformRoutes = require('./routes/platform.routes');
const transactionRoutes = require('./routes/transaction.routes');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

const CLIENT_ORIGINS = [
  'https://navy.nexcorealliance.com',
  'https://www.navy.nexcorealliance.com',
  'www.navy.nexcorealliance.com',
  'navy.nexcorealliance.com',
  'http://localhost:3000',
  'localhost:3000',
];

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (curl, server-to-server calls) — not a browser cross-origin
      // request, nothing to check against the allowlist.
      if (!origin || CLIENT_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin "${origin}" is not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.use('/api/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/transactions', transactionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
