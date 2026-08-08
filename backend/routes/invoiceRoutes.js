const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const invoices = global.__sgseInvoices || (global.__sgseInvoices = []);
let nextId = global.__sgseInvoiceNextId || 1;

router.get('/', auth, async (req, res) => {
  res.json(invoices.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
});

router.post('/', auth, async (req, res) => {
  const { items = [], partyName, partyPhone, partyGSTIN, customerName, customerPhone, type, paidAmount, notes } = req.body;
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

  const invoice = {
    _id: String(nextId++),
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
    createdBy: req.user?.id,
    createdAt: Date.now()
  };

  global.__sgseInvoiceNextId = nextId;
  invoices.push(invoice);
  res.status(201).json(invoice);
});

module.exports = router;
