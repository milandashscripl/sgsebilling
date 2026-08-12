import React, { useEffect, useState } from 'react';
import { Pie, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import api from '../api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function AnalyticsDashboard() {
  const [reports, setReports] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0 });
  const [accounting, setAccounting] = useState({ accounts: [], incomeTotal: 0, expenseTotal: 0, paymentMethods: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const [r, a] = await Promise.all([api.get('/reports/summary'), api.get('/accounting/summary')]);
        setReports(r.data || {});
        setAccounting(a.data || {});
      } catch (e) {
        // ignore for now
      }
    };
    load();
  }, []);

  const salesPie = {
    labels: ['Sales', 'Purchases', 'Returns'],
    datasets: [{
      data: [reports.totalSales || 0, reports.totalPurchases || 0, reports.totalReturns || 0],
      backgroundColor: ['#186FAF', '#FF8A65', '#FFD54F']
    }]
  };

  const incomeExpensePie = {
    labels: ['Income', 'Expenses'],
    datasets: [{ data: [accounting.incomeTotal || 0, accounting.expenseTotal || 0], backgroundColor: ['#4CAF50', '#F44336'] }]
  };

  const accountLabels = (accounting.accounts || []).map((a) => a.name || a._id);
  const accountBalances = (accounting.accounts || []).map((a) => Number(a.balance || 0));
  const accountColors = ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#EC407A', '#8D6E63'];

  const accountsDoughnut = {
    labels: accountLabels,
    datasets: [{ data: accountBalances, backgroundColor: accountBalances.map((_, i) => accountColors[i % accountColors.length]) }]
  };

  // Simple monthly sales bar (try to derive from invoices if available)
  const [monthlyBar, setMonthlyBar] = useState({ labels: [], datasets: [] });
  useEffect(() => {
    const loadMonthly = async () => {
      try {
        const res = await api.get('/reports/invoices');
        const invoices = res.data || [];
        const buckets = {};
        invoices.forEach((inv) => {
          const d = new Date(inv.createdAt || inv.date || Date.now());
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          buckets[key] = (buckets[key] || 0) + (inv.grandTotal || 0);
        });
        const keys = Object.keys(buckets).sort();
        setMonthlyBar({ labels: keys, datasets: [{ label: 'Sales', data: keys.map((k) => buckets[k]), backgroundColor: '#2196F3' }] });
      } catch (e) {
        // ignore
      }
    };
    loadMonthly();
  }, []);

  return (
    <div className="analytics-grid">
      <div className="panel">
        <h4>Sales / Purchases / Returns</h4>
        <Pie data={salesPie} />
      </div>

      <div className="panel">
        <h4>Income vs Expenses</h4>
        <Doughnut data={incomeExpensePie} />
      </div>

      <div className="panel">
        <h4>Account Balances</h4>
        {accountLabels.length ? <Doughnut data={accountsDoughnut} /> : <p className="muted">No account data</p>}
      </div>

      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <h4>Monthly Sales</h4>
        {monthlyBar.labels && monthlyBar.labels.length ? <Bar data={monthlyBar} /> : <p className="muted">No invoice history to build chart</p>}
      </div>
    </div>
  );
}
