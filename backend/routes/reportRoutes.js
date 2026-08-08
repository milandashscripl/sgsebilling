const express = require('express');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Item = require('../models/Item');

const router = express.Router();

router.get('/summary', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find();
    const totalSales = invoices.filter(x => x.type === 'sale').reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalPurchases = invoices.filter(x => x.type === 'purchase').reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalReturns = invoices.filter(x => x.type === 'return').reduce((sum, inv) => sum + inv.grandTotal, 0);

    res.json({ totalSales, totalPurchases, totalReturns, invoiceCount: invoices.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stock', auth, async (req, res) => {
  try {
    const items = await Item.find().sort({ stock: 1, name: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/invoices/export', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    const csv = ['invoiceNumber,type,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
      .concat(invoices.map(inv => `${inv.invoiceNumber},${inv.type},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
      .join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('invoices.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stock/export', auth, async (req, res) => {
  try {
    const items = await Item.find().sort({ name: 1 });
    const csv = ['name,itemType,category,specification,unit,stock,purchasePrice,salePrice,sgstRate,cgstRate,igstRate']
      .concat(items.map(item => `${item.name},${item.itemType || ''},${(item.category || '').replace(/,/g, ' ')},${(item.specification || '').replace(/,/g, ' ')},${item.unit || ''},${item.stock || 0},${item.purchasePrice || 0},${item.salePrice || 0},${item.sgstRate || 0},${item.cgstRate || 0},${item.igstRate || 0}`))
      .join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('stock.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/sales/export', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ type: 'sale' }).sort({ createdAt: -1 });
    const csv = ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
      .concat(invoices.map(inv => `${inv.invoiceNumber},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
      .join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('sales.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/purchases/export', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ type: 'purchase' }).sort({ createdAt: -1 });
    const csv = ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
      .concat(invoices.map(inv => `${inv.invoiceNumber},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
      .join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('purchases.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/returns/export', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ type: 'return' }).sort({ createdAt: -1 });
    const csv = ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
      .concat(invoices.map(inv => `${inv.invoiceNumber},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
      .join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('returns.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
