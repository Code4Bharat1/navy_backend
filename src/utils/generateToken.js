const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

module.exports = generateToken;
