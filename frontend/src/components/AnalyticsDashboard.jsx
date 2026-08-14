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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadAll = async (from, to) => {
    try {
      const params = {};
      if (from) params.fromDate = from;
      if (to) params.toDate = to;
      const [r, a] = await Promise.all([api.get('/reports/summary', { params }), api.get('/accounting/summary', { params })]);
      setReports(r.data || {});
      setAccounting(a.data || {});
    } catch (e) {
      // ignore for now
    }
  };

  useEffect(() => { loadAll(); }, []);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ₹${Number(context.parsed || 0).toLocaleString()}`
        }
      }
    }
  };

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
    const loadMonthly = async (from, to) => {
      try {
        const params = {};
        if (from) params.fromDate = from;
        if (to) params.toDate = to;
        const res = await api.get('/reports/invoices', { params });
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
    loadMonthly(fromDate, toDate);
  }, [fromDate, toDate]);

  const applyFilter = () => loadAll(fromDate, toDate);

  const exportInvoicesCsv = async () => {
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get('/reports/invoices', { params });
      const invoices = res.data || [];
      const header = ['invoiceNumber', 'type', 'partyName', 'subtotal', 'gstAmount', 'grandTotal', 'createdAt'];
      const lines = [header.join(',')].concat(invoices.map(inv => [inv.invoiceNumber || '', inv.type || '', (inv.partyName||'').replace(/,/g,' '), inv.subtotal||0, inv.gstAmount||0, inv.grandTotal||0, inv.createdAt||''].join(',')));
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${fromDate||'start'}_${toDate||'end'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="analytics-shell">
      <div className="panel analytics-filter-panel">
        <div className="analytics-filter-row">
          <label className="muted">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <label className="muted">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <button className="btn secondary" type="button" onClick={applyFilter}>Apply</button>
        </div>
        <div className="analytics-filter-action">
          <button className="btn outline" type="button" onClick={exportInvoicesCsv}>Export CSV</button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="panel chart-panel">
          <h4>Sales / Purchases / Returns</h4>
          <div className="chart-wrap">
            {reports.totalSales || reports.totalPurchases || reports.totalReturns ? (
              <Pie data={salesPie} options={chartOptions} />
            ) : (
              <p className="muted empty-chart-state">No sales data yet.</p>
            )}
          </div>
        </div>

        <div className="panel chart-panel">
          <h4>Income vs Expenses</h4>
          <div className="chart-wrap">
            {accounting.incomeTotal || accounting.expenseTotal ? (
              <Doughnut data={incomeExpensePie} options={chartOptions} />
            ) : (
              <p className="muted empty-chart-state">No accounting data yet.</p>
            )}
          </div>
        </div>

        <div className="panel chart-panel">
          <h4>Account Balances</h4>
          <div className="chart-wrap">
            {accountLabels.length ? <Doughnut data={accountsDoughnut} options={chartOptions} /> : <p className="muted empty-chart-state">No account data</p>}
          </div>
        </div>

        <div className="panel chart-panel wide-chart">
          <h4>Monthly Sales</h4>
          <div className="chart-wrap large-chart-wrap">
            {monthlyBar.labels && monthlyBar.labels.length ? <Bar data={monthlyBar} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} /> : <p className="muted empty-chart-state">No invoice history to build chart</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
