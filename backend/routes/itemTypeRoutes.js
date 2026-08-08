const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const itemTypes = [];
let nextId = 1;

router.get('/', auth, async (req, res) => {
  res.json(itemTypes.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
});

router.post('/', auth, async (req, res) => {
  const itemType = {
    _id: String(nextId++),
    ...req.body,
    createdBy: req.user?.id,
    createdAt: Date.now()
  };
  itemTypes.push(itemType);
  res.status(201).json(itemType);
});

router.put('/:id', auth, async (req, res) => {
  const existing = itemTypes.find((entry) => entry._id === req.params.id);
  if (!existing) return res.status(404).json({ message: 'Item type not found' });
  Object.assign(existing, req.body, { _id: existing._id, createdAt: existing.createdAt, createdBy: existing.createdBy });
  res.json(existing);
});

router.delete('/:id', auth, async (req, res) => {
  const index = itemTypes.findIndex((entry) => entry._id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Item type not found' });
  itemTypes.splice(index, 1);
  res.json({ message: 'Item type deleted' });
});

module.exports = router;
