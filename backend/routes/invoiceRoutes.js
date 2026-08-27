const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(invoices.map((invoice) => ({ ...invoice, id: String(invoice._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const {
      items = [],
      partyName,
      partyPhone,
      partyGSTIN,
      customerName,
      customerPhone,
      type,
      paidAmount,
      notes,
      subtotal: suppliedSubtotal,
      gstAmount: suppliedGstAmount,
      grandTotal: suppliedGrandTotal
    } = req.body;

    const invoiceItems = (items || []).map((item) => ({
      item: item.itemId ? new mongoose.Types.ObjectId(item.itemId) : item.item ? new mongoose.Types.ObjectId(item.item) : undefined,
      name: item.name || item.itemName || '',
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      sgstRate: Number(item.sgstRate || 0),
      cgstRate: Number(item.cgstRate || 0),
      igstRate: Number(item.igstRate || 0),
      total: Number(item.total || ((Number(item.quantity || 0) * Number(item.price || 0))))
    }));

    const grandTotal = invoiceItems.reduce((sum, it) => sum + (it.quantity * it.price), 0);
    const subtotal = invoiceItems.reduce((sum, it) => {
      const taxRate = Number(it.sgstRate || 0) + Number(it.cgstRate || 0) + Number(it.igstRate || 0);
      return sum + ((it.quantity * it.price) / (1 + taxRate / 100));
    }, 0);
    const gstAmount = grandTotal - subtotal;

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
      accountId: req.body.accountId || null,
      paymentMethod: req.body.paymentMethod || 'cash',
      items: invoiceItems,
      subtotal,
      gstAmount,
      grandTotal,
      paidAmount: paid,
      balance,
      paymentStatus,
      sellerName: req.user.shopName || req.user.name || 'SGSE Billing',
      sellerAddress: req.user.shopAddress || req.user.address || '',
      sellerGSTIN: req.user.shopGSTIN || '',
      sellerLogoUrl: req.user.shopLogoUrl || '',
      sellerPhone: req.user.phone || '',
      notes: notes || '',
      createdBy: req.user._id
    });

    if (paid > 0 && req.body.accountId) {
      const transactionType = type === 'purchase' ? 'expense' : 'income';
      await Transaction.create({
        date: new Date().toISOString().slice(0, 10),
        accountId: req.body.accountId,
        type: transactionType,
        amount: paid,
        paymentMethod: req.body.paymentMethod || 'cash',
        reference: `Invoice ${invoiceNumber}`,
        note: `Payment for invoice ${invoiceNumber}`,
        createdBy: req.user._id
      });
    }

    for (const entry of invoiceItems) {
      if (!entry.item) continue;
      const item = await Item.findById(entry.item);
      if (!item) continue;
      const quantity = Number(entry.quantity || 0);
      if (!quantity) continue;

      if (type === 'sale' || type === 'setup') {
        item.stock = Math.max(0, Number(item.stock || 0) - quantity);
      } else if (type === 'purchase' || type === 'return') {
        item.stock = Number(item.stock || 0) + quantity;
      }

      await item.save();
    }

    res.status(201).json({ ...invoice.toObject(), id: String(invoice._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
