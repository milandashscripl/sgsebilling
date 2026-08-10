const express = require('express');
const auth = require('../middleware/auth');
const Item = require('../models/Item');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 }).lean();
    res.json(items.map((item) => ({ ...item, id: String(item._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const item = await Item.create({
      name: req.body.name,
      itemTypeId: req.body.itemTypeId,
      itemType: req.body.itemType || 'other',
      categoryId: req.body.categoryId,
      category: req.body.category || 'General',
      specification: req.body.specification || '',
      unit: req.body.unit || 'pcs',
      purchasePrice: Number(req.body.purchasePrice || 0),
      salePrice: Number(req.body.salePrice || 0),
      sgstRate: Number(req.body.sgstRate || 0),
      cgstRate: Number(req.body.cgstRate || 0),
      igstRate: Number(req.body.igstRate || 0),
      stock: Number(req.body.stock || 0),
      description: req.body.description || '',
      createdBy: req.user._id
    });

    res.status(201).json({ ...item.toObject(), id: String(item._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        itemTypeId: req.body.itemTypeId,
        itemType: req.body.itemType,
        categoryId: req.body.categoryId,
        category: req.body.category,
        specification: req.body.specification,
        unit: req.body.unit,
        purchasePrice: Number(req.body.purchasePrice || 0),
        salePrice: Number(req.body.salePrice || 0),
        sgstRate: Number(req.body.sgstRate || 0),
        cgstRate: Number(req.body.cgstRate || 0),
        igstRate: Number(req.body.igstRate || 0),
        stock: Number(req.body.stock || 0),
        description: req.body.description
      },
      { new: true, runValidators: true }
    ).lean();

    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ ...item, id: String(item._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
