const express = require('express');
const auth = require('../middleware/auth');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');

const router = express.Router();

const getAccountBalance = async (accountId, openingBalance) => {
  const [incomeTotal, expenseTotal, expenseOutflow] = await Promise.all([
    Transaction.aggregate([
      { $match: { accountId, type: 'income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.aggregate([
      { $match: { accountId, type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Expense.aggregate([
      { $match: { accountId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  return openingBalance + (incomeTotal[0]?.total || 0) - (expenseTotal[0]?.total || 0) - (expenseOutflow[0]?.total || 0);
};

router.get('/accounts', auth, async (req, res) => {
  try {
    const accounts = await Account.find().sort({ name: 1 }).lean();
    const results = await Promise.all(accounts.map(async (account) => ({
      ...account,
      id: String(account._id),
      balance: await getAccountBalance(account._id, Number(account.openingBalance || 0))
    })));

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/accounts', auth, async (req, res) => {
  try {
    const account = await Account.create({
      name: req.body.name,
      type: req.body.type || 'cash',
      openingBalance: Number(req.body.openingBalance || 0),
      notes: req.body.notes || '',
      createdBy: req.user._id
    });
    res.status(201).json({ ...account.toObject(), id: String(account._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 }).lean();
    res.json(transactions.map((transaction) => ({ ...transaction, id: String(transaction._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/transactions', auth, async (req, res) => {
  try {
    const transaction = await Transaction.create({
      date: req.body.date || new Date().toISOString().slice(0, 10),
      accountId: req.body.accountId,
      type: req.body.type || 'income',
      amount: Number(req.body.amount || 0),
      paymentMethod: req.body.paymentMethod || 'cash',
      reference: req.body.reference || '',
      note: req.body.note || '',
      createdBy: req.user._id
    });
    res.status(201).json({ ...transaction.toObject(), id: String(transaction._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/expenses', auth, async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 }).lean();
    res.json(expenses.map((expense) => ({ ...expense, id: String(expense._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/expenses', auth, async (req, res) => {
  try {
    const expense = await Expense.create({
      date: req.body.date || new Date().toISOString().slice(0, 10),
      category: req.body.category || 'General',
      amount: Number(req.body.amount || 0),
      accountId: req.body.accountId,
      paymentMethod: req.body.paymentMethod || 'cash',
      note: req.body.note || '',
      createdBy: req.user._id
    });
    res.status(201).json({ ...expense.toObject(), id: String(expense._id) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/summary', auth, async (req, res) => {
  try {
    const [incomeTotalAgg, expenseTotalAgg, accountsData, paymentMethodIncome, paymentMethodExpense] = await Promise.all([
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Account.find().sort({ name: 1 }).lean(),
      Transaction.aggregate([{ $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }])
    ]);

    const accounts = await Promise.all(accountsData.map(async (account) => ({
      ...account,
      id: String(account._id),
      balance: await getAccountBalance(account._id, Number(account.openingBalance || 0))
    })));

    const paymentMethodsMap = {};
    paymentMethodIncome.forEach((entry) => {
      if (!entry._id) return;
      paymentMethodsMap[entry._id] = (paymentMethodsMap[entry._id] || 0) + entry.total;
    });
    paymentMethodExpense.forEach((entry) => {
      if (!entry._id) return;
      paymentMethodsMap[entry._id] = (paymentMethodsMap[entry._id] || 0) - entry.total;
    });

    const paymentMethods = Object.entries(paymentMethodsMap).map(([method, total]) => ({ method, total }));

    res.json({
      accounts,
      incomeTotal: incomeTotalAgg[0]?.total || 0,
      expenseTotal: expenseTotalAgg[0]?.total || 0,
      paymentMethods
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
