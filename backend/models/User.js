const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'caller'], default: 'user' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  shopName: { type: String, default: 'SGSE Billing' },
  shopAddress: { type: String, default: '' },
  shopGSTIN: { type: String, default: '' },
  shopLogoUrl: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  proprietorName: { type: String, default: '' },
  bankName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },
  accountHolderName: { type: String, default: '' },
  appSettings: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
