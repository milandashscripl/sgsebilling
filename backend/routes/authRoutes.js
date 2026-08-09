const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { authStore } = require('../utils/authStore');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });

    const existing = mongoose.connection.readyState === 1
      ? await User.findOne({ email })
      : authStore.findUserByEmail(email);
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    let user;

    if (mongoose.connection.readyState === 1) {
      user = new User({
        name,
        email,
        password: hashed,
        role: role === 'admin' ? 'admin' : 'user'
      });
      await user.save();
    } else {
      user = await authStore.createUser({ name, email, password, role });
    }

    const token = jwt.sign(
      { id: mongoose.connection.readyState === 1 ? String(user._id) : user.id },
      process.env.JWT_SECRET || 'sgse-super-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: mongoose.connection.readyState === 1 ? String(user._id) : user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user;

    user = mongoose.connection.readyState === 1
      ? await User.findOne({ email })
      : authStore.findUserByEmail(email);

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: mongoose.connection.readyState === 1 ? String(user._id) : user.id },
      process.env.JWT_SECRET || 'sgse-super-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: mongoose.connection.readyState === 1 ? String(user._id) : user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
