const jwt = require('jsonwebtoken');
const { authStore } = require('../utils/authStore');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sgse-super-secret-key');
    const user = authStore.findUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid token' });

    req.user = { id: user.id, _id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = auth;
