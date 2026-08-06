import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API });

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  if (loading) return <div className="loading">Loading SGSE Billing...</div>;

  return (
    <div className="app-shell">
      {user ? <AuthenticatedApp user={user} logout={logout} /> : <PublicApp setUser={setUser} />}
    </div>
  );
}

function PublicApp({ setUser }) {
  return (
    <div className="public-screen">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Modern billing & stock management</p>
          <h1>SGSE Billing Suite</h1>
          <p>Create invoices, manage stock, handle purchases, returns, payments, and reports from one polished workspace.</p>
          <div className="hero-actions">
            <Link className="btn primary" to="/login">Login</Link>
            <Link className="btn secondary" to="/register">Create account</Link>
          </div>
        </div>
      </div>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

function AuthenticatedApp({ user, logout }) {
  return (
    <div>
      <nav className="topbar">
        <div>
          <h2>SGSE Billing</h2>
          <p>{user.role === 'admin' ? 'Admin control center' : 'Sales and inventory workspace'}</p>
        </div>
        <div className="topbar-actions">
          <span className="chip">{user.name}</span>
          <button className="btn secondary" onClick={logout}>Logout</button>
        </div>
      </nav>
      <div className="dashboard">
        <aside className="sidebar">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/items">Items</Link>
          <Link to="/billing">Billing</Link>
          <Link to="/reports">Reports</Link>
          {user.role === 'admin' && <Link to="/users">Users</Link>}
        </aside>
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            {user.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Login({ setUser }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', form);
      localStorage.setItem('token', res.data.token);
      api.defaults.headers.common.Authorization = `Bearer ${res.data.token}`;
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <form className="form-card" onSubmit={submit}>
      <h3>Welcome back</h3>
      {error && <p className="error">{error}</p>}
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button className="btn primary" type="submit">Sign in</button>
    </form>
  );
}

function Register({ setUser }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/register', form);
      localStorage.setItem('token', res.data.token);
      api.defaults.headers.common.Authorization = `Bearer ${res.data.token}`;
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <form className="form-card" onSubmit={submit}>
      <h3>Create an account</h3>
      {error && <p className="error">{error}</p>}
      <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button className="btn primary" type="submit">Register</button>
    </form>
  );
}

function Dashboard({ user }) {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/reports/summary').then((res) => setSummary(res.data));
    api.get('/items').then((res) => setItems(res.data));
  }, []);

  return (
    <div>
      <h3>Dashboard overview</h3>
      <div className="stats-grid">
        <div className="stat-card"><h4>Sales</h4><p>₹{summary.totalSales.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Purchases</h4><p>₹{summary.totalPurchases.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Returns</h4><p>₹{summary.totalReturns.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Invoices</h4><p>{summary.invoiceCount}</p></div>
      </div>
      <div className="panel">
        <h4>Low stock items</h4>
        <ul>
          {items.filter((item) => item.stock < 5).map((item) => (
            <li key={item._id}>{item.name} — {item.stock} in stock</li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <p>Welcome {user.name}. Manage bills, stock, and reports from this elegant control center.</p>
      </div>
    </div>
  );
}

function ItemsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', sku: '', purchasePrice: '', salePrice: '', gstRate: '0', stock: '0', category: 'General' });

  const load = async () => {
    const res = await api.get('/items');
    setItems(res.data);
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    await api.post('/items', { ...form, purchasePrice: Number(form.purchasePrice), salePrice: Number(form.salePrice), gstRate: Number(form.gstRate), stock: Number(form.stock) });
    setForm({ name: '', sku: '', purchasePrice: '', salePrice: '', gstRate: '0', stock: '0', category: 'General' });
    load();
  };

  return (
    <div>
      <h3>Inventory items</h3>
      <form className="panel" onSubmit={create}>
        <input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        <input placeholder="Purchase price" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
        <input placeholder="Sale price" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
        <input placeholder="GST %" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
        <input placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
        <button className="btn primary" type="submit">Add item</button>
      </form>
      <div className="panel">
        {items.map((item) => (
          <div className="list-row" key={item._id}>
            <div><strong>{item.name}</strong><div>{item.sku} • {item.category}</div></div>
            <div>₹{item.salePrice} • Stock {item.stock}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingPage() {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [type, setType] = useState('sale');

  useEffect(() => { api.get('/items').then((res) => setItems(res.data)); }, []);

  const addItem = (item) => {
    const existing = selectedItems.find((x) => x.item === item._id);
    if (existing) {
      setSelectedItems(selectedItems.map((x) => x.item === item._id ? { ...x, quantity: x.quantity + 1 } : x));
    } else {
      setSelectedItems([...selectedItems, { item: item._id, name: item.name, quantity: 1, price: item.salePrice, gstRate: item.gstRate, total: item.salePrice }]);
    }
  };

  const updateQty = (id, delta) => {
    setSelectedItems(selectedItems.map((entry) => entry.item === id ? { ...entry, quantity: Math.max(1, entry.quantity + delta), total: (entry.price * (entry.quantity + delta)) } : entry));
  };

  const saveInvoice = async () => {
    const payload = { customerName, customerPhone, type, items: selectedItems.map((entry) => ({ ...entry, total: entry.quantity * entry.price })) };
    await api.post('/invoices', payload);
    alert('Invoice created');
    setSelectedItems([]);
  };

  const subtotal = selectedItems.reduce((sum, entry) => sum + entry.quantity * entry.price, 0);
  const gstAmount = selectedItems.reduce((sum, entry) => sum + ((entry.quantity * entry.price) * (entry.gstRate || 0) / 100), 0);
  const total = subtotal + gstAmount;

  return (
    <div>
      <h3>Single-price billing</h3>
      <div className="billing-grid">
        <div className="panel">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="return">Return</option>
          </select>
          <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          <div className="item-list">
            {items.map((item) => (
              <button key={item._id} className="item-chip" onClick={() => addItem(item)}>{item.name} — ₹{item.salePrice}</button>
            ))}
          </div>
        </div>
        <div className="panel">
          {selectedItems.map((entry) => (
            <div className="list-row" key={entry.item}>
              <div><strong>{entry.name}</strong></div>
              <div className="row-actions">
                <button onClick={() => updateQty(entry.item, -1)}>-</button>
                <span>{entry.quantity}</span>
                <button onClick={() => updateQty(entry.item, 1)}>+</button>
              </div>
            </div>
          ))}
          <div className="totals">
            <div>Subtotal: ₹{subtotal.toFixed(2)}</div>
            <div>GST: ₹{gstAmount.toFixed(2)}</div>
            <div><strong>Total: ₹{total.toFixed(2)}</strong></div>
          </div>
          <button className="btn primary" onClick={saveInvoice}>Create bill</button>
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });

  useEffect(() => { api.get('/reports/summary').then((res) => setSummary(res.data)); }, []);

  return (
    <div>
      <h3>Reports and print-ready summaries</h3>
      <div className="stats-grid">
        <div className="stat-card"><h4>Total sales</h4><p>₹{summary.totalSales.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Total purchases</h4><p>₹{summary.totalPurchases.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Total returns</h4><p>₹{summary.totalReturns.toLocaleString()}</p></div>
      </div>
      <div className="panel">
        <button className="btn primary" onClick={() => window.print()}>Print report</button>
      </div>
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState([]);

  useEffect(() => { api.get('/users').then((res) => setUsers(res.data)); }, []);

  return (
    <div>
      <h3>User administration</h3>
      <div className="panel">
        {users.map((user) => (
          <div className="list-row" key={user._id}>
            <div><strong>{user.name}</strong><div>{user.email}</div></div>
            <div>{user.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
