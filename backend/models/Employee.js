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
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
