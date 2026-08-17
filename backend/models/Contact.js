const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  consumerNumber: { type: String, trim: true, default: '' },
  callerName: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['Hot Lead', 'Warm Lead', 'Cool Lead', 'May Convert', 'Not Interested', 'Following Up', 'Not Yet Called', 'No Response'],
    default: 'Not Yet Called'
  },
  review: { type: String, default: '' },
  followUpStrategy: { type: String, default: '' },
  followUpCount: { type: Number, default: 0 },
  lastContacted: { type: Date, default: null },
  nextFollowUp: { type: Date, default: null },
  callHistory: [{
    timestamp: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: '' },
    outcome: { type: String, trim: true, default: 'Contacted' },
    status: { type: String, trim: true, default: 'Warm Lead' }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
