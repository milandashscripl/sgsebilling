const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authStore } = require('../utils/authStore');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sgse-super-secret-key');
    let user = null;

    if (mongoose.connection.readyState === 1) {
      user = await User.findById(decoded.id).select('name email role');
    }

    if (!user) {
      const userId = Number(decoded.id);
      user = authStore.findUserById(Number.isNaN(userId) ? decoded.id : userId);
    }

    if (!user) return res.status(401).json({ message: 'Invalid token' });

    req.user = {
      id: user.id ? String(user.id) : String(user._id),
      _id: user._id ? String(user._id) : String(user.id),
      name: user.name,
      email: user.email,
      role: user.role
    };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = auth;
