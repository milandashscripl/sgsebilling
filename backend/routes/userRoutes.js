const express = require('express');
const auth = require('../middleware/auth');
const { authStore } = require('../utils/authStore');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const users = authStore.users.map(({ id, name, email, role }) => ({ _id: String(id), id, name, email, role }));
  res.json(users);
});

module.exports = router;
