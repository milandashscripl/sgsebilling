const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const accounts = global.__sgseAccounts || (global.__sgseAccounts = []);
const transactions = global.__sgseTransactions || (global.__sgseTransactions = []);
const expenses = global.__sgseExpenses || (global.__sgseExpenses = []);
let accountNextId = global.__sgseAccountNextId || 1;
let transactionNextId = global.__sgseTransactionNextId || 1;
let expenseNextId = global.__sgseExpenseNextId || 1;

const getAccountBalance = (account) => {
  const opening = Number(account.openingBalance || 0);
  const inflow = transactions
    .filter((entry) => entry.accountId === account._id && entry.type === 'income')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const outflow = transactions
    .filter((entry) => entry.accountId === account._id && entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const expenseOutflow = expenses
    .filter((entry) => entry.accountId === account._id)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  return opening + inflow - outflow - expenseOutflow;
};

router.get('/accounts', auth, async (req, res) => {
  res.json(accounts.slice().sort((a, b) => a.name.localeCompare(b.name)));
});

router.post('/accounts', auth, async (req, res) => {
  const account = {
    _id: String(accountNextId++),
    name: req.body.name,
    type: req.body.type || 'cash',
    openingBalance: Number(req.body.openingBalance || 0),
    notes: req.body.notes || '',
    createdAt: Date.now(),
    createdBy: req.user?.id
  };
  global.__sgseAccountNextId = accountNextId;
  accounts.push(account);
  res.status(201).json(account);
});

router.get('/transactions', auth, async (req, res) => {
  res.json(transactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')));
});

router.post('/transactions', auth, async (req, res) => {
  const transaction = {
    _id: String(transactionNextId++),
    date: req.body.date || new Date().toISOString().slice(0, 10),
    accountId: req.body.accountId,
    type: req.body.type || 'income',
    amount: Number(req.body.amount || 0),
    paymentMethod: req.body.paymentMethod || 'cash',
    reference: req.body.reference || '',
    note: req.body.note || '',
    createdAt: Date.now(),
    createdBy: req.user?.id
  };
  global.__sgseTransactionNextId = transactionNextId;
  transactions.push(transaction);
  res.status(201).json(transaction);
});

router.get('/expenses', auth, async (req, res) => {
  res.json(expenses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')));
});

router.post('/expenses', auth, async (req, res) => {
  const expense = {
    _id: String(expenseNextId++),
    date: req.body.date || new Date().toISOString().slice(0, 10),
    category: req.body.category || 'General',
    amount: Number(req.body.amount || 0),
    accountId: req.body.accountId,
    paymentMethod: req.body.paymentMethod || 'cash',
    note: req.body.note || '',
    createdAt: Date.now(),
    createdBy: req.user?.id
  };
  global.__sgseExpenseNextId = expenseNextId;
  expenses.push(expense);
  res.status(201).json(expense);
});

router.get('/summary', auth, async (req, res) => {
  const accountSummaries = accounts.map((account) => ({
    ...account,
    balance: getAccountBalance(account)
  }));

  const paymentMethodTotals = [...new Set([...transactions.map((entry) => entry.paymentMethod), ...expenses.map((entry) => entry.paymentMethod)])].map((method) => ({
    method,
    total: transactions.filter((entry) => entry.paymentMethod === method).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + expenses.filter((entry) => entry.paymentMethod === method).reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  }));

  res.json({
    accounts: accountSummaries,
    paymentMethods: paymentMethodTotals,
    incomeTotal: transactions.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    expenseTotal: transactions.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + expenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  });
});

module.exports = router;
