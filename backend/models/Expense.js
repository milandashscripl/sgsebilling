const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, default: 0 },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  paymentMethod: { type: String, default: 'cash' },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
