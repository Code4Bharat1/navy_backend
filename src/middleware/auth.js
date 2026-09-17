const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const env = require('../config/env');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authenticated: missing bearer token');
  }

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    res.status(401);
    throw new Error('Not authenticated: invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error('Not authenticated: user not found or inactive');
  }

  req.user = user;
  next();
});

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Forbidden: requires role [${allowedRoles.join(', ')}]`);
    }
    next();
  };
}

module.exports = { protect, authorize };
