const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { authStore } = require('../utils/authStore');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

  if (mongoose.connection.readyState === 1) {
    const users = await User.find({}, 'name email role').lean();
    return res.json(users.map((user) => ({ _id: String(user._id), id: String(user._id), name: user.name, email: user.email, role: user.role })));
  }

  const users = authStore.users.map(({ id, name, email, role }) => ({ _id: String(id), id, name, email, role }));
  res.json(users);
});

module.exports = router;
