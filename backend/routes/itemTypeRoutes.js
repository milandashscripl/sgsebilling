const express = require('express');
const auth = require('../middleware/auth');
const ItemType = require('../models/ItemType');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const itemTypes = await ItemType.find().sort({ createdAt: -1 });
    res.json(itemTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const itemType = new ItemType({ ...req.body, createdBy: req.user._id });
    await itemType.save();
    res.status(201).json(itemType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const itemType = await ItemType.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!itemType) return res.status(404).json({ message: 'Item type not found' });
    res.json(itemType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const itemType = await ItemType.findByIdAndDelete(req.params.id);
    if (!itemType) return res.status(404).json({ message: 'Item type not found' });
    res.json({ message: 'Item type deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
