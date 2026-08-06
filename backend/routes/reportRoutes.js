const express = require('express');
const auth = require('../middleware/auth');
const Invoice = require('../models/Invoice');

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

module.exports = router;
