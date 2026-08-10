const express = require('express');
const auth = require('../middleware/auth');
const ItemType = require('../models/ItemType');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const itemTypes = await ItemType.find().sort({ createdAt: -1 }).lean();
    res.json(itemTypes.map((type) => ({ ...type, id: String(type._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const itemType = await ItemType.create({
      name: req.body.name,
      unit: req.body.unit || 'pcs',
      sgstRate: Number(req.body.sgstRate || 0),
      cgstRate: Number(req.body.cgstRate || 0),
      igstRate: Number(req.body.igstRate || 0),
      description: req.body.description || '',
      createdBy: req.user._id
    });
    res.status(201).json({ ...itemType.toObject(), id: String(itemType._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const itemType = await ItemType.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        unit: req.body.unit,
        sgstRate: Number(req.body.sgstRate || 0),
        cgstRate: Number(req.body.cgstRate || 0),
        igstRate: Number(req.body.igstRate || 0),
        description: req.body.description
      },
      { new: true, runValidators: true }
    ).lean();

    if (!itemType) return res.status(404).json({ message: 'Item type not found' });
    res.json({ ...itemType, id: String(itemType._id) });
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
