const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  role: { type: String, default: 'Staff' },
  joiningDate: { type: String, default: '' },
  monthlySalary: { type: Number, default: 0 },
  monthlyAdvance: { type: Number, default: 0 },
  fuelAllowance: { type: Number, default: 0 },
  incentive: { type: Number, default: 0 },
  otherAllowance: { type: Number, default: 0 },
  personalDetails: {
    address: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    pan: { type: String, default: '' },
    aadhaar: { type: String, default: '' },
    emergencyContact: { type: String, default: '' }
  },
  salaryAdjustments: {
    advance: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    note: { type: String, default: '' }
  },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
