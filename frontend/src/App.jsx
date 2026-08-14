import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { API_BASE_URL } from './config';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { downloadInvoicePdf } from './utils/invoicePdf';

const API = API_BASE_URL;

const api = axios.create({ baseURL: API });

const emptyItemForm = {
  name: '',
  itemTypeId: '',
  itemType: '',
  categoryId: '',
  category: '',
  specification: '',
  unit: 'pcs',
  purchasePrice: '',
  salePrice: '',
  sgstRate: '0',
  cgstRate: '0',
  igstRate: '0',
  stock: '0',
  description: ''
};

const emptyItemTypeForm = {
  name: '',
  unit: 'pcs',
  sgstRate: '0',
  cgstRate: '0',
  igstRate: '0',
  description: ''
};

const emptyCategoryForm = {
  name: '',
  description: ''
};

const LEAD_STATUS_OPTIONS = ['Hot Lead', 'Warm Lead', 'Cool Lead', 'May Convert', 'Following Up', 'Not Interested'];

const toLocalDateTimeValue = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Date/time helpers
const formatAbsoluteDate = (date) => {
  if (!date) return 'Never';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getTimeAgo = (date) => {
  if (!date) return 'Never';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return 'Invalid date';
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    api.get('/auth/me')
      .then((res) => {
        const nextUser = res.data.user;
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  if (loading) return <div className="loading">Loading SGSE Billing...</div>;

  return (
    <div className="app-shell">
      <ErrorBoundary>
        {user ? <AuthenticatedApp user={user} logout={logout} /> : <PublicApp setUser={setUser} />}
      </ErrorBoundary>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in App:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h3>Application error</h3>
          <p className="muted">An unexpected error occurred. Check the browser console for details.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f8d7da', padding: 12 }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
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
      <div className="dashboard-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark">SG</span>
            <div>
              <strong>SGSE</strong>
              <small>Business hub</small>
            </div>
          </div>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/dashboard">Overview</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/items">Items</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/stock">Stock</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/billing">Billing</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/contacts">Contacts</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/accounting">Accounting</NavLink>
          <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/reports">Reports</NavLink>
          {user.role === 'admin' && <NavLink className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/users">Users</NavLink>}
        </aside>
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/billing" element={<BillingPage user={user} />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/accounting" element={<AccountingPage />} />
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
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      const token = res?.data?.token;
      if (!token) throw new Error('No authentication token returned');

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Login failed';
      setError(message);
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
    setError('');
    try {
      const res = await api.post('/auth/register', form);
      const token = res?.data?.token;
      if (!token) throw new Error('No authentication token returned');

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Registration failed';
      setError(message);
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

function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', callerName: '', contactNumber: '', consumerNumber: '', status: 'Warm Lead', review: '', nextFollowUp: '', markContacted: false });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [callForm, setCallForm] = useState({ contactId: null, note: '', outcome: 'Contacted', leadStage: 'Warm Lead', timestamp: toLocalDateTimeValue() });

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contacts');
      setContacts(res.data || []);
    } catch (err) {
      setMessage('Unable to load contacts');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadContacts(); }, []);

  const reset = () => { setForm({ name: '', callerName: '', contactNumber: '', consumerNumber: '', status: 'Warm Lead', review: '', nextFollowUp: '', markContacted: false }); setEditingId(null); };

  const getStageClass = (status) => {
    const label = (status || '').toLowerCase();
    if (label.includes('hot')) return 'status-hot-lead';
    if (label.includes('warm')) return 'status-warm-lead';
    if (label.includes('cool')) return 'status-cool-lead';
    if (label.includes('convert')) return 'status-may-convert';
    if (label.includes('following')) return 'status-following-up';
    if (label.includes('not')) return 'status-not-interested';
    return 'status-following-up';
  };

  const save = async (e) => {
    e && e.preventDefault();
    try {
      const payload = { ...form, lastContacted: form.markContacted ? new Date().toISOString() : null };
      if (editingId) {
        await api.put(`/contacts/${editingId}`, payload);
        setMessage('Contact updated');
      } else {
        await api.post('/contacts', payload);
        setMessage('Contact added');
      }
      reset();
      await loadContacts();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Unable to save contact');
    }
  };

  const edit = (c) => { setEditingId(c.id || c._id); setForm({ name: c.name || '', callerName: c.callerName || '', contactNumber: c.contactNumber || '', consumerNumber: c.consumerNumber || '', status: c.status || 'Warm Lead', review: c.review || '', nextFollowUp: c.nextFollowUp ? c.nextFollowUp.slice(0,10) : '', markContacted: !!c.lastContacted }); };

  const remove = async (id) => { if (!confirm('Delete this contact?')) return; try { await api.delete(`/contacts/${id}`); setMessage('Contact removed'); await loadContacts(); } catch { setMessage('Unable to delete'); } };

  const logCall = async (contact) => {
    const id = contact.id || contact._id;
    const currentStatus = contact.status || 'Warm Lead';
    setCallForm({ contactId: id, note: '', outcome: 'Contacted', leadStage: currentStatus, timestamp: toLocalDateTimeValue() });
  };

  const submitCall = async (e) => {
    e && e.preventDefault();
    const id = callForm.contactId;
    if (!id) return setMessage('No contact selected');
    try {
      const contact = contacts.find(c => (c._id === id || c.id === id));
      const selectedLead = callForm.leadStage || contact?.status || 'Warm Lead';
      const payload = {
        timestamp: callForm.timestamp ? new Date(callForm.timestamp).toISOString() : new Date().toISOString(),
        note: callForm.note || '',
        outcome: callForm.outcome || 'Contacted',
        statusOnCall: callForm.outcome === 'Not Interested' ? 'Not Interested' : selectedLead,
        leadStage: selectedLead
      };
      await api.post(`/contacts/${id}/calls`, payload);
      setMessage('Call logged');
      setCallForm({ contactId: null, note: '', outcome: 'Contacted', leadStage: 'Warm Lead', timestamp: '' });
      await loadContacts();
    } catch (err) {
      setMessage('Unable to log call');
    }
  };

  const cancelCall = () => setCallForm({ contactId: null, note: '', outcome: 'Contacted', leadStage: 'Warm Lead', timestamp: '' });

  const counts = {
    all: contacts.length,
    hot: contacts.filter(c => c.status === 'Hot Lead').length,
    warm: contacts.filter(c => c.status === 'Warm Lead').length,
    cool: contacts.filter(c => c.status === 'Cool Lead').length,
    notinterested: contacts.filter(c => c.status === 'Not Interested').length,
    no_response: contacts.filter(c => !c.callHistory || c.callHistory.length === 0).length
  };

  const filtered = contacts.filter(c => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const callerName = (c.callerName || '').toLowerCase();
      const customerName = (c.name || '').toLowerCase();
      const contactNumber = (c.contactNumber || '').toLowerCase();
      if (!callerName.includes(s) && !customerName.includes(s) && !contactNumber.includes(s)) return false;
    }
    if (statusTab === 'hot' && c.status !== 'Hot Lead') return false;
    if (statusTab === 'warm' && c.status !== 'Warm Lead') return false;
    if (statusTab === 'cool' && c.status !== 'Cool Lead') return false;
    if (statusTab === 'notinterested' && c.status !== 'Not Interested') return false;
    if (statusTab === 'no_response' && c.callHistory && c.callHistory.length) return false;
    return true;
  });

  return (
    <div className="contacts-page">
      <div className="page-header contacts-header">
        <div>
          <p className="eyebrow">Sales pipeline</p>
          <h3>Contacts & calls</h3>
        </div>
        <div className="contacts-summary-grid">
          <div className="mini-stat">
            <span className="mini-stat-label">Hot</span>
            <strong>{counts.hot}</strong>
          </div>
          <div className="mini-stat warm">
            <span className="mini-stat-label">Warm</span>
            <strong>{counts.warm}</strong>
          </div>
          <div className="mini-stat cool">
            <span className="mini-stat-label">Cool</span>
            <strong>{counts.cool}</strong>
          </div>
        </div>
      </div>

      {message && <p className="status-message">{message}</p>}

      <div className="panel">
        <h4>{editingId ? 'Edit contact' : 'Add contact'}</h4>
        <form className="form-grid" onSubmit={save}>
          <label>Caller name<input value={form.callerName} onChange={(e)=>setForm({...form, callerName:e.target.value})} /></label>
          <label>Customer name<input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} /></label>
          <label>Contact number<input value={form.contactNumber} onChange={(e)=>setForm({...form, contactNumber:e.target.value})} /></label>
          <label>Consumer number<input value={form.consumerNumber} onChange={(e)=>setForm({...form, consumerNumber:e.target.value})} /></label>
          <label>Lead stage<select value={form.status} onChange={(e)=>setForm({...form, status:e.target.value})}>{LEAD_STATUS_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Contacted now?<select value={form.markContacted ? 'contacted' : 'not_contacted'} onChange={(e)=>setForm({...form, markContacted: e.target.value==='contacted'})}><option value="contacted">Contacted</option><option value="not_contacted">Not contacted</option></select></label>
          <div style={{gridColumn:'1/-1', display:'flex', gap:8}}>
            <button className="btn primary" type="submit">{editingId ? 'Update' : 'Add'}</button>
            <button className="btn secondary" type="button" onClick={reset}>Clear</button>
          </div>
        </form>
      </div>

      <div className="panel contact-stream-panel">
        <div className="filter-bar">
          <button className={statusTab==='all'?'btn primary':'btn outline'} onClick={()=>setStatusTab('all')}>All ({counts.all})</button>
          <button className={statusTab==='hot'?'btn primary':'btn outline'} onClick={()=>setStatusTab('hot')}>Hot ({counts.hot})</button>
          <button className={statusTab==='warm'?'btn primary':'btn outline'} onClick={()=>setStatusTab('warm')}>Warm ({counts.warm})</button>
          <button className={statusTab==='cool'?'btn primary':'btn outline'} onClick={()=>setStatusTab('cool')}>Cool ({counts.cool})</button>
          <button className={statusTab==='notinterested'?'btn primary':'btn outline'} onClick={()=>setStatusTab('notinterested')}>Not interested ({counts.notinterested})</button>
          <button className={statusTab==='no_response'?'btn primary':'btn outline'} onClick={()=>setStatusTab('no_response')}>No response ({counts.no_response})</button>
          <input className="search-field" placeholder="Search caller, customer or number" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
        </div>

        {loading ? <p className="muted">Loading...</p> : (
          filtered.length === 0 ? <p className="muted empty-state-inline">No contacts in this pipeline.</p> : (
            <div className="contacts-list">
              {filtered.map((c) => {
                const id = c.id || c._id;
                const recent = c.lastContacted && (Date.now() - new Date(c.lastContacted).getTime()) < 24*60*60*1000;
                const latestCall = Array.isArray(c.callHistory) && c.callHistory.length ? c.callHistory[c.callHistory.length - 1] : null;
                const reviewText = (c.review || latestCall?.note || '').trim();
                const callerName = (c.callerName || 'Not assigned').trim() || 'Not assigned';

                return (
                  <div key={id} className="panel contact-card" style={{display:'flex', flexDirection:'column', gap:8}}>
                    <div className="contact-card-head">
                      <div className="contact-avatar">{(c.name || '--').split(' ').map(x => x[0]).slice(0, 2).join('')}</div>
                      <div className="contact-primary">
                        <div className="contact-name-row">
                          <strong>{c.name || 'Unknown'}</strong>
                          {recent && <span className="recent-badge">Recent</span>}
                          <span className="contact-time">{getTimeAgo(c.lastContacted)} • {c.lastContacted ? formatAbsoluteDate(c.lastContacted) : 'Never'}</span>
                        </div>
                        <div className="contact-meta">
                          <span>{c.contactNumber || '—'}</span>
                          <span>{c.consumerNumber || '—'}</span>
                          <span>Calls: {c.callHistory ? c.callHistory.length : 0}</span>
                        </div>
                        <div className="status-row">
                          <span className={`status-badge ${getStageClass(c.status)}`}>{c.status || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="contact-actions">
                        <button className="btn secondary" onClick={()=>edit(c)}>Edit</button>
                        <button className="btn secondary" onClick={()=>remove(id)}>Delete</button>
                      </div>
                    </div>

                    <div className="contact-detail-strip">
                      <div className="detail-pill">
                        <span className="detail-label">Caller</span>
                        <strong>{callerName}</strong>
                      </div>
                      <div className="detail-pill review-pill">
                        <span className="detail-label">Review</span>
                        <strong>{reviewText || 'No review entered'}</strong>
                      </div>
                    </div>

                    <div className="call-log-row">
                      {callForm.contactId === id ? (
                        <form className="call-form" onSubmit={submitCall}>
                          <select value={callForm.outcome} onChange={(e)=>setCallForm({...callForm, outcome:e.target.value})}>
                            <option>Contacted</option>
                            <option>Follow-up</option>
                            <option>Not Interested</option>
                          </select>
                          <select value={callForm.leadStage} onChange={(e)=>setCallForm({...callForm, leadStage:e.target.value})}>
                            {LEAD_STATUS_OPTIONS.map(option => <option key={option}>{option}</option>)}
                          </select>
                          <input type="datetime-local" value={callForm.timestamp} onChange={(e)=>setCallForm({...callForm, timestamp:e.target.value || toLocalDateTimeValue()})} />
                          <input type="text" placeholder="Call notes" value={callForm.note} onChange={(e)=>setCallForm({...callForm, note:e.target.value})} />
                          <button className="btn primary" type="submit">Save</button>
                          <button className="btn outline" type="button" onClick={cancelCall}>Cancel</button>
                        </form>
                      ) : (
                        <div className="inline-actions">
                          <button className="btn primary" onClick={()=>logCall(c)}>Log call</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [items, setItems] = useState([]);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/items'),
      api.get('/contacts')
    ]).then(([summaryRes, itemsRes, contactsRes]) => {
      setSummary(summaryRes.data || {});
      setItems(itemsRes.data || []);
      setContacts(contactsRes.data || []);
    });
  }, []);

  const lowStockItems = items.filter((item) => Number(item.stock || 0) <= 5);
  const netSales = (summary.totalSales || 0) - (summary.totalReturns || 0);
  const marginRate = summary.totalSales ? Math.max(0, Math.min(100, ((summary.totalSales - summary.totalPurchases) / Math.max(summary.totalSales, 1)) * 100)) : 0;
  const inventoryValue = items.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.salePrice || 0), 0);

  const callerBreakdown = contacts.reduce((acc, contact) => {
    const callerName = (contact.callerName || 'Unassigned').trim() || 'Unassigned';
    acc[callerName] = (acc[callerName] || 0) + 1;
    return acc;
  }, {});

  const topCallerEntries = Object.entries(callerBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const responseCount = contacts.filter((contact) => contact.callHistory?.length || contact.lastContacted).length;
  const responseRate = contacts.length ? (responseCount / contacts.length) * 100 : 0;
  const noResponseCount = contacts.filter((contact) => !(contact.callHistory?.length || contact.lastContacted)).length;
  const contactedCount = contacts.filter((contact) => contact.lastContacted || contact.callHistory?.some((call) => call.outcome === 'Contacted')).length;
  const followUpCount = contacts.filter((contact) => contact.callHistory?.some((call) => call.outcome === 'Follow-up')).length;

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Performance overview</p>
          <h3>Dashboard</h3>
        </div>
        <div className="dashboard-hero-pill">
          Welcome {user.name}
        </div>
      </div>

      <div className="dashboard-summary-band">
        <div className="summary-highlight">
          <span>Net sales</span>
          <strong>₹{netSales.toLocaleString()}</strong>
        </div>
        <div className="summary-highlight muted-highlight">
          <span>Invoices</span>
          <strong>{summary.invoiceCount || 0}</strong>
        </div>
        <div className="summary-highlight accent-highlight">
          <span>Margin</span>
          <strong>{marginRate.toFixed(1)}%</strong>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-sales">
          <div className="stat-card-header">
            <h4>Sales</h4>
            <span className="stat-trend up">Live</span>
          </div>
          <p>₹{(summary.totalSales || 0).toLocaleString()}</p>
          <span>Current period</span>
        </div>
        <div className="stat-card stat-purchases">
          <div className="stat-card-header">
            <h4>Purchases</h4>
            <span className="stat-trend neutral">Stock</span>
          </div>
          <p>₹{(summary.totalPurchases || 0).toLocaleString()}</p>
          <span>Inbound stock</span>
        </div>
        <div className="stat-card stat-returns">
          <div className="stat-card-header">
            <h4>Returns</h4>
            <span className="stat-trend down">Watch</span>
          </div>
          <p>₹{(summary.totalReturns || 0).toLocaleString()}</p>
          <span>Returned value</span>
        </div>
        <div className="stat-card stat-invoices">
          <div className="stat-card-header">
            <h4>Inventory</h4>
            <span className="stat-trend up">Value</span>
          </div>
          <p>₹{inventoryValue.toLocaleString()}</p>
          <span>Stock holding</span>
        </div>
      </div>

      <div className="dashboard-panels-grid">
        <div className="panel quick-panel">
          <h4>Low stock alert</h4>
          {lowStockItems.length === 0 ? (
            <p className="muted">No urgent stock issues.</p>
          ) : (
            <ul className="alert-list">
              {lowStockItems.map((item) => (
                <li key={item._id}><span>{item.name}</span><strong>{item.stock} left</strong></li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel quick-panel">
          <h4>Sales pulse</h4>
          <div className="pulse-row">
            <div>
              <span className="pulse-label">Volume</span>
              <strong>{summary.invoiceCount || 0}</strong>
            </div>
            <div>
              <span className="pulse-label">Margin</span>
              <strong>{marginRate.toFixed(1)}%</strong>
            </div>
          </div>
          <div className="mini-progress">
            <span style={{ width: `${Math.min(100, Math.max(0, marginRate))}%` }} />
          </div>
          <p className="muted">Healthy sales momentum and stock discipline this cycle.</p>
        </div>
      </div>

      <div className="analytics-strip">
        <div className="panel analytics-tile">
          <div className="panel-header compact-header">
            <h4>Caller analytics</h4>
          </div>
          <div className="mini-metric-grid">
            <div className="mini-metric">
              <span>Active callers</span>
              <strong>{Object.keys(callerBreakdown).length}</strong>
            </div>
            <div className="mini-metric">
              <span>Top caller</span>
              <strong>{topCallerEntries[0]?.[0] || 'N/A'}</strong>
            </div>
          </div>
          <ul className="leaderboard-list">
            {topCallerEntries.length === 0 ? (
              <li className="muted">No caller activity yet.</li>
            ) : (
              topCallerEntries.map(([name, count]) => (
                <li key={name}><span>{name}</span><strong>{count}</strong></li>
              ))
            )}
          </ul>
        </div>

        <div className="panel analytics-tile">
          <div className="panel-header compact-header">
            <h4>Response analytics</h4>
          </div>
          <div className="mini-metric-grid">
            <div className="mini-metric green">
              <span>Response rate</span>
              <strong>{responseRate.toFixed(0)}%</strong>
            </div>
            <div className="mini-metric amber">
              <span>Follow-ups</span>
              <strong>{followUpCount}</strong>
            </div>
          </div>
          <div className="response-meter">
            <div className="response-meter-fill" style={{ width: `${Math.min(100, responseRate)}%` }} />
          </div>
          <div className="response-breakdown">
            <span>Reached: {contactedCount}</span>
            <span>No response: {noResponseCount}</span>
          </div>
        </div>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}

function ItemsPage() {
  const [items, setItems] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyItemForm);
  const [typeForm, setTypeForm] = useState(emptyItemTypeForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [itemsRes, itemTypesRes, categoriesRes] = await Promise.all([
        api.get('/items'),
        api.get('/item-types'),
        api.get('/categories')
      ]);
      setItems(itemsRes.data);
      setItemTypes(itemTypesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load items right now');
    }
  };

  useEffect(() => { load(); }, []);

  const resetItemForm = () => {
    setForm(emptyItemForm);
    setEditingItemId(null);
    setMessage('');
  };

  const resetTypeForm = () => {
    setTypeForm(emptyItemTypeForm);
    setEditingTypeId(null);
    setMessage('');
  };

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm);
    setEditingCategoryId(null);
    setMessage('');
  };

  const saveItem = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice) || 0,
        salePrice: Number(form.salePrice) || 0,
        sgstRate: Number(form.sgstRate) || 0,
        cgstRate: Number(form.cgstRate) || 0,
        igstRate: Number(form.igstRate) || 0,
        stock: Number(form.stock) || 0
      };

      if (editingItemId) {
        await api.put(`/items/${editingItemId}`, payload);
        setMessage('Item updated');
      } else {
        await api.post('/items', payload);
        setMessage('Item created');
      }

      resetItemForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save item');
    }
  };

  const saveItemType = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...typeForm,
        sgstRate: Number(typeForm.sgstRate) || 0,
        cgstRate: Number(typeForm.cgstRate) || 0,
        igstRate: Number(typeForm.igstRate) || 0
      };

      if (editingTypeId) {
        await api.put(`/item-types/${editingTypeId}`, payload);
        setMessage('Item type updated');
      } else {
        await api.post('/item-types', payload);
        setMessage('Item type created');
      }

      resetTypeForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save item type');
    }
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      if (editingCategoryId) {
        await api.put(`/categories/${editingCategoryId}`, categoryForm);
        setMessage('Category updated');
      } else {
        await api.post('/categories', categoryForm);
        setMessage('Category created');
      }

      resetCategoryForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save category');
    }
  };

  const editItem = (item) => {
    setEditingItemId(item._id);
    setForm({
      ...emptyItemForm,
      ...item,
      itemTypeId: item.itemTypeId || '',
      itemType: item.itemType || '',
      purchasePrice: item.purchasePrice ?? '',
      salePrice: item.salePrice ?? '',
      sgstRate: item.sgstRate ?? 0,
      cgstRate: item.cgstRate ?? 0,
      igstRate: item.igstRate ?? 0,
      stock: item.stock ?? 0
    });
    setMessage('');
  };

  const editItemType = (itemType) => {
    setEditingTypeId(itemType._id);
    setTypeForm({
      ...emptyItemTypeForm,
      ...itemType,
      sgstRate: itemType.sgstRate ?? 0,
      cgstRate: itemType.cgstRate ?? 0,
      igstRate: itemType.igstRate ?? 0
    });
    setMessage('');
  };

  const editCategory = (category) => {
    setEditingCategoryId(category._id);
    setCategoryForm({
      ...emptyCategoryForm,
      ...category
    });
    setMessage('');
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await api.delete(`/items/${id}`);
      if (editingItemId === id) resetItemForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to delete item');
    }
  };

  const deleteItemType = async (id) => {
    if (!window.confirm('Delete this item type?')) return;
    try {
      await api.delete(`/item-types/${id}`);
      if (editingTypeId === id) resetTypeForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to delete item type');
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      if (editingCategoryId === id) resetCategoryForm();
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to delete category');
    }
  };

  const applyTypeDefaults = (itemType) => {
    setForm((prev) => ({
      ...prev,
      itemTypeId: itemType?._id || '',
      itemType: itemType?.name || '',
      unit: itemType?.unit || prev.unit || 'pcs',
      sgstRate: itemType?.sgstRate ?? prev.sgstRate ?? '0',
      cgstRate: itemType?.cgstRate ?? prev.cgstRate ?? '0',
      igstRate: itemType?.igstRate ?? prev.igstRate ?? '0'
    }));
  };

  return (
    <div>
      <h3>Item types and product masters</h3>

      <form className="panel" onSubmit={saveItemType}>
        <h4>Create item type first</h4>
        <div className="form-grid">
          <input placeholder="Item type name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
          <input placeholder="Default unit" value={typeForm.unit} onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })} />
          <input placeholder="SGST %" value={typeForm.sgstRate} onChange={(e) => setTypeForm({ ...typeForm, sgstRate: e.target.value })} />
          <input placeholder="CGST %" value={typeForm.cgstRate} onChange={(e) => setTypeForm({ ...typeForm, cgstRate: e.target.value })} />
          <input placeholder="IGST %" value={typeForm.igstRate} onChange={(e) => setTypeForm({ ...typeForm, igstRate: e.target.value })} />
          <input placeholder="Description" value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} />
        </div>
        <div className="inline-actions">
          <button className="btn primary" type="submit">{editingTypeId ? 'Save type' : 'Add type'}</button>
          {editingTypeId && <button className="btn secondary" type="button" onClick={resetTypeForm}>Cancel</button>}
        </div>
      </form>

      <div className="panel">
        {itemTypes.map((itemType) => (
          <div className="list-row" key={itemType._id}>
            <div>
              <strong>{itemType.name}</strong>
              <div className="muted">Unit {itemType.unit} • SGST {itemType.sgstRate}% • CGST {itemType.cgstRate}% • IGST {itemType.igstRate}%</div>
            </div>
            <div className="inline-actions">
              <button className="btn secondary" type="button" onClick={() => editItemType(itemType)}>Edit</button>
              <button className="btn secondary" type="button" onClick={() => deleteItemType(itemType._id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <form className="panel" onSubmit={saveCategory}>
        <h4>Manage categories</h4>
        <div className="form-grid">
          <input placeholder="Category name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
          <input placeholder="Description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
        </div>
        <div className="inline-actions">
          <button className="btn primary" type="submit">{editingCategoryId ? 'Save category' : 'Add category'}</button>
          {editingCategoryId && <button className="btn secondary" type="button" onClick={resetCategoryForm}>Cancel</button>}
        </div>
      </form>

      <div className="panel">
        {categories.map((category) => (
          <div className="list-row" key={category._id}>
            <div>
              <strong>{category.name}</strong>
              <div className="muted">{category.description || 'No description'}</div>
            </div>
            <div className="inline-actions">
              <button className="btn secondary" type="button" onClick={() => editCategory(category)}>Edit</button>
              <button className="btn secondary" type="button" onClick={() => deleteCategory(category._id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <form className="panel" onSubmit={saveItem}>
        <h4>Create item</h4>
        <div className="form-grid">
          <input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.itemTypeId} onChange={(e) => {
            const selectedType = itemTypes.find((type) => type._id === e.target.value);
            applyTypeDefaults(selectedType);
          }}>
            <option value="">Select item type</option>
            {itemTypes.map((itemType) => (
              <option key={itemType._id} value={itemType._id}>{itemType.name}</option>
            ))}
          </select>
          <select value={form.categoryId} onChange={(e) => {
            const selectedCategory = categories.find((cat) => cat._id === e.target.value);
            setForm((prev) => ({
              ...prev,
              categoryId: selectedCategory?._id || '',
              category: selectedCategory?.name || prev.category || ''
            }));
          }}>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          <input placeholder="Category / variant (e.g. 3KW, Hybrid, TopCon, 200Ah, 30x50mm)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input placeholder="Specification / size" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
          <input placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input placeholder="Purchase price" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          <input placeholder="Sale price" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
          <input placeholder="SGST %" value={form.sgstRate} onChange={(e) => setForm({ ...form, sgstRate: e.target.value })} />
          <input placeholder="CGST %" value={form.cgstRate} onChange={(e) => setForm({ ...form, cgstRate: e.target.value })} />
          <input placeholder="IGST %" value={form.igstRate} onChange={(e) => setForm({ ...form, igstRate: e.target.value })} />
          <input placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="inline-actions">
          <button className="btn primary" type="submit">{editingItemId ? 'Save item' : 'Add item'}</button>
          {editingItemId && <button className="btn secondary" type="button" onClick={resetItemForm}>Cancel</button>}
        </div>
        {message && <p className="muted">{message}</p>}
      </form>

      <div className="panel">
        {items.map((item) => (
          <div className="item-card" key={item._id}>
            <div className="item-card-main">
              <div>
                <strong>{item.name}</strong>
                <div className="muted">{item.itemType || 'General'} • {item.category || 'General'}</div>
                <div className="muted">{item.specification || 'No specification added'}</div>
              </div>
              <div className="item-meta">
                <span className="badge">Stock {item.stock}</span>
                <span className="badge">₹{item.salePrice}</span>
              </div>
            </div>
            <div className="inline-actions">
              <button className="btn secondary" type="button" onClick={() => editItem(item)}>Edit</button>
              <button className="btn secondary" type="button" onClick={() => deleteItem(item._id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingPage({ user }) {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGSTIN, setPartyGSTIN] = useState('');
  const [type, setType] = useState('sale');
  const [itemSearch, setItemSearch] = useState('');
  const [billingMessage, setBillingMessage] = useState('');

  const vendor = {
    name: user?.shopName || user?.name || 'SGSE Billing',
    phone: user?.phone || user?.mobile || '',
    address: user?.shopAddress || user?.address || 'Your business address',
    logo: user?.shopLogoUrl || ''
  };

  useEffect(() => { api.get('/items').then((res) => setItems(res.data)); }, []);

  const filteredItems = items.filter((item) => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return true;
    return [item.name, item.itemType, item.category, item.specification]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(query));
  });

  const addItem = (item) => {
    setSelectedItems((prev) => {
      const existing = prev.find((x) => x.item === item._id);
      if (existing) {
        return prev.map((x) => x.item === item._id ? { ...x, quantity: x.quantity + 1, total: (x.price * (x.quantity + 1)) } : x);
      }

      const price = type === 'purchase' ? item.purchasePrice : item.salePrice;
      return [...prev, { item: item._id, name: item.name, quantity: 1, price, sgstRate: item.sgstRate || 0, cgstRate: item.cgstRate || 0, igstRate: item.igstRate || 0, total: price }];
    });
  };

  const updateQty = (id, delta) => {
    setSelectedItems((prev) => prev.map((entry) => entry.item === id ? { ...entry, quantity: Math.max(1, entry.quantity + delta), total: (entry.price * Math.max(1, entry.quantity + delta)) } : entry));
  };

  const saveInvoice = async () => {
    if (!selectedItems.length) {
      setBillingMessage('Please add at least one item before creating a bill');
      return;
    }

    try {
      const payload = {
        partyName: partyName || customerName,
        partyPhone: partyPhone || customerPhone,
        partyGSTIN,
        customerName,
        customerPhone,
        type,
        items: selectedItems.map((entry) => ({ ...entry, itemId: entry.item, total: entry.quantity * entry.price }))
      };
      const res = await api.post('/invoices', payload);
      const savedInvoice = res.data || {};
      const printableInvoice = {
        ...savedInvoice,
        sellerName: vendor.name,
        sellerAddress: vendor.address,
        sellerPhone: vendor.phone,
        sellerGSTIN: user?.shopGSTIN || '',
        sellerLogo: vendor.logo,
        items: (savedInvoice.items || selectedItems.map((entry) => ({
          item: entry.item,
          name: entry.name,
          quantity: entry.quantity,
          price: entry.price,
          sgstRate: entry.sgstRate || 0,
          cgstRate: entry.cgstRate || 0,
          igstRate: entry.igstRate || 0,
          total: entry.quantity * entry.price
        }))).map((entry) => ({
          ...entry,
          total: Number(entry.total || ((Number(entry.quantity || 0) * Number(entry.price || 0))))
        }))
      };
      await downloadInvoicePdf(printableInvoice);
      setBillingMessage('Invoice created successfully and PDF downloaded');
      setSelectedItems([]);
      setPartyName('');
      setPartyPhone('');
      setPartyGSTIN('');
      setCustomerName('');
      setCustomerPhone('');
    } catch (error) {
      setBillingMessage(error.response?.data?.message || 'Unable to create invoice');
    }
  };

  const subtotal = selectedItems.reduce((sum, entry) => sum + entry.quantity * entry.price, 0);
  const gstAmount = selectedItems.reduce((sum, entry) => {
    const base = entry.quantity * entry.price;
    return sum + (base * (entry.sgstRate || 0) / 100) + (base * (entry.cgstRate || 0) / 100) + (base * (entry.igstRate || 0) / 100);
  }, 0);
  const total = subtotal + gstAmount;

  return (
    <div className="billing-page">
      <div className="page-header">
        <p className="eyebrow">Professional billing</p>
        <h3>Invoice workspace</h3>
      </div>

      <div className="billing-grid">
        <div className="panel billing-form-panel">
          <div className="billing-form-header">
            <div>
              <h4>New invoice</h4>
              <p className="muted">Create a clean, branded bill with vendor details included.</p>
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="return">Return</option>
            </select>
          </div>

          <div className="billing-customer-grid">
            <input placeholder="Party name" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
            <input placeholder="Party phone" value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} />
            <input placeholder="Party GSTIN (optional)" value={partyGSTIN} onChange={(e) => setPartyGSTIN(e.target.value)} />
            <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>

          <div className="item-search-block">
            <label className="muted">Search items</label>
            <input
              placeholder="Search by item, type, category..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </div>

          <div className="item-list">
            {filteredItems.length === 0 ? (
              <p className="muted empty-invoice-state">No matching items found.</p>
            ) : (
              filteredItems.map((item) => (
                <button key={item._id} className="item-chip" onClick={() => addItem(item)}>
                  <span>{item.name}</span>
                  <small>₹{type === 'purchase' ? item.purchasePrice : item.salePrice}</small>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel invoice-preview-panel">
          <div className="invoice-header">
            <div className="invoice-brand">
              {vendor.logo ? <img src={vendor.logo} alt={vendor.name} className="vendor-logo" /> : <div className="vendor-logo placeholder">{(vendor.name || 'SG').slice(0, 2).toUpperCase()}</div>}
              <div>
                <strong>{vendor.name}</strong>
                <div className="muted">{vendor.address}</div>
                {vendor.phone && <div className="muted">{vendor.phone}</div>}
              </div>
            </div>
            <div className="invoice-meta">
              <span>{type === 'sale' ? 'Sale Invoice' : type === 'purchase' ? 'Purchase Invoice' : 'Return Invoice'}</span>
            </div>
          </div>

          <div className="invoice-customer-box">
            <div>
              <span className="invoice-label">Bill to</span>
              <strong>{partyName || customerName || 'Walk-in Customer'}</strong>
            </div>
            <div>
              <span className="invoice-label">Phone</span>
              <strong>{partyPhone || customerPhone || '—'}</strong>
            </div>
            <div>
              <span className="invoice-label">GSTIN</span>
              <strong>{partyGSTIN || '—'}</strong>
            </div>
          </div>

          <div className="invoice-items">
            {selectedItems.length === 0 ? (
              <div className="muted empty-invoice-state">No items added yet.</div>
            ) : (
              selectedItems.map((entry) => (
                <div className="invoice-item-row" key={entry.item}>
                  <div>
                    <strong>{entry.name}</strong>
                    <div className="muted">₹{entry.price} × {entry.quantity}</div>
                  </div>
                  <div className="invoice-item-actions">
                    <button className="btn small" onClick={() => updateQty(entry.item, -1)}>-</button>
                    <span>{entry.quantity}</span>
                    <button className="btn small" onClick={() => updateQty(entry.item, 1)}>+</button>
                  </div>
                  <strong>₹{(entry.quantity * entry.price).toFixed(2)}</strong>
                </div>
              ))
            )}
          </div>

          <div className="invoice-totals">
            <div><span>Subtotal</span><strong>₹{subtotal.toFixed(2)}</strong></div>
            <div><span>GST</span><strong>₹{gstAmount.toFixed(2)}</strong></div>
            <div className="grand-total"><span>Total</span><strong>₹{total.toFixed(2)}</strong></div>
          </div>

          {billingMessage && <p className="muted billing-message">{billingMessage}</p>}
          <button className="btn primary invoice-create-btn" onClick={saveInvoice}>Create bill & download PDF</button>
        </div>
      </div>
    </div>
  );
}

function AccountingPage() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ accounts: [], paymentMethods: [], incomeTotal: 0, expenseTotal: 0 });
  const [accountForm, setAccountForm] = useState({ name: '', type: 'cash', openingBalance: '0', notes: '' });
  const [transactionForm, setTransactionForm] = useState({ accountId: '', type: 'income', amount: '', paymentMethod: 'cash', reference: '', note: '' });
  const [expenseForm, setExpenseForm] = useState({ date: toLocalDateTimeValue(), category: '', amount: '', accountId: '', paymentMethod: 'cash', note: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [accountsRes, transactionsRes, expensesRes, summaryRes] = await Promise.all([
        api.get('/accounting/accounts'),
        api.get('/accounting/transactions'),
        api.get('/accounting/expenses'),
        api.get('/accounting/summary')
      ]);
      setAccounts(accountsRes.data);
      setTransactions(transactionsRes.data);
      setExpenses(expensesRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load accounting data');
    }
  };

  useEffect(() => { load(); }, []);

  const addAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/accounts', {
        ...accountForm,
        openingBalance: Number(accountForm.openingBalance || 0)
      });
      setAccountForm({ name: '', type: 'cash', openingBalance: '0', notes: '' });
      setMessage('Account created');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to create account');
    }
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/transactions', {
        ...transactionForm,
        amount: Number(transactionForm.amount || 0)
      });
      setTransactionForm({ accountId: '', type: 'income', amount: '', paymentMethod: 'cash', reference: '', note: '' });
      setMessage('Ledger entry saved');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save ledger');
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/expenses', {
        ...expenseForm,
        date: expenseForm.date || toLocalDateTimeValue(),
        amount: Number(expenseForm.amount || 0)
      });
      setExpenseForm({ date: toLocalDateTimeValue(), category: '', amount: '', accountId: '', paymentMethod: 'cash', note: '' });
      setMessage('Expense saved');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save expense');
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/accounting/expenses/${id}`);
      setMessage('Expense deleted');
      await load();
    } catch (err) {
      setMessage('Unable to delete expense');
    }
  };

  const downloadExpenseCsv = async () => {
    try {
      const res = await api.get('/accounting/expenses/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'expenses.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to export expenses');
    }
  };

  const downloadExpensePdf = () => {
    if (!expenses.length) {
      setMessage('No expenses to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    const lineHeight = 7;
    let y = 16;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Expense Report', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, margin, y);
    y += 12;

    doc.setFillColor(238, 243, 255);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    doc.text('Category', margin + 2, y);
    doc.text('Amount', pageWidth - margin - 22, y, { align: 'right' });
    y += 10;

    expenses.slice(0, 20).forEach((exp) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(exp.category || 'General', margin + 2, y);
      doc.text(`₹${Number(exp.amount || 0).toLocaleString()}`, pageWidth - margin - 2, y, { align: 'right' });
      y += lineHeight;
      doc.setFontSize(8);
      doc.text(`${exp.date ? formatAbsoluteDate(exp.date) : '—'} • ${exp.paymentMethod || 'cash'}`, margin + 2, y);
      y += 4;
      doc.setFontSize(10);
    });

    doc.save('expenses.pdf');
  };

  return (
    <div>
      <h3>Accounting and daily cash book</h3>
      {message && <p className="muted">{message}</p>}

      <div className="stats-grid">
        <div className="stat-card"><h4>Income total</h4><p>₹{(summary.incomeTotal || 0).toLocaleString()}</p></div>
        <div className="stat-card"><h4>Expense total</h4><p>₹{(summary.expenseTotal || 0).toLocaleString()}</p></div>
      </div>

      <div className="panel">
        <h4>Account balances</h4>
        {summary.accounts.map((account) => (
          <div className="list-row" key={account._id}>
            <div>
              <strong>{account.name}</strong>
              <div className="muted">{account.type} • {account.notes || 'No notes'}</div>
            </div>
            <div><strong>₹{Number(account.balance || 0).toLocaleString()}</strong></div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Add account</h4>
        <form className="form-grid" onSubmit={addAccount}>
          <input placeholder="Account name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
          <select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="digital">Digital</option>
          </select>
          <input placeholder="Opening balance" value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })} />
          <input placeholder="Notes" value={accountForm.notes} onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} />
          <button className="btn primary" type="submit">Create account</button>
        </form>
      </div>

      <div className="panel">
        <h4>Ledger / cash book entry</h4>
        <form className="form-grid" onSubmit={addTransaction}>
          <select value={transactionForm.accountId} onChange={(e) => setTransactionForm({ ...transactionForm, accountId: e.target.value })}>
            <option value="">Select account</option>
            {accounts.map((account) => (<option key={account._id} value={account._id}>{account.name}</option>))}
          </select>
          <select value={transactionForm.type} onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input placeholder="Amount" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} />
          <select value={transactionForm.paymentMethod} onChange={(e) => setTransactionForm({ ...transactionForm, paymentMethod: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="phonepe">PhonePe</option>
            <option value="gpay">GPay</option>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
          <input placeholder="Reference / receipt" value={transactionForm.reference} onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })} />
          <input placeholder="Note" value={transactionForm.note} onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })} />
          <button className="btn primary" type="submit">Save ledger entry</button>
        </form>
      </div>

      <div className="panel">
        <h4>Daily expenses</h4>
        <form className="form-grid" onSubmit={addExpense}>
          <input type="datetime-local" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
          <input placeholder="Expense category" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
          <input placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
          <select value={expenseForm.accountId} onChange={(e) => setExpenseForm({ ...expenseForm, accountId: e.target.value })}>
            <option value="">Select account</option>
            {accounts.map((account) => (<option key={account._id} value={account._id}>{account.name}</option>))}
          </select>
          <select value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="phonepe">PhonePe</option>
            <option value="gpay">GPay</option>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
          <input placeholder="Note" value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} />
          <button className="btn primary" type="submit">Save expense</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>Recent expenses</h4>
          <div className="inline-actions">
            <button className="btn secondary" type="button" onClick={downloadExpenseCsv}>Download CSV</button>
            <button className="btn secondary" type="button" onClick={downloadExpensePdf}>Download PDF</button>
          </div>
        </div>
        {expenses.length === 0 ? <p className="muted">No expenses recorded</p> : (
          expenses.map((exp) => (
            <div className="list-row" key={exp._id}>
              <div>
                <strong>{exp.category || 'Expense'}</strong>
                <div className="muted">{(accounts.find(a => a._id === exp.accountId)?.name) || exp.accountName || '—'} • {exp.paymentMethod} • {exp.date ? formatAbsoluteDate(exp.date) : (exp.createdAt ? formatAbsoluteDate(exp.createdAt) : '—')}</div>
                {exp.note && <div className="muted">{exp.note}</div>}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:'#C23C3C'}}>- ₹{Number(exp.amount || 0).toLocaleString()}</div>
                <div style={{marginTop:8}}><button className="btn outline" onClick={() => deleteExpense(exp._id)}>Delete</button></div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h4>Payment method summary</h4>
        {summary.paymentMethods.map((entry) => (
          <div className="list-row" key={entry.method}>
            <div><strong>{entry.method}</strong></div>
            <div>₹{Number(entry.total || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Recent ledger entries</h4>
        {transactions.map((entry) => (
          <div className="list-row" key={entry._id}>
            <div>
              <strong>{entry.reference || entry.note || 'Ledger entry'}</strong>
              <div className="muted">{entry.date} • {entry.paymentMethod}</div>
            </div>
            <div>{entry.type === 'income' ? '+' : '-'} ₹{Number(entry.amount || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (query = '') => {
    try {
      const res = await api.get('/reports/stock', { params: query ? { search: query } : {} });
      setItems(res.data || []);
    } catch (error) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const lowStock = items.filter((item) => Number(item.stock || 0) <= 5);
  const inventoryValue = items.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.salePrice || 0), 0);

  return (
    <div className="stock-page">
      <div className="page-header">
        <p className="eyebrow">Inventory control</p>
        <h3>Stock overview</h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-sales">
          <h4>Items tracked</h4>
          <p>{items.length}</p>
          <span>Stock records</span>
        </div>
        <div className="stat-card stat-purchases">
          <h4>Low stock</h4>
          <p>{lowStock.length}</p>
          <span>Needs attention</span>
        </div>
        <div className="stat-card stat-invoices">
          <h4>Inventory value</h4>
          <p>₹{inventoryValue.toLocaleString()}</p>
          <span>Current stock</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header stock-header">
          <h4>Stock monitor</h4>
          <input className="search-field" placeholder="Search item or SKU" value={search} onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }} />
        </div>

        {loading ? <p className="muted">Loading stock...</p> : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Sale price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const stockLevel = Number(item.stock || 0);
                  const status = stockLevel <= 5 ? 'Critical' : stockLevel <= 15 ? 'Low' : 'Healthy';
                  return (
                    <tr key={item._id}>
                      <td>{item.name}</td>
                      <td>{item.itemType || 'General'}</td>
                      <td>{item.category || 'General'}</td>
                      <td>{stockLevel}</td>
                      <td>₹{Number(item.salePrice || 0).toLocaleString()}</td>
                      <td><span className={`status-badge ${status === 'Critical' ? 'status-hot-lead' : status === 'Low' ? 'status-warm-lead' : 'status-may-convert'}`}>{status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [stock, setStock] = useState([]);

  useEffect(() => {
    api.get('/reports/summary').then((res) => setSummary(res.data));
    api.get('/reports/stock').then((res) => setStock(res.data));
  }, []);

  const downloadReport = async (path, filename, type = 'csv') => {
    try {
      const res = await api.get(path, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error.response?.data?.message || 'Unable to download report');
    }
  };

  const downloadPdfReport = async () => {
    const content = [
      'SGSE Billing Report',
      `Sales: ₹${summary.totalSales.toLocaleString()}`,
      `Purchases: ₹${summary.totalPurchases.toLocaleString()}`,
      `Returns: ₹${summary.totalReturns.toLocaleString()}`,
      `Invoice count: ${summary.invoiceCount}`,
      '',
      'Stock Report',
      ...stock.map((item) => `${item.name} | ${item.itemType || '-'} | ${item.category || 'General'} | Stock: ${item.stock}`)
    ].join('\n');

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sgse-report.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h3>Reports and print-ready summaries</h3>
      <div className="stats-grid">
        <div className="stat-card"><h4>Total sales</h4><p>₹{summary.totalSales.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Total purchases</h4><p>₹{summary.totalPurchases.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Total returns</h4><p>₹{summary.totalReturns.toLocaleString()}</p></div>
        <div className="stat-card"><h4>Invoice count</h4><p>{summary.invoiceCount}</p></div>
      </div>

      <div className="panel">
        <h4>Stock report</h4>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Category</th>
              <th>Spec</th>
              <th>Stock</th>
              <th>Sale Price</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((item) => (
              <tr key={item._id}>
                <td>{item.name}</td>
                <td>{item.itemType}</td>
                <td>{item.category || 'General'}</td>
                <td>{item.specification || '-'}</td>
                <td>{item.stock}</td>
                <td>₹{item.salePrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inline-actions">
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/stock/export', 'stock.csv')}>Download stock CSV</button>
        </div>
      </div>

      <div className="panel">
        <div className="inline-actions">
          <button className="btn primary" type="button" onClick={() => downloadReport('/reports/invoices/export', 'invoices.csv')}>Download invoices CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/sales/export', 'sales.csv')}>Download sales CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/purchases/export', 'purchases.csv')}>Download purchases CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/returns/export', 'returns.csv')}>Download returns CSV</button>
          <button className="btn secondary" type="button" onClick={downloadPdfReport}>Download PDF report</button>
          <button className="btn secondary" type="button" onClick={() => window.print()}>Print report</button>
        </div>
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
