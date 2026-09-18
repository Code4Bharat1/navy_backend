require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: required('MONGO_URI', 'mongodb+srv://mohammedjagda601_db_user:QeBJcvEXMANqojy1@cluster0.j3ylb2d.mongodb.net/?appName=Cluster0'),
  jwt: {
    secret: required('JWT_SECRET', 'dev_only_insecure_secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  razorpayx: {
    keyId: process.env.RAZORPAYX_KEY_ID || '',
    keySecret: process.env.RAZORPAYX_KEY_SECRET || '',
    accountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER || '',
  },
  settlement: {
    // Cron expression for the automatic settlement run. Default: 02:00 every day.
    cron: process.env.SETTLEMENT_CRON || '0 2 * * *',
    enabled: process.env.SETTLEMENT_CRON_ENABLED !== 'false',
  },
};
