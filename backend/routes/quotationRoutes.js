const express = require('express');
const auth = require('../middleware/auth');
const Quotation = require('../models/Quotation');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authStore } = require('../utils/authStore');

const router = express.Router();
const ownerFilter = (req) => ({ createdBy: req.user._id });

router.get('/settings', auth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(req.user._id).select('appSettings').lean();
      return res.json(user?.appSettings?.quotationCenter || {});
    }
    res.json(authStore.findUserById(req.user._id)?.appSettings?.quotationCenter || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/settings', auth, async (req, res) => {
  try {
    const settings = {
      companyName: String(req.body.companyName || req.user.shopName || 'SGSE Billing').trim().slice(0, 120),
      gstNumber: String(req.body.gstNumber || '').trim().slice(0, 30),
      tagline: String(req.body.tagline || '').trim().slice(0, 180),
      about: String(req.body.about || '').trim().slice(0, 500),
      defaultTariff: Math.max(0, Number(req.body.defaultTariff || 5)),
      defaultValidity: Math.max(1, Number(req.body.defaultValidity || 15)),
      panelBrands: Array.isArray(req.body.panelBrands) ? req.body.panelBrands.slice(0, 20).map((value) => String(value).trim()).filter(Boolean) : [],
      inverterBrands: Array.isArray(req.body.inverterBrands) ? req.body.inverterBrands.slice(0, 20).map((value) => String(value).trim()).filter(Boolean) : []
    };
    if (mongoose.connection.readyState === 1) {
      await User.findByIdAndUpdate(req.user._id, { $set: { 'appSettings.quotationCenter': settings } });
    } else {
      const user = authStore.findUserById(req.user._id);
      if (user) user.appSettings = { ...(user.appSettings || {}), quotationCenter: settings };
    }
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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
