const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');

const authRoutes = require('./routes/auth.routes');
const staffRoutes = require('./routes/staff.routes');
const walletRoutes = require('./routes/wallet.routes');
const rechargeRoutes = require('./routes/recharge.routes');
const shopRoutes = require('./routes/shop.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const { razorpayWebhook } = require('./controllers/rechargeController');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));

// Registered ahead of the global JSON parser: webhook signature verification needs
// the exact raw request body, which express.json() would otherwise consume first.
app.post('/api/recharge/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/purchase', purchaseRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
