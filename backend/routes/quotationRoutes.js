const express = require('express');
const auth = require('../middleware/auth');
const Quotation = require('../models/Quotation');

const router = express.Router();
const ownerFilter = (req) => ({ createdBy: req.user._id });

router.get('/', auth, async (req, res) => {
  try {
    const quotations = await Quotation.find(ownerFilter(req)).sort({ updatedAt: -1 }).lean();
    res.json(quotations.map((quotation) => ({ ...quotation, id: String(quotation._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const quote = await Quotation.create({
      quoteNumber: `Q-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      clientName: String(req.body.clientName || '').trim(),
      calculations: req.body.calculations || {},
      data: req.body,
      companyName: req.body.companyName || req.user.shopName || 'SGSE Billing',
      createdBy: req.user._id
    });
    res.status(201).json({ ...quote.toObject(), id: String(quote._id) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const quote = await Quotation.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req) },
      { clientName: String(req.body.clientName || '').trim(), calculations: req.body.calculations || {}, data: req.body, companyName: req.body.companyName || req.user.shopName || 'SGSE Billing' },
      { new: true, runValidators: true }
    ).lean();
    if (!quote) return res.status(404).json({ message: 'Quotation not found' });
    res.json({ ...quote, id: String(quote._id) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const quote = await Quotation.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
    if (!quote) return res.status(404).json({ message: 'Quotation not found' });
    res.json({ message: 'Quotation deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
