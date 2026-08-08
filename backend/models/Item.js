const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  itemTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemType' },
  itemType: { type: String, default: 'other' },
  category: { type: String, default: 'General' },
  specification: { type: String, default: '' },
  unit: { type: String, default: 'pcs' },
  purchasePrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
  sgstRate: { type: Number, default: 0 },
  cgstRate: { type: Number, default: 0 },
  igstRate: { type: Number, default: 0 },
  stock: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
