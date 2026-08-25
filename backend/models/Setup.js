const mongoose = require('mongoose');

const setupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 0, min: 0 }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Setup', setupSchema);