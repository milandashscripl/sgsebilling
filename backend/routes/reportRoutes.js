const express = require('express');
const auth = require('../middleware/auth');
const Item = require('../models/Item');
const Invoice = require('../models/Invoice');
const Contact = require('../models/Contact');

const router = express.Router();

const sanitizeCsvValue = (value) => String(value || '').replace(/,/g, ' ').replace(/\r|\n/g, ' ');

const applyDateRange = (req, filter, field) => {
  const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
  const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
  const range = {};

  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    range.$gte = fromDate;
  }
  if (toDate && !Number.isNaN(toDate.getTime())) {
    toDate.setHours(23, 59, 59, 999);
    range.$lte = toDate;
  }
  if (Object.keys(range).length) {
    filter[field] = range;
  }
};

router.get('/summary', auth, async (req, res) => {
  try {
    const dateFilter = {};
    applyDateRange(req, dateFilter, 'createdAt');

    const [salesCount, purchasesCount, returnsCount, invoiceCount, totalSales, totalPurchases, totalReturns] = await Promise.all([
      Invoice.countDocuments({ type: 'sale', ...dateFilter }),
      Invoice.countDocuments({ type: 'purchase', ...dateFilter }),
      Invoice.countDocuments({ type: 'return', ...dateFilter }),
      Invoice.countDocuments({ ...dateFilter }),
      Invoice.aggregate([
        { $match: { type: 'sale', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Invoice.aggregate([
        { $match: { type: 'purchase', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      Invoice.aggregate([
        { $match: { type: 'return', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ])
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
    const search = (req.query.search || '').trim();
    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    applyDateRange(req, filter, 'updatedAt');
    const items = await Item.find(filter).sort({ stock: 1, name: 1 }).lean();
    res.json(items.map((item) => ({ ...item, id: String(item._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/invoices', auth, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = {};

    if (search) {
      filter.$or = [
        { partyName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }

    applyDateRange(req, filter, 'createdAt');
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).lean();
    res.json(invoices.map((invoice) => ({ ...invoice, id: String(invoice._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/invoices/export', auth, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = {};

    if (search) {
      filter.$or = [
        { partyName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }

    applyDateRange(req, filter, 'createdAt');
    const invoices = await Invoice.find(filter).lean();
    const csv = ['invoiceNumber,type,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus,createdAt']
      .concat(invoices.map((inv) => `${sanitizeCsvValue(inv.invoiceNumber)},${sanitizeCsvValue(inv.type)},${sanitizeCsvValue(inv.partyName)},${sanitizeCsvValue(inv.partyPhone)},${sanitizeCsvValue(inv.partyGSTIN)},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${sanitizeCsvValue(inv.paymentStatus)},${inv.createdAt ? inv.createdAt.toISOString() : ''}`))
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
    const search = (req.query.search || '').trim();
    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    applyDateRange(req, filter, 'updatedAt');
    const items = await Item.find(filter).lean();
    const csv = ['name,itemType,category,specification,unit,stock,purchasePrice,salePrice,sgstRate,cgstRate,igstRate,updatedAt']
      .concat(items.map((item) => `${sanitizeCsvValue(item.name)},${sanitizeCsvValue(item.itemType)},${sanitizeCsvValue(item.category)},${sanitizeCsvValue(item.specification)},${sanitizeCsvValue(item.unit)},${item.stock || 0},${item.purchasePrice || 0},${item.salePrice || 0},${item.sgstRate || 0},${item.cgstRate || 0},${item.igstRate || 0},${item.updatedAt ? item.updatedAt.toISOString() : ''}`))
      .join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('stock.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const buildInvoiceExport = async (type, req) => {
  const filter = { type };
  applyDateRange(req, filter, 'createdAt');
  const invoices = await Invoice.find(filter).lean();
  return ['invoiceNumber,partyName,partyPhone,partyGSTIN,subtotal,gstAmount,grandTotal,paymentStatus,createdAt']
    .concat(invoices.map((inv) => `${sanitizeCsvValue(inv.invoiceNumber)},${sanitizeCsvValue(inv.partyName)},${sanitizeCsvValue(inv.partyPhone)},${sanitizeCsvValue(inv.partyGSTIN)},${inv.subtotal || 0},${inv.gstAmount || 0},${inv.grandTotal || 0},${sanitizeCsvValue(inv.paymentStatus)},${inv.createdAt ? inv.createdAt.toISOString() : ''}`))
    .join('\n');
};

router.get('/sales/export', auth, async (req, res) => {
  try {
    const csv = await buildInvoiceExport('sale', req);
    res.header('Content-Type', 'text/csv');
    res.attachment('sales.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/purchases/export', auth, async (req, res) => {
  try {
    const csv = await buildInvoiceExport('purchase', req);
    res.header('Content-Type', 'text/csv');
    res.attachment('purchases.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/returns/export', auth, async (req, res) => {
  try {
    const csv = await buildInvoiceExport('return', req);
    res.header('Content-Type', 'text/csv');
    res.attachment('returns.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/calling/export', auth, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { callerName: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
      ];
    }

    applyDateRange(req, filter, 'lastContacted');
    const contacts = await Contact.find(filter).lean();
    
    const rows = ['contactName,callerName,contactNumber,consumerNumber,status,totalCalls,lastContacted,review'];
    contacts.forEach((contact) => {
      const totalCalls = (contact.callHistory || []).length;
      rows.push(
        `${sanitizeCsvValue(contact.name)},${sanitizeCsvValue(contact.callerName || 'Not assigned')},${sanitizeCsvValue(contact.contactNumber)},${sanitizeCsvValue(contact.consumerNumber)},${sanitizeCsvValue(contact.status)},${totalCalls},${contact.lastContacted ? contact.lastContacted.toISOString() : 'Never'},${sanitizeCsvValue(contact.review)}`
      );
    });

    const csv = rows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('calling-report.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/calling', auth, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { callerName: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
      ];
    }

    applyDateRange(req, filter, 'lastContacted');
    const contacts = await Contact.find(filter).sort({ lastContacted: -1 }).lean();
    res.json(contacts.map((contact) => ({ ...contact, id: String(contact._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/daily-progress', auth, async (req, res) => {
  try {
    const requestedDate = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(requestedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const contacts = await Contact.find({ createdBy: req.user._id }).lean();
    const callsToday = contacts.flatMap((contact) => (contact.callHistory || []).map((call) => ({ contact, call })))
      .filter(({ call }) => new Date(call.timestamp) >= start && new Date(call.timestamp) < end);
    const statusCounts = {};
    callsToday.forEach(({ call }) => { statusCounts[call.status || 'Unknown'] = (statusCounts[call.status || 'Unknown'] || 0) + 1; });
    res.json({
      date: start.toISOString().slice(0, 10),
      totalContacts: contacts.length,
      callsToday: callsToday.length,
      contactedToday: callsToday.filter(({ call }) => call.outcome === 'Contacted').length,
      followUpsToday: callsToday.filter(({ call }) => call.outcome === 'Follow-up').length,
      newLeadsToday: contacts.filter((contact) => contact.createdAt >= start && contact.createdAt < end).length,
      statusCounts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
