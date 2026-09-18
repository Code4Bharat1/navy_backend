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
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/navy_cashless'),
  jwt: {
    secret: required('JWT_SECRET', 'dev_only_insecure_secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
};
