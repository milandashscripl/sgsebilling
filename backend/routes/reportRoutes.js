const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

let invoices = [];
let items = [];

const rebuildStore = () => {
  const itemStore = global.__sgseItems || [];
  const invoiceStore = global.__sgseInvoices || [];
  items = itemStore;
  invoices = invoiceStore;
};

router.get('/summary', auth, async (req, res) => {
  rebuildStore();
  const totalSales = invoices.filter((x) => x.type === 'sale').reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalPurchases = invoices.filter((x) => x.type === 'purchase').reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalReturns = invoices.filter((x) => x.type === 'return').reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  res.json({ totalSales, totalPurchases, totalReturns, invoiceCount: invoices.length });
});

router.get('/stock', auth, async (req, res) => {
  rebuildStore();
  res.json(items.slice().sort((a, b) => (a.stock || 0) - (b.stock || 0) || a.name.localeCompare(b.name)));
});

router.get('/invoices/export', auth, async (req, res) => {
  rebuildStore();
  const csv = ['invoiceNumber,type,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
    .concat(invoices.map((inv) => `${inv.invoiceNumber},${inv.type},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
    .join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('invoices.csv');
  res.send(csv);
});

router.get('/stock/export', auth, async (req, res) => {
  rebuildStore();
  const csv = ['name,itemType,category,specification,unit,stock,purchasePrice,salePrice,sgstRate,cgstRate,igstRate']
    .concat(items.map((item) => `${item.name},${item.itemType || ''},${(item.category || '').replace(/,/g, ' ')},${(item.specification || '').replace(/,/g, ' ')},${item.unit || ''},${item.stock || 0},${item.purchasePrice || 0},${item.salePrice || 0},${item.sgstRate || 0},${item.cgstRate || 0},${item.igstRate || 0}`))
    .join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('stock.csv');
  res.send(csv);
});

router.get('/sales/export', auth, async (req, res) => {
  rebuildStore();
  const csv = ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
    .concat(invoices.filter((inv) => inv.type === 'sale').map((inv) => `${inv.invoiceNumber},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
    .join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('sales.csv');
  res.send(csv);
});

router.get('/purchases/export', auth, async (req, res) => {
  rebuildStore();
  const csv = ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
    .concat(invoices.filter((inv) => inv.type === 'purchase').map((inv) => `${inv.invoiceNumber},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
    .join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('purchases.csv');
  res.send(csv);
});

router.get('/returns/export', auth, async (req, res) => {
  rebuildStore();
  const csv = ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus']
    .concat(invoices.filter((inv) => inv.type === 'return').map((inv) => `${inv.invoiceNumber},${(inv.partyName || '').replace(/,/g, ' ')},${(inv.partyPhone || '').replace(/,/g, ' ')},${(inv.partyGSTIN || '').replace(/,/g, ' ')},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${inv.paymentStatus}`))
    .join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('returns.csv');
  res.send(csv);
});

module.exports = router;
