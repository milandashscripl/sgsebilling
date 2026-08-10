const express = require('express');
const auth = require('../middleware/auth');
const Item = require('../models/Item');
const Invoice = require('../models/Invoice');

const router = express.Router();

router.get('/summary', auth, async (req, res) => {
  try {
    const [salesCount, purchasesCount, returnsCount, invoiceCount, totalSales, totalPurchases, totalReturns] = await Promise.all([
      Invoice.countDocuments({ type: 'sale' }),
      Invoice.countDocuments({ type: 'purchase' }),
      Invoice.countDocuments({ type: 'return' }),
      Invoice.countDocuments(),
      Invoice.aggregate([{ $match: { type: 'sale' } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Invoice.aggregate([{ $match: { type: 'purchase' } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Invoice.aggregate([{ $match: { type: 'return' } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }])
    ]);

    res.json({
      totalSales: totalSales[0]?.total || 0,
      totalPurchases: totalPurchases[0]?.total || 0,
      totalReturns: totalReturns[0]?.total || 0,
      invoiceCount,
      salesCount,
      purchasesCount,
      returnsCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stock', auth, async (req, res) => {
  try {
    const items = await Item.find().sort({ stock: 1, name: 1 }).lean();
    res.json(items.map((item) => ({ ...item, id: String(item._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const sanitizeCsvValue = (value) => String(value || '').replace(/,/g, ' ').replace(/\r|\n/g, ' ');

router.get('/invoices/export', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find().lean();
    const csv = ['invoiceNumber,type,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
      .concat(invoices.map((inv) => `${sanitizeCsvValue(inv.invoiceNumber)},${sanitizeCsvValue(inv.type)},${sanitizeCsvValue(inv.partyName)},${sanitizeCsvValue(inv.partyPhone)},${sanitizeCsvValue(inv.partyGSTIN)},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${sanitizeCsvValue(inv.paymentStatus)}`))
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
    const items = await Item.find().lean();
    const csv = ['name,itemType,category,specification,unit,stock,purchasePrice,salePrice,sgstRate,cgstRate,igstRate']
      .concat(items.map((item) => `${sanitizeCsvValue(item.name)},${sanitizeCsvValue(item.itemType)},${sanitizeCsvValue(item.category)},${sanitizeCsvValue(item.specification)},${sanitizeCsvValue(item.unit)},${item.stock || 0},${item.purchasePrice || 0},${item.salePrice || 0},${item.sgstRate || 0},${item.cgstRate || 0},${item.igstRate || 0}`))
      .join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('stock.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const buildInvoiceExport = async (type) => {
  const invoices = await Invoice.find({ type }).lean();
  return ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
    .concat(invoices.map((inv) => `${sanitizeCsvValue(inv.invoiceNumber)},${sanitizeCsvValue(inv.partyName)},${sanitizeCsvValue(inv.partyPhone)},${sanitizeCsvValue(inv.partyGSTIN)},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${sanitizeCsvValue(inv.paymentStatus)}`))
    .join('\n');
};

router.get('/sales/export', auth, async (req, res) => {
  try {
    const csv = await buildInvoiceExport('sale');
    res.header('Content-Type', 'text/csv');
    res.attachment('sales.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/purchases/export', auth, async (req, res) => {
  try {
    const csv = await buildInvoiceExport('purchase');
    res.header('Content-Type', 'text/csv');
    res.attachment('purchases.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/returns/export', auth, async (req, res) => {
  try {
    const csv = await buildInvoiceExport('return');
    res.header('Content-Type', 'text/csv');
    res.attachment('returns.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
