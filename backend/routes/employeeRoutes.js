const express = require('express');
const auth = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');

const router = express.Router();
const CHECK_IN_DEADLINE = '09:30';
const CHECK_OUT_START = '19:30';

const getAttendanceStatus = (checkIn, checkOut) => {
  if (!checkIn) return 'absent';
  if (!checkOut || checkIn > CHECK_IN_DEADLINE || checkOut < CHECK_OUT_START) return 'halfday';
  return 'present';
};

const getMonthRange = (month) => {
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  const current = new Date();
  const selectedYear = year || current.getFullYear();
  const selectedMonth = monthNumber || current.getMonth() + 1;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  return {
    month: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
    start: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
    end: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth
  };
};

router.get('/', auth, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ active: -1, name: 1 }).lean();
    res.json(employees.map((employee) => ({ ...employee, id: String(employee._id) })));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      monthlySalary: Number(req.body.monthlySalary || 0),
      monthlyAdvance: Number(req.body.monthlyAdvance || 0),
      fuelAllowance: Number(req.body.fuelAllowance || 0),
      homeRentAllowance: Number(req.body.homeRentAllowance || 0),
      incentive: Number(req.body.incentive || 0),
      otherAllowance: Number(req.body.otherAllowance || 0),
      personalDetails: req.body.personalDetails || {},
      salaryAdjustments: req.body.salaryAdjustments || {},
      createdBy: req.user._id
    };
    const employee = await Employee.create(payload);
    res.status(201).json({ ...employee.toObject(), id: String(employee._id) });
  } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'Employee ID already exists' : error.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      monthlySalary: Number(req.body.monthlySalary || 0),
      monthlyAdvance: Number(req.body.monthlyAdvance || 0),
      fuelAllowance: Number(req.body.fuelAllowance || 0),
      homeRentAllowance: Number(req.body.homeRentAllowance || 0),
      incentive: Number(req.body.incentive || 0),
      otherAllowance: Number(req.body.otherAllowance || 0),
      personalDetails: req.body.personalDetails || {},
      salaryAdjustments: req.body.salaryAdjustments || {}
    };
    const employee = await Employee.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).lean();
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ ...employee, id: String(employee._id) });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    await Attendance.deleteMany({ employee: req.params.id });
    res.json({ message: 'Employee deleted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/:id/attendance', auth, async (req, res) => {
  try {
    const range = getMonthRange(req.query.month);
    const records = await Attendance.find({ employee: req.params.id, date: { $gte: range.start, $lte: range.end } }).sort({ date: 1 }).lean();
    res.json({ month: range.month, daysInMonth: range.daysInMonth, records });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/:id/attendance', auth, async (req, res) => {
  try {
    const { date, checkIn = '', checkOut = '', note = '' } = req.body;
    if (!date) return res.status(400).json({ message: 'Attendance date is required' });
    const record = await Attendance.findOneAndUpdate({ employee: req.params.id, date }, { checkIn, checkOut, note, status: getAttendanceStatus(checkIn, checkOut), createdBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    res.json(record);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/:id/payslip', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).lean();
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    const range = getMonthRange(req.query.month);
    const records = await Attendance.find({ employee: employee._id, date: { $gte: range.start, $lte: range.end } }).lean();
    const present = records.filter((record) => record.status === 'present').length;
    const halfday = records.filter((record) => record.status === 'halfday').length;
    const absent = Math.max(0, range.daysInMonth - present - halfday);
    const payableDays = present + halfday * 0.5;
    const dailySalary = Number(employee.monthlySalary || 0) / range.daysInMonth;
    const earnedSalary = dailySalary * payableDays;
    const adjustments = employee.salaryAdjustments || {};
    const manualAdvance = Number(adjustments.advance || employee.monthlyAdvance || 0);
    const manualBonus = Number(adjustments.bonus || 0);
    const manualIncentive = Number(adjustments.incentive || 0);
    const manualDeduction = Number(adjustments.deduction || 0);
    const fuelAllowance = Number(employee.fuelAllowance || 0);
    const homeRentAllowance = Number(employee.homeRentAllowance || 0);
    const allowances = fuelAllowance + homeRentAllowance + Number(employee.incentive || 0) + Number(employee.otherAllowance || 0) + manualBonus + manualIncentive;
    const basicSalary = earnedSalary;
    const totalEarnings = basicSalary + fuelAllowance + homeRentAllowance + manualBonus + manualIncentive;
    const gross = totalEarnings;
    const totalDeductions = manualAdvance + manualDeduction;
    const netPay = Math.max(0, gross - totalDeductions);
    res.json({
      employee,
      month: range.month,
      daysInMonth: range.daysInMonth,
      present,
      halfday,
      absent,
      payableDays,
      basicSalary,
      fuelAllowance,
      homeRentAllowance,
      earnedSalary: basicSalary,
      allowances,
      totalEarnings,
      gross,
      advance: manualAdvance,
      bonus: manualBonus,
      incentive: manualIncentive,
      deduction: manualDeduction,
      totalDeductions,
      adjustmentNote: adjustments.note || '',
      netPay,
      records
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
