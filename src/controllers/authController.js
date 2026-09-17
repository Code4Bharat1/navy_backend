const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  res.json({
    token: generateToken(user),
    user: user.toSafeJSON(),
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = { login, me };
