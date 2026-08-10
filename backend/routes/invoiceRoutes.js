const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean();
    res.json(invoices.map((invoice) => ({ ...invoice, id: String(invoice._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { items = [], partyName, partyPhone, partyGSTIN, customerName, customerPhone, type, paidAmount, notes } = req.body;
    const invoiceItems = (items || []).map((item) => ({
      item: item.itemId ? mongoose.Types.ObjectId(item.itemId) : undefined,
      name: item.name || item.itemName || '',
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      sgstRate: Number(item.sgstRate || 0),
      cgstRate: Number(item.cgstRate || 0),
      igstRate: Number(item.igstRate || 0),
      total: Number(item.total || ((Number(item.quantity || 0) * Number(item.price || 0))))
    }));

    const subtotal = invoiceItems.reduce((sum, it) => sum + (it.total || (it.quantity * it.price)), 0);
    const gstAmount = invoiceItems.reduce((sum, it) => {
      const amount = it.quantity * it.price;
      const sgst = (amount * (it.sgstRate || 0) / 100);
      const cgst = (amount * (it.cgstRate || 0) / 100);
      const igst = (amount * (it.igstRate || 0) / 100);
      return sum + sgst + cgst + igst;
    }, 0);
    const grandTotal = subtotal + gstAmount;
    const paid = Number(paidAmount || 0);
    const balance = grandTotal - paid;
    const paymentStatus = balance <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      partyName: partyName || customerName || 'Walk-in Customer',
      partyPhone: partyPhone || customerPhone || '',
      partyGSTIN: partyGSTIN || '',
      customerName: customerName || partyName || 'Walk-in Customer',
      customerPhone: customerPhone || partyPhone || '',
      type: type || 'sale',
      items: invoiceItems,
      subtotal,
      gstAmount,
      grandTotal,
      paidAmount: paid,
      balance,
      paymentStatus,
      notes: notes || '',
      createdBy: req.user._id
    });

    res.status(201).json({ ...invoice.toObject(), id: String(invoice._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
