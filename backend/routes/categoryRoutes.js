const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const categories = [];
let nextId = 1;

router.get('/', auth, async (req, res) => {
  res.json(categories.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
});

router.post('/', auth, async (req, res) => {
  const category = {
    _id: String(nextId++),
    ...req.body,
    createdBy: req.user?.id,
    createdAt: Date.now()
  };
  categories.push(category);
  res.status(201).json(category);
});

router.put('/:id', auth, async (req, res) => {
  const existing = categories.find((entry) => entry._id === req.params.id);
  if (!existing) return res.status(404).json({ message: 'Category not found' });
  Object.assign(existing, req.body, { _id: existing._id, createdAt: existing.createdAt, createdBy: existing.createdBy });
  res.json(existing);
});

router.delete('/:id', auth, async (req, res) => {
  const index = categories.findIndex((entry) => entry._id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Category not found' });
  categories.splice(index, 1);
  res.json({ message: 'Category deleted' });
});

module.exports = router;
