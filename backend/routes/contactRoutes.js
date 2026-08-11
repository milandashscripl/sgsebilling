const express = require('express');
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const contacts = await Contact.find({ createdBy: req.user._id }).sort({ updatedAt: -1 }).lean();
    res.json(contacts.map((item) => ({ ...item, id: String(item._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const contact = await Contact.create({
      name: req.body.name,
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

router.put('/:contactId', auth, async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.contactId, createdBy: req.user._id },
      {
        name: req.body.name,
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
