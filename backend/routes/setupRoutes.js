const express = require('express');
const auth = require('../middleware/auth');
const Setup = require('../models/Setup');
const Item = require('../models/Item');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const setups = await Setup.find({ createdBy: req.user._id }).sort({ name: 1 }).lean();
    res.json(setups.map((setup) => ({ ...setup, id: String(setup._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    const finalPrice = Number(req.body.finalPrice ?? 0);
    const gstRate = Number(req.body.gstRate ?? 0);
    const hasPackageValue = Number.isFinite(finalPrice) && finalPrice > 0;

    if (!req.body.name?.trim()) {
      return res.status(400).json({ message: 'Setup name is required' });
    }

    if (!requestedItems.length && !hasPackageValue) {
      return res.status(400).json({ message: 'Provide either item rows or a final setup value' });
    }

    let items = [];
    if (requestedItems.length) {
      items = await Promise.all(requestedItems.map(async (entry) => {
        const item = await Item.findById(entry.item || entry.itemId).lean();
        if (!item) throw new Error('One of the selected items was not found');
        return {
          item: item._id,
          name: item.name,
          quantity: Math.max(1, Number(entry.quantity || 1)),
          price: Math.max(0, Number(entry.price ?? 0))
        };
      }));
    }

    const setup = await Setup.create({
      name: req.body.name.trim(),
      description: req.body.description || '',
      finalPrice: hasPackageValue ? finalPrice : 0,
      gstRate: hasPackageValue ? gstRate : 0,
      items,
      createdBy: req.user._id
    });
    res.status(201).json({ ...setup.toObject(), id: String(setup._id) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Setup.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Setup not found' });
    res.json({ message: 'Setup deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;