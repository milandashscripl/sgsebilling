const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  quoteNumber: { type: String, required: true },
  clientName: { type: String, required: true, trim: true },
  calculations: { type: mongoose.Schema.Types.Mixed, default: {} },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  companyName: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

quotationSchema.index({ createdBy: 1, createdAt: -1 });
quotationSchema.index({ createdBy: 1, quoteNumber: 1 }, { unique: true });

module.exports = mongoose.model('Quotation', quotationSchema);
