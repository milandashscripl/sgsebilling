const express = require('express');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Item = require('../models/Item');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).populate('items.item');
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { items, partyName, partyPhone, partyGSTIN, customerName, customerPhone, type, paidAmount, notes } = req.body;
    const invoiceNumber = `INV-${Date.now()}`;

    const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.price), 0);
    const gstAmount = items.reduce((sum, it) => {
      const sgst = ((it.quantity * it.price) * (it.sgstRate || 0) / 100);
      const cgst = ((it.quantity * it.price) * (it.cgstRate || 0) / 100);
      const igst = ((it.quantity * it.price) * (it.igstRate || 0) / 100);
      return sum + sgst + cgst + igst;
    }, 0);
    const grandTotal = subtotal + gstAmount;
    const balance = grandTotal - (paidAmount || 0);
    const paymentStatus = balance <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');

    const invoice = new Invoice({
      invoiceNumber,
      partyName: partyName || customerName || 'Walk-in Customer',
      partyPhone: partyPhone || customerPhone || '',
      partyGSTIN: partyGSTIN || '',
      customerName: customerName || partyName || 'Walk-in Customer',
      customerPhone: customerPhone || partyPhone || '',
      type,
      items,
      subtotal,
      gstAmount,
      grandTotal,
      paidAmount: paidAmount || 0,
      balance,
      paymentStatus,
      notes,
      createdBy: req.user._id
    });

    await invoice.save();

    for (const entry of items) {
      if (entry.item) {
        await Item.findByIdAndUpdate(entry.item, { $inc: { stock: type === 'sale' ? -entry.quantity : entry.quantity } });
      }
    }

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
