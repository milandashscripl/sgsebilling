const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const items = global.__sgseItems || (global.__sgseItems = []);
let nextId = global.__sgseItemNextId || 1;

router.get('/', auth, async (req, res) => {
  res.json(items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
});

router.post('/', auth, async (req, res) => {
  const item = {
    _id: String(nextId++),
    ...req.body,
    createdBy: req.user?.id,
    createdAt: Date.now(),
    stock: Number(req.body.stock || 0)
  };
  global.__sgseItemNextId = nextId;
  items.push(item);
  res.status(201).json(item);
});

router.put('/:id', auth, async (req, res) => {
  const existing = items.find((entry) => entry._id === req.params.id);
  if (!existing) return res.status(404).json({ message: 'Item not found' });
  Object.assign(existing, req.body, { _id: existing._id, createdAt: existing.createdAt, createdBy: existing.createdBy });
  res.json(existing);
});

router.delete('/:id', auth, async (req, res) => {
  const index = items.findIndex((entry) => entry._id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Item not found' });
  items.splice(index, 1);
  res.json({ message: 'Item deleted' });
});

module.exports = router;
