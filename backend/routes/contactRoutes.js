const express = require('express');
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');

const router = express.Router();

const normalizeValue = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const findDuplicateConsumer = async (consumerNumber, userId, contactId = null) => {
  const normalized = normalizeValue(consumerNumber);
  if (!normalized) return null;
  const contacts = await Contact.find({ createdBy: userId, consumerNumber: { $nin: ['', null] } }).select('consumerNumber').lean();
  return contacts.find((contact) => normalizeValue(contact.consumerNumber) === normalized && String(contact._id) !== String(contactId)) || null;
};

router.get('/', auth, async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      filter.createdAt = { ...filter.createdAt, $gte: fromDate };
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt = { ...filter.createdAt, $lte: toDate };
    }

    const contacts = await Contact.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(contacts.map((item) => ({ ...item, id: String(item._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/export', auth, async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      filter.createdAt = { ...filter.createdAt, $gte: fromDate };
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt = { ...filter.createdAt, $lte: toDate };
    }

    const contacts = await Contact.find(filter).lean();
    const csv = ['name,callerName,contactNumber,consumerNumber,status,review,followUpStrategy,followUpCount,lastContacted,nextFollowUp,createdAt']
      .concat(contacts.map((contact) => [
        sanitizeCsvValue(contact.name),
        sanitizeCsvValue(contact.callerName),
        sanitizeCsvValue(contact.contactNumber),
        sanitizeCsvValue(contact.consumerNumber),
        sanitizeCsvValue(contact.status),
        sanitizeCsvValue(contact.review),
        sanitizeCsvValue(contact.followUpStrategy),
        contact.followUpCount || 0,
        contact.lastContacted ? contact.lastContacted.toISOString() : '',
        contact.nextFollowUp ? contact.nextFollowUp.toISOString() : '',
        contact.createdAt ? contact.createdAt.toISOString() : ''
      ].join(','))).join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('contacts.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const sanitizeCsvValue = (value) => String(value || '').replace(/,/g, ' ').replace(/\r|\n/g, ' ');

router.post('/', auth, async (req, res) => {
  try {
    const duplicate = await findDuplicateConsumer(req.body.consumerNumber, req.user._id);
    if (duplicate) return res.status(409).json({ message: `Consumer number already exists on contact ${duplicate.consumerNumber}` });
    const contact = await Contact.create({
      name: req.body.name,
      callerName: req.body.callerName || '',
      contactNumber: req.body.contactNumber,
      consumerNumber: req.body.consumerNumber || '',
      status: req.body.status || 'Warm Lead',
      review: req.body.review || '',
      followUpStrategy: req.body.followUpStrategy || '',
      followUpCount: Number(req.body.followUpCount || 0),
      lastContacted: req.body.lastContacted || null,
      nextFollowUp: req.body.nextFollowUp || null,
      createdBy: req.user._id
    });
    res.status(201).json({ ...contact.toObject(), id: String(contact._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:contactId/calls', auth, async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.contactId, createdBy: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
    const outcome = req.body.outcome || 'Contacted';
    const status = req.body.statusOnCall || contact.status || 'Warm Lead';

    contact.callHistory = contact.callHistory || [];
    contact.callHistory.push({
      callerName: req.body.callerName || contact.callerName || 'Not assigned',
      timestamp,
      note: req.body.note || '',
      outcome,
      status
    });
    contact.lastContacted = timestamp;
    contact.status = status;
    contact.followUpCount = Number(contact.followUpCount || 0) + 1;

    await contact.save();
    res.json({ ...contact.toObject(), id: String(contact._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:contactId', auth, async (req, res) => {
  try {
    const duplicate = await findDuplicateConsumer(req.body.consumerNumber, req.user._id, req.params.contactId);
    if (duplicate) return res.status(409).json({ message: `Consumer number already exists on contact ${duplicate.consumerNumber}` });
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.contactId, createdBy: req.user._id },
      {
        name: req.body.name,
        callerName: req.body.callerName || '',
        contactNumber: req.body.contactNumber,
        consumerNumber: req.body.consumerNumber || '',
        status: req.body.status || 'Warm Lead',
        review: req.body.review || '',
        followUpStrategy: req.body.followUpStrategy || '',
        followUpCount: Number(req.body.followUpCount || 0),
        lastContacted: req.body.lastContacted || null,
        nextFollowUp: req.body.nextFollowUp || null
      },
      { new: true }
    );
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    res.json({ ...contact.toObject(), id: String(contact._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:contactId', auth, async (req, res) => {
  try {
    const deleted = await Contact.findOneAndDelete({ _id: req.params.contactId, createdBy: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Contact not found' });
    res.json({ message: 'Contact removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
