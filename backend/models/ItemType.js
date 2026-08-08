const mongoose = require('mongoose');

const itemTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  unit: { type: String, default: 'pcs' },
  sgstRate: { type: Number, default: 0 },
  cgstRate: { type: Number, default: 0 },
  igstRate: { type: Number, default: 0 },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ItemType', itemTypeSchema);
