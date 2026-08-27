const express = require('express');
const auth = require('../middleware/auth');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Invoice = require('../models/Invoice');

const router = express.Router();

const getAccountBalance = async (accountId, openingBalance, userId) => {
  const id = accountId.toString();
  const matchStage = { $match: { createdBy: userId, $or: [{ accountId }, { accountId: id }] } };
  const [incomeTotal, expenseTotal, expenseOutflow] = await Promise.all([
    Transaction.aggregate([matchStage, { $match: { type: 'income' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.aggregate([matchStage, { $match: { type: 'expense' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { $or: [{ accountId }, { accountId: id }] } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);

  return openingBalance + (incomeTotal[0]?.total || 0) - (expenseTotal[0]?.total || 0) - (expenseOutflow[0]?.total || 0);
};

router.get('/accounts', auth, async (req, res) => {
  try {
    const accounts = await Account.find({ createdBy: req.user._id }).sort({ name: 1 }).lean();
    const results = await Promise.all(accounts.map(async (account) => ({
      ...account,
      id: String(account._id),
      balance: await getAccountBalance(account._id, Number(account.openingBalance || 0), req.user._id)
    })));

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/transfer', auth, async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, note } = req.body;
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Enter a valid amount' });
    if (!fromAccountId || !toAccountId) return res.status(400).json({ message: 'Select both accounts' });
    if (fromAccountId === toAccountId) return res.status(400).json({ message: 'Source and destination must differ' });

    const [fromAcc, toAcc] = await Promise.all([
      Account.findOne({ _id: fromAccountId, createdBy: req.user._id }),
      Account.findOne({ _id: toAccountId, createdBy: req.user._id })
    ]);
    if (!fromAcc || !toAcc) return res.status(404).json({ message: 'Account not found' });

    const fromBalance = await getAccountBalance(fromAcc._id, Number(fromAcc.openingBalance || 0), req.user._id);
    if (fromBalance < amt) return res.status(400).json({ message: `Insufficient balance in ${fromAcc.name}` });

    const dateStr = new Date().toISOString().slice(0, 10);
    const transferNote = note || `Transfer: ${fromAcc.name} → ${toAcc.name}`;

    await Promise.all([
      Transaction.create({ date: dateStr, accountId: fromAcc._id, type: 'expense', amount: amt, paymentMethod: 'transfer', reference: 'Fund Transfer', note: transferNote, createdBy: req.user._id }),
      Transaction.create({ date: dateStr, accountId: toAcc._id, type: 'income', amount: amt, paymentMethod: 'transfer', reference: 'Fund Transfer', note: transferNote, createdBy: req.user._id })
    ]);

    const [fromBal, toBal] = await Promise.all([
      getAccountBalance(fromAcc._id, Number(fromAcc.openingBalance || 0), req.user._id),
      getAccountBalance(toAcc._id, Number(toAcc.openingBalance || 0), req.user._id)
    ]);

    res.json({ message: 'Transfer successful', fromBalance: fromBal, toBalance: toBal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/accounts/:id/deposit', auth, async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    const amount = Number(req.body.amount || 0);
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Enter a valid amount' });
    await Transaction.create({
      date: new Date().toISOString().slice(0, 10),
      accountId: account._id,
      type: 'income',
      amount,
      paymentMethod: req.body.paymentMethod || 'cash',
      reference: req.body.reference || 'Direct deposit',
      note: req.body.note || 'Balance added directly',
      createdBy: req.user._id
    });
    const balance = await getAccountBalance(account._id, Number(account.openingBalance || 0), req.user._id);
    res.json({ message: 'Balance added', balance });
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
    const transactions = await Transaction.find({ createdBy: req.user._id }).sort({ date: -1 }).lean();
    res.json(transactions.map((transaction) => ({ ...transaction, id: String(transaction._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/transactions', auth, async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.body.accountId, createdBy: req.user._id });
    if (!account) return res.status(400).json({ message: 'Select an account belonging to this shop' });
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
    const expenses = await Expense.find({ createdBy: req.user._id }).sort({ date: -1 }).lean();
    res.json(expenses.map((expense) => ({ ...expense, id: String(expense._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/expenses/export', auth, async (req, res) => {
  try {
    const filter = {};
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      filter.date = { ...filter.date, $gte: fromDate.toISOString() };
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { ...filter.date, $lte: endOfDay.toISOString() };
    }

    const expenses = await Expense.find({ ...filter, createdBy: req.user._id }).sort({ date: -1 }).lean();
    const csv = ['date,category,amount,accountId,paymentMethod,note']
      .concat(expenses.map((expense) => `${expense.date || ''},${expense.category || 'General'},${expense.amount || 0},${expense.accountId || ''},${expense.paymentMethod || 'cash'},${String(expense.note || '').replace(/,/g, ' ')}`))
      .join('\n');

    res.header('Content-Type', 'text/csv');
    res.attachment('expenses.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/expenses', auth, async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.body.accountId, createdBy: req.user._id });
    if (!account) return res.status(400).json({ message: 'Select an account belonging to this shop' });
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

router.delete('/expenses/:id', auth, async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/summary', auth, async (req, res) => {
  try {
    const [incomeTotalAgg, expenseTotalAgg, accountsData, paymentMethodIncome, paymentMethodExpense, receivablesAgg] = await Promise.all([
      Transaction.aggregate([{ $match: { createdBy: req.user._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: { createdBy: req.user._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Account.find({ createdBy: req.user._id }).sort({ name: 1 }).lean(),
      Transaction.aggregate([{ $match: { createdBy: req.user._id } }, { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: { createdBy: req.user._id } }, { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }]),
      Invoice.aggregate([{ $match: { createdBy: req.user._id, balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' } } }])
    ]);

    const accounts = await Promise.all(accountsData.map(async (account) => ({
      ...account,
      id: String(account._id),
      balance: await getAccountBalance(account._id, Number(account.openingBalance || 0), req.user._id)
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
      netCash: (incomeTotalAgg[0]?.total || 0) - (expenseTotalAgg[0]?.total || 0),
      receivables: receivablesAgg[0]?.total || 0,
      paymentMethods
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
