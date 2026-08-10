const express = require('express');
const auth = require('../middleware/auth');
const Category = require('../models/Category');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 }).lean();
    res.json(categories.map((category) => ({ ...category, id: String(category._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const category = await Category.create({
      name: req.body.name,
      description: req.body.description || '',
      createdBy: req.user._id
    });
    res.status(201).json({ ...category.toObject(), id: String(category._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        description: req.body.description
      },
      { new: true, runValidators: true }
    ).lean();

    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ ...category, id: String(category._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
