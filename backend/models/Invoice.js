const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  customerName: { type: String, default: 'Walk-in Customer' },
  customerPhone: { type: String, default: '' },
  type: { type: String, enum: ['sale', 'purchase', 'return'], default: 'sale' },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    name: String,
    quantity: Number,
    price: Number,
    gstRate: Number,
    total: Number
  }],
  subtotal: Number,
  gstAmount: Number,
  grandTotal: Number,
  paidAmount: Number,
  balance: Number,
  paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
