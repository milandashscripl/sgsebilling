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

const LEAD_STATUS_OPTIONS = ['Not Yet Called', 'No Response', 'Hot Lead', 'Warm Lead', 'Cool Lead', 'May Convert', 'Following Up', 'Not Interested'];

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

const getStageClass = (status) => {
  const label = (status || '').toLowerCase();
  if (label.includes('hot')) return 'status-hot-lead';
  if (label.includes('warm')) return 'status-warm-lead';
  if (label.includes('cool')) return 'status-cool-lead';
  if (label.includes('no response')) return 'status-cool-lead';
  if (label.includes('not yet')) return 'status-following-up';
  if (label.includes('convert')) return 'status-may-convert';
  if (label.includes('following')) return 'status-following-up';
  if (label.includes('not')) return 'status-not-interested';
  return 'status-following-up';
};

const normalizeContactValue = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

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
        {user ? <AuthenticatedApp user={user} setUser={setUser} logout={logout} /> : <PublicApp setUser={setUser} />}
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

function AuthenticatedApp({ user, setUser, logout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  return (
    <div>
      <nav className="topbar">
        <button className="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><span></span><span></span><span></span></button>
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
        {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={closeSidebar} />}
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark">SG</span>
            <div>
              <strong>SGSE</strong>
              <small>Business hub</small>
            </div>
          </div>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/dashboard">Dashboard</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/items">Items</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/stock">Stock</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/billing">Billing</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/setups">Setup library</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/contacts">Contacts</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/accounting">Accounting</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/employees">People & payroll</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/reports">Reports</NavLink>
          <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/profile">Shop profile</NavLink>
          {user.role === 'admin' && <NavLink onClick={closeSidebar} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} to="/users">Users</NavLink>}
        </aside>
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/billing" element={<BillingPage user={user} />} />
            <Route path="/setups" element={<SetupLibraryPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/accounting" element={<AccountingPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ShopProfilePage user={user} setUser={setUser} />} />
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
  const [form, setForm] = useState({ name: '', callerName: '', contactNumber: '', consumerNumber: '', status: 'Not Yet Called', review: '', nextFollowUp: '', markContacted: false });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [callForm, setCallForm] = useState({ contactId: null, note: '', outcome: 'Contacted', leadStage: 'Warm Lead', timestamp: toLocalDateTimeValue() });
  const [selectedCaller, setSelectedCaller] = useState(null);
  const [visibleContacts, setVisibleContacts] = useState(20);
  const [expandedContactId, setExpandedContactId] = useState(null);

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

  const reset = () => { setForm({ name: '', callerName: '', contactNumber: '', consumerNumber: '', status: 'Not Yet Called', review: '', nextFollowUp: '', markContacted: false }); setEditingId(null); };

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
        callerName: contact?.callerName || 'Not assigned',
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
    not_yet_called: contacts.filter(c => c.status === 'Not Yet Called' || !c.callHistory || c.callHistory.length === 0).length,
    hot: contacts.filter(c => c.status === 'Hot Lead').length,
    warm: contacts.filter(c => c.status === 'Warm Lead').length,
    cool: contacts.filter(c => c.status === 'Cool Lead').length,
    notinterested: contacts.filter(c => c.status === 'Not Interested').length,
    no_response: contacts.filter(c => c.status === 'No Response' || !c.callHistory || c.callHistory.length === 0).length,
    may_convert: contacts.filter(c => c.status === 'May Convert').length,
    following_up: contacts.filter(c => c.status === 'Following Up').length
  };

  const duplicateConsumerNumbers = new Set(contacts.map((contact) => normalizeContactValue(contact.consumerNumber)).filter(Boolean).filter((number, index, values) => values.indexOf(number) !== index));
  const duplicateContacts = contacts.filter((contact) => duplicateConsumerNumbers.has(normalizeContactValue(contact.consumerNumber)));
  const similarContacts = contacts.filter((contact, index, list) => {
    const name = normalizeContactValue(contact.name);
    const mobile = normalizeContactValue(contact.contactNumber);
    return list.some((other, otherIndex) => otherIndex !== index && ((name && name === normalizeContactValue(other.name)) || (mobile && mobile === normalizeContactValue(other.contactNumber))));
  });

  const filtered = contacts.filter(c => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const callerName = (c.callerName || '').toLowerCase();
      const customerName = (c.name || '').toLowerCase();
      const contactNumber = (c.contactNumber || '').toLowerCase();
      const consumerNumber = (c.consumerNumber || '').toLowerCase();
      if (!callerName.includes(s) && !customerName.includes(s) && !contactNumber.includes(s) && !consumerNumber.includes(s)) return false;
    }
    if (statusTab === 'duplicates' && !duplicateContacts.includes(c)) return false;
    if (statusTab === 'similars' && !similarContacts.includes(c)) return false;
    if (statusTab === 'not_yet_called' && c.status !== 'Not Yet Called' && c.callHistory && c.callHistory.length) return false;
    if (statusTab === 'hot' && c.status !== 'Hot Lead') return false;
    if (statusTab === 'warm' && c.status !== 'Warm Lead') return false;
    if (statusTab === 'cool' && c.status !== 'Cool Lead') return false;
    if (statusTab === 'notinterested' && c.status !== 'Not Interested') return false;
    if (statusTab === 'no_response' && c.status !== 'No Response' && c.callHistory && c.callHistory.length) return false;
    if (statusTab === 'may_convert' && c.status !== 'May Convert') return false;
    if (statusTab === 'following_up' && c.status !== 'Following Up') return false;
    if (selectedCaller && (c.callerName || 'Not assigned') !== selectedCaller) return false;
    return true;
  });

  const tabContacts = statusTab === 'all' ? contacts : contacts.filter((contact) => {
    if (statusTab === 'not_yet_called') return contact.status === 'Not Yet Called' || !contact.callHistory || contact.callHistory.length === 0;
    if (statusTab === 'no_response') return contact.status === 'No Response' || !contact.callHistory || contact.callHistory.length === 0;
    if (statusTab === 'duplicates') return duplicateContacts.includes(contact);
    if (statusTab === 'similars') return similarContacts.includes(contact);
    const status = { hot: 'Hot Lead', warm: 'Warm Lead', cool: 'Cool Lead', notinterested: 'Not Interested' }[statusTab];
    if (statusTab === 'may_convert') return contact.status === 'May Convert';
    if (statusTab === 'following_up') return contact.status === 'Following Up';
    return !status || contact.status === status;
  });
  const callerList = [...new Set(tabContacts.map(c => (c.callerName || 'Not assigned').trim() || 'Not assigned'))].sort();
  
  const handleStatusTabChange = (tab) => {
    setStatusTab(tab);
    setSelectedCaller(null);
    setVisibleContacts(20);
  };

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
          <button className={statusTab==='all'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('all')}>All ({counts.all})</button>
          <button className={statusTab==='not_yet_called'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('not_yet_called')}>Not yet called ({counts.not_yet_called})</button>
          <button className={statusTab==='hot'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('hot')}>Hot ({counts.hot})</button>
          <button className={statusTab==='warm'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('warm')}>Warm ({counts.warm})</button>
          <button className={statusTab==='cool'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('cool')}>Cool ({counts.cool})</button>
          <button className={statusTab==='notinterested'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('notinterested')}>Not interested ({counts.notinterested})</button>
          <button className={statusTab==='no_response'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('no_response')}>No response ({counts.no_response})</button>
          <button className={statusTab==='may_convert'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('may_convert')}>May convert ({counts.may_convert})</button>
          <button className={statusTab==='following_up'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('following_up')}>Following up ({counts.following_up})</button>
          <button className={statusTab==='duplicates'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('duplicates')}>Duplicate consumers ({duplicateContacts.length})</button>
          <button className={statusTab==='similars'?'btn primary':'btn outline'} onClick={()=>handleStatusTabChange('similars')}>Similar names / mobiles ({similarContacts.length})</button>
          <input className="search-field" placeholder="Search caller, customer or number" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
        </div>

        {callerList.length > 0 && (
          <div className="caller-tabs">
            <span className="caller-tabs-label">Caller</span>
            <button className={!selectedCaller ? 'btn primary' : 'btn outline'} onClick={() => setSelectedCaller(null)}>All callers ({tabContacts.length})</button>
            {callerList.map((caller) => {
              const callerCount = tabContacts.filter(c => (c.callerName || 'Not assigned').trim() === caller).length;
              return (
                <button 
                  key={caller}
                  className={selectedCaller === caller ? 'btn primary' : 'btn outline'}
                  onClick={() => setSelectedCaller(caller)}
                  style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                >
                  {caller} ({callerCount})
                </button>
              );
            })}
          </div>
        )}

        {loading ? <p className="muted">Loading...</p> : (
          filtered.length === 0 ? <p className="muted empty-state-inline">No contacts in this pipeline.</p> : (
            <div className="contacts-list">
              {filtered.slice(0, visibleContacts).map((c) => {
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
                    {c.callHistory?.length > 0 && <div className="history-toggle-row"><button className="btn outline" type="button" onClick={() => setExpandedContactId(expandedContactId === id ? null : id)}>{expandedContactId === id ? 'Hide call history' : `View call history (${c.callHistory.length})`}</button></div>}
                    {expandedContactId === id && <div className="call-history" aria-label={`Call history for ${c.name}`}>
                      {[...(c.callHistory || [])].reverse().map((call, index) => <div className="call-history-entry" key={`${call.timestamp}-${index}`}>
                        <div className="history-entry-head"><strong>{call.callerName || callerName}</strong><span className={`status-badge ${getStageClass(call.status)}`}>{call.status || 'Unknown'}</span></div>
                        <div className="muted">{call.timestamp ? formatAbsoluteDate(call.timestamp) : 'Unknown time'} • {call.outcome || 'Contacted'}</div>
                        <div className="history-review">{call.note || 'No review recorded'}</div>
                      </div>)}
                    </div>}
                  </div>
                );
              })}
            </div>
          )
        )}
        {!loading && filtered.length > visibleContacts && <button className="btn outline list-expander" onClick={() => setVisibleContacts((count) => count + 20)}>Show more contacts ({filtered.length - visibleContacts} remaining)</button>}
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [items, setItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [dailyProgress, setDailyProgress] = useState({ callsToday: 0, contactedToday: 0, followUpsToday: 0, newLeadsToday: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/items'),
      api.get('/contacts'),
      api.get('/reports/daily-progress')
    ]).then(([summaryRes, itemsRes, contactsRes, dailyRes]) => {
      setSummary(summaryRes.data || {});
      setItems(itemsRes.data || []);
      setContacts(contactsRes.data || []);
      setDailyProgress(dailyRes.data || {});
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

      <div className="panel daily-progress-panel">
        <div className="panel-header"><div><p className="eyebrow">Today at a glance</p><h4>Calling progress</h4></div><span className="chip">{dailyProgress.date || 'Today'}</span></div>
        <div className="daily-progress-grid">
          <div><strong>{dailyProgress.callsToday || 0}</strong><span>Calls logged</span></div>
          <div><strong>{dailyProgress.contactedToday || 0}</strong><span>Contacts reached</span></div>
          <div><strong>{dailyProgress.followUpsToday || 0}</strong><span>Follow-ups</span></div>
          <div><strong>{dailyProgress.newLeadsToday || 0}</strong><span>New leads</span></div>
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

function SetupLibraryPage() {
  const [items, setItems] = useState([]);
  const [setups, setSetups] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', itemId: '', quantity: '1', price: '' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [itemsResponse, setupsResponse] = await Promise.all([api.get('/items'), api.get('/setups')]);
    setItems(itemsResponse.data || []);
    setSetups(setupsResponse.data || []);
  };
  useEffect(() => { load().catch(() => setMessage('Unable to load setup library')); }, []);

  const addItem = () => {
    const item = items.find((entry) => entry._id === form.itemId);
    if (!item) return;
    setSelectedItems((current) => [...current.filter((entry) => entry.item !== item._id), { item: item._id, name: item.name, quantity: Math.max(1, Number(form.quantity || 1)), price: Number(form.price || item.salePrice || 0) }]);
    setForm({ ...form, itemId: '', quantity: '1', price: '' });
  };
  const save = async (event) => {
    event.preventDefault();
    try {
      await api.post('/setups', { name: form.name, description: form.description, items: selectedItems });
      setForm({ name: '', description: '', itemId: '', quantity: '1', price: '' });
      setSelectedItems([]);
      setMessage('Standard setup saved');
      await load();
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to save setup'); }
  };
  const remove = async (id) => { if (!window.confirm('Delete this setup?')) return; await api.delete(`/setups/${id}`); await load(); };

  return <div className="setup-library-page">
    <div className="page-header"><p className="eyebrow">Reusable billing templates</p><h3>Setup library</h3><p className="muted">Create standard solar installation packages once and load them into any setup bill.</p></div>
    <form className="panel setup-library-form" onSubmit={save}><h4>Create standard setup</h4><div className="form-grid"><input required placeholder="Setup name (e.g. 3KW On-grid)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}><option value="">Choose item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /><input type="number" min="0" placeholder="Price override (optional)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><button className="btn secondary" type="button" onClick={addItem}>Add item</button></div>{selectedItems.length > 0 && <div className="setup-item-summary">{selectedItems.map((item) => <span key={item.item}>{item.name} × {item.quantity} at ₹{item.price}</span>)}</div>}<button className="btn primary" type="submit">Save standard setup</button>{message && <p className="status-message">{message}</p>}</form>
    <div className="setup-library-grid">{setups.map((setup) => <article className="panel setup-card" key={setup._id}><div className="panel-header"><div><h4>{setup.name}</h4><p className="muted">{setup.description || 'Standard installation package'}</p></div><button className="btn outline" type="button" onClick={() => remove(setup._id)}>Delete</button></div><ul>{(setup.items || []).map((item) => <li key={item.item}>{item.name} <span>× {item.quantity} • ₹{Number(item.price || 0).toLocaleString()}</span></li>)}</ul></article>)}</div>
  </div>;
}

function BillingPage({ user }) {
  const [items, setItems] = useState([]);
  const [setups, setSetups] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [setupItems, setSetupItems] = useState([]);
  const [setupName, setSetupName] = useState('');
  const [setupDescription, setSetupDescription] = useState('');
  const [setupItemId, setSetupItemId] = useState('');
  const [setupItemQuantity, setSetupItemQuantity] = useState('1');
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

  useEffect(() => {
    Promise.all([api.get('/items'), api.get('/setups')]).then(([itemsRes, setupsRes]) => {
      setItems(itemsRes.data || []);
      setSetups(setupsRes.data || []);
    });
  }, []);

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

  const selectSetup = (setupId) => {
    const setup = setups.find((entry) => entry._id === setupId);
    if (!setup) return;
    setType('setup');
    setSelectedItems((setup.items || []).map((entry) => ({
      item: entry.item,
      name: entry.name,
      quantity: Number(entry.quantity || 1),
      price: Number(entry.price || 0),
      sgstRate: 0,
      cgstRate: 0,
      igstRate: 0,
      total: Number(entry.quantity || 1) * Number(entry.price || 0)
    })));
  };

  const addSetupItem = () => {
    const item = items.find((entry) => entry._id === setupItemId);
    if (!item) return;
    setSetupItems((previous) => [...previous.filter((entry) => entry.item !== item._id), {
      item: item._id, name: item.name, quantity: Math.max(1, Number(setupItemQuantity || 1)), price: Number(item.salePrice || 0)
    }]);
    setSetupItemId('');
    setSetupItemQuantity('1');
  };

  const saveSetup = async () => {
    if (!setupName.trim() || !setupItems.length) return setBillingMessage('Add a name and at least one item to save a setup');
    try {
      const response = await api.post('/setups', { name: setupName, description: setupDescription, items: setupItems });
      setSetups((previous) => [...previous, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setSetupName('');
      setSetupDescription('');
      setSetupItems([]);
      setBillingMessage('Setup saved and ready for billing');
    } catch (error) {
      setBillingMessage(error.response?.data?.message || 'Unable to save setup');
    }
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
        subtotal,
        gstAmount,
        grandTotal: total,
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

  const total = selectedItems.reduce((sum, entry) => sum + entry.quantity * entry.price, 0);
  const subtotal = selectedItems.reduce((sum, entry) => {
    const taxRate = Number(entry.sgstRate || 0) + Number(entry.cgstRate || 0) + Number(entry.igstRate || 0);
    return sum + ((entry.quantity * entry.price) / (1 + taxRate / 100));
  }, 0);
  const gstAmount = total - subtotal;

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
                  <option value="setup">Setup billing</option>
            </select>
          </div>

          <div className="setup-tools">
            <div className="panel-header"><div><h4>Reusable setups</h4><p className="muted">Save a standard installation package once, then load it into a bill.</p></div></div>
            <div className="form-grid">
              <select value="" onChange={(e) => selectSetup(e.target.value)}>
                <option value="">Select saved setup</option>
                {setups.map((setup) => <option key={setup._id} value={setup._id}>{setup.name}</option>)}
              </select>
              <input placeholder="Setup name" value={setupName} onChange={(e) => setSetupName(e.target.value)} />
              <input placeholder="Description (optional)" value={setupDescription} onChange={(e) => setSetupDescription(e.target.value)} />
              <select value={setupItemId} onChange={(e) => setSetupItemId(e.target.value)}>
                <option value="">Add item to setup</option>
                {items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
              <input type="number" min="1" placeholder="Qty" value={setupItemQuantity} onChange={(e) => setSetupItemQuantity(e.target.value)} />
              <button className="btn secondary" type="button" onClick={addSetupItem}>Add setup item</button>
              <button className="btn primary" type="button" onClick={saveSetup}>Save setup</button>
            </div>
            {setupItems.length > 0 && <p className="muted">Template: {setupItems.map((entry) => `${entry.name} × ${entry.quantity}`).join(', ')}</p>}
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
              <span>{type === 'sale' ? 'Sale Invoice' : type === 'purchase' ? 'Purchase Invoice' : type === 'setup' ? 'Setup Billing' : 'Return Invoice'}</span>
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
                    <div className="muted">₹{Number(entry.price).toFixed(2)} incl. GST × {entry.quantity}</div>
                  </div>
                  <div className="invoice-item-actions">
                    <button className="btn small" onClick={() => updateQty(entry.item, -1)}>-</button>
                    <span>{entry.quantity}</span>
                    <button className="btn small" onClick={() => updateQty(entry.item, 1)}>+</button>
                  </div>
                  <div className="price-box">
                    <label>Price incl. GST<input className="line-price" type="number" min="0" step="0.01" value={entry.price} onChange={(e) => setSelectedItems((previous) => previous.map((line) => line.item === entry.item ? { ...line, price: Number(e.target.value || 0) } : line))} aria-label={`Price including GST for ${entry.name}`} /></label>
                    <small>Basic ₹{(Number(entry.price || 0) / (1 + (Number(entry.sgstRate || 0) + Number(entry.cgstRate || 0) + Number(entry.igstRate || 0)) / 100)).toFixed(2)}</small>
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
  const [summary, setSummary] = useState({ accounts: [], paymentMethods: [], incomeTotal: 0, expenseTotal: 0, netCash: 0, receivables: 0 });
  const [accountForm, setAccountForm] = useState({ name: '', type: 'cash', openingBalance: '0', notes: '' });
  const [transactionForm, setTransactionForm] = useState({ accountId: '', type: 'income', amount: '', paymentMethod: 'cash', reference: '', note: '' });
  const [expenseForm, setExpenseForm] = useState({ date: toLocalDateTimeValue(), category: '', amount: '', accountId: '', paymentMethod: 'cash', note: '' });
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', note: '' });
  const [depositForm, setDepositForm] = useState({ accountId: '', amount: '', paymentMethod: 'cash', reference: '', note: '' });
  const [message, setMessage] = useState('');
  const [accountingPageSize, setAccountingPageSize] = useState(20);
  const [accountingPage, setAccountingPage] = useState(0);

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

  const transferMoney = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounting/transfer', { ...transferForm, amount: Number(transferForm.amount || 0) });
      setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', note: '' });
      setMessage('Transfer posted: source debited and destination credited');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to transfer money');
    }
  };

  const addMoney = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/accounting/accounts/${depositForm.accountId}/deposit`, { ...depositForm, amount: Number(depositForm.amount || 0) });
      setDepositForm({ accountId: '', amount: '', paymentMethod: 'cash', reference: '', note: '' });
      setMessage('Money added directly to the selected account');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to add money');
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
      const rows = transactionHistory.map((entry) => [entry.date, entry.accountName, entry.kind, entry.reference, entry.type === 'income' ? entry.amount : -entry.amount, entry.balanceAfter].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = ['date,account,entry,reference,change,balanceAfter', ...rows].join('\n');
      const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'account-transaction-history.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to export expenses');
    }
  };

  const downloadExpensePdf = () => {
    if (!transactionHistory.length) {
      setMessage('No account history to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    const lineHeight = 7;
    let y = 16;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Account Transaction History', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, margin, y);
    y += 12;

    doc.setFillColor(238, 243, 255);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    doc.text('Date / account / entry', margin + 2, y);
    doc.text('Balance', pageWidth - margin - 22, y, { align: 'right' });
    y += 10;

    transactionHistory.slice(0, 40).forEach((entry) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${entry.date} • ${entry.accountName}`, margin + 2, y);
      doc.text(`₹${Number(entry.balanceAfter || 0).toLocaleString()}`, pageWidth - margin - 2, y, { align: 'right' });
      y += lineHeight;
      doc.setFontSize(8);
      doc.text(`${entry.kind} • ${entry.reference || entry.note || 'No reference'} • ${entry.type === 'income' ? '+' : '-'}₹${Number(entry.amount || 0).toLocaleString()}`, margin + 2, y);
      y += 4;
      doc.setFontSize(10);
    });

    doc.save('account-transaction-history.pdf');
  };

  const transactionHistory = (() => {
    const openingBalances = Object.fromEntries(accounts.map((account) => [account._id, Number(account.openingBalance || 0)]));
    const runningBalances = { ...openingBalances };
    const entries = [
      ...transactions.map((entry) => ({ ...entry, kind: 'Ledger entry', accountKey: String(entry.accountId || '') })),
      ...expenses.map((entry) => ({ ...entry, kind: 'Expense', type: 'expense', accountKey: String(entry.accountId || '') }))
    ].sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));
    return entries.map((entry) => {
      const amount = Number(entry.amount || 0);
      const account = accounts.find((item) => String(item._id) === entry.accountKey);
      runningBalances[entry.accountKey] = (runningBalances[entry.accountKey] || 0) + (entry.type === 'income' ? amount : -amount);
      return { ...entry, accountName: account?.name || 'Unassigned account', balanceAfter: runningBalances[entry.accountKey] || 0 };
    }).reverse();
  })();

  return (
    <div className="accounting-page">
      <h3>Accounting and daily cash book</h3>
      {message && <p className="muted">{message}</p>}

      <div className="stats-grid">
        <div className="stat-card"><h4>Income total</h4><p>₹{(summary.incomeTotal || 0).toLocaleString()}</p></div>
        <div className="stat-card"><h4>Expense total</h4><p>₹{(summary.expenseTotal || 0).toLocaleString()}</p></div>
        <div className="stat-card stat-purchases"><h4>Net cash movement</h4><p>₹{(summary.netCash || 0).toLocaleString()}</p><span>Income less expenses</span></div>
        <div className="stat-card stat-returns"><h4>Receivables</h4><p>₹{(summary.receivables || 0).toLocaleString()}</p><span>Outstanding invoices</span></div>
      </div>

      <div className="panel acct-balances-panel">
        <h4>Account balances</h4>
        <div className="account-cards-grid">
          {summary.accounts.map((account) => (
            <div className={`account-balance-card account-type-${account.type || 'other'}`} key={account._id}>
              <div className="account-card-top"><span className="account-type-icon">{account.type === 'bank' ? 'B' : account.type === 'digital' ? 'D' : account.type === 'cash' ? 'C' : 'A'}</span><div className="account-card-info"><strong>{account.name}</strong><span className="account-type-label">{account.type}</span></div></div>
              <strong className="account-balance-amount">₹{Number(account.balance || 0).toLocaleString()}</strong>
              <span className="muted">{account.notes || 'No notes'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h4>Create an account</h4>
        <p className="muted">Use a clear name such as Cash in hand, HDFC Bank, or PhonePe wallet. The type helps you scan balances.</p>
        <form className="form-grid" onSubmit={addAccount}>
          <input placeholder="Account name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
          <select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="digital">Digital</option>
            <option value="other">Other</option>
          </select>
          <input placeholder="Opening balance" value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })} />
          <input placeholder="Notes" value={accountForm.notes} onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} />
          <button className="btn primary" type="submit">Create account</button>
        </form>
      </div>

      <div className="accounting-action-grid">
        <div className="panel">
          <h4>Move money between accounts</h4>
          <p className="muted">Example: withdraw from HDFC Bank to Cash in hand. Bank is debited; cash is credited.</p>
          <form className="form-grid" onSubmit={transferMoney}>
            <select value={transferForm.fromAccountId} onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}>
              <option value="">From account</option>
              {accounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
            </select>
            <select value={transferForm.toAccountId} onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}>
              <option value="">To account</option>
              {accounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
            </select>
            <input type="number" min="0.01" step="0.01" placeholder="Amount" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
            <input placeholder="Purpose / note" value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} />
            <button className="btn primary" type="submit">Post transfer</button>
          </form>
        </div>
        <div className="panel">
          <h4>Add money directly</h4>
          <p className="muted">Use this for opening cash, a bank deposit, or money received outside an invoice.</p>
          <form className="form-grid" onSubmit={addMoney}>
            <select value={depositForm.accountId} onChange={(e) => setDepositForm({ ...depositForm, accountId: e.target.value })}>
              <option value="">Select account</option>
              {accounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
            </select>
            <input type="number" min="0.01" step="0.01" placeholder="Amount" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} />
            <select value={depositForm.paymentMethod} onChange={(e) => setDepositForm({ ...depositForm, paymentMethod: e.target.value })}>
              <option value="cash">Cash</option><option value="bank">Bank deposit</option><option value="phonepe">PhonePe</option><option value="gpay">GPay</option><option value="neft">NEFT</option>
            </select>
            <input placeholder="Reference / note" value={depositForm.reference} onChange={(e) => setDepositForm({ ...depositForm, reference: e.target.value })} />
            <button className="btn primary" type="submit">Add to account</button>
          </form>
        </div>
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
            <button className="btn secondary" type="button" onClick={downloadExpenseCsv}>Export Excel / CSV</button>
            <button className="btn secondary" type="button" onClick={downloadExpensePdf}>Export PDF</button>
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

      <div className="panel transaction-history-panel">
        <div className="panel-header">
          <div><h4>Complete account history</h4><p className="muted">Every income, expense, and transfer in date order. Balance is shown after each entry.</p></div>
          <strong>{transactionHistory.length} entries</strong>
        </div>
        {transactionHistory.slice(accountingPage * accountingPageSize, (accountingPage + 1) * accountingPageSize).map((entry) => (
          <div className="list-row transaction-history-row" key={`${entry.kind}-${entry._id}`}>
            <div>
              <strong>{entry.reference || entry.note || entry.kind}</strong>
              <div className="muted">{entry.date} • {entry.accountName} • {entry.kind} • {entry.paymentMethod || 'cash'}</div>
            </div>
            <div className="transaction-values"><strong className={entry.type === 'income' ? 'money-in' : 'money-out'}>{entry.type === 'income' ? '+' : '-'} ₹{Number(entry.amount || 0).toLocaleString()}</strong><span>Balance ₹{Number(entry.balanceAfter || 0).toLocaleString()}</span></div>
          </div>
        ))}
        <div className="table-controls">
          <label>Rows per page<select value={accountingPageSize} onChange={(e) => { setAccountingPageSize(Number(e.target.value)); setAccountingPage(0); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
          <span className="muted">Showing {transactionHistory.length ? accountingPage * accountingPageSize + 1 : 0}-{Math.min((accountingPage + 1) * accountingPageSize, transactionHistory.length)} of {transactionHistory.length}</span>
          <button className="btn outline" disabled={accountingPage === 0} onClick={() => setAccountingPage((page) => page - 1)}>Previous</button>
          <button className="btn outline" disabled={(accountingPage + 1) * accountingPageSize >= transactionHistory.length} onClick={() => setAccountingPage((page) => page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function StockPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

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
                {items.slice(page * pageSize, (page + 1) * pageSize).map((item) => {
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
        <div className="table-controls">
          <label>Rows per page<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
          <span className="muted">Showing {items.length ? page * pageSize + 1 : 0}-{Math.min((page + 1) * pageSize, items.length)} of {items.length}</span>
          <button className="btn outline" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <button className="btn outline" disabled={(page + 1) * pageSize >= items.length} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [stock, setStock] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [callPage, setCallPage] = useState(0);
  const [stockPage, setStockPage] = useState(0);

  useEffect(() => {     
    setLoading(true);
    Promise.all([
      api.get('/reports/summary').then((res) => setSummary(res.data)),
      api.get('/reports/stock').then((res) => setStock(res.data)),
      api.get('/reports/calling').then((res) => setCalls(res.data))
    ]).finally(() => setLoading(false));
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

  const downloadPdfReport = (reportType = 'summary') => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;
      const lineHeight = 7;
      const pageMargin = 15;
      const pageWidthUsable = pageWidth - 2 * pageMargin;

      const addTitle = (title) => {
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(title, pageMargin, yPos);
        yPos += 10;
      };

      const addSectionHeader = (header) => {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(header, pageMargin, yPos);
        yPos += 8;
      };

      const addLine = (label, value) => {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`${label}: ${value}`, pageMargin, yPos);
        yPos += lineHeight;
      };

      const addTable = (headers, rows) => {
        if (yPos + rows.length * 6 > pageHeight - pageMargin) {
          doc.addPage();
          yPos = pageMargin;
        }

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        const colWidth = (pageWidthUsable - pageMargin) / headers.length;
        headers.forEach((header, idx) => {
          doc.text(header, pageMargin + idx * colWidth, yPos);
        });
        yPos += 6;

        doc.setFont(undefined, 'normal');
        rows.forEach((row) => {
          if (yPos + 5 > pageHeight - pageMargin) {
            doc.addPage();
            yPos = pageMargin;
          }
          row.forEach((cell, idx) => {
            doc.text(String(cell || '-'), pageMargin + idx * colWidth, yPos);
          });
          yPos += 5;
        });
        yPos += 3;
      };

      const dateStr = new Date().toLocaleDateString('en-IN');
      addTitle('SGSE Billing System - Reports');
      addLine('Generated on', dateStr);
      yPos += 5; 

      if (reportType === 'summary' || reportType === 'all') {
        addSectionHeader('Financial Summary');
        addLine('Total Sales', `₹${summary.totalSales.toLocaleString()}`);
        addLine('Total Purchases', `₹${summary.totalPurchases.toLocaleString()}`);
        addLine('Total Returns', `₹${summary.totalReturns.toLocaleString()}`);
        addLine('Invoice Count', `${summary.invoiceCount}`);
        yPos += 5;
      }

      if (reportType === 'stock' || reportType === 'all') {
        addSectionHeader('Stock Report');
        if (stock.length) {
          const stockHeaders = ['Item', 'Type', 'Category', 'Stock', 'Sale Price'];
          const stockRows = stock.map((item) => [
            item.name || '-',
            item.itemType || '-',
            item.category || '-',
            item.stock || 0,
            `₹${item.salePrice || 0}`
          ]);
          addTable(stockHeaders, stockRows);
        } else {
          addLine('Status', 'No stock data available');
        }
      }

      if (reportType === 'calling' || reportType === 'all') {
        addSectionHeader('Calling Report');
        if (calls.length) {
          const callHeaders = ['Contact', 'Caller', 'Phone', 'Calls', 'Status', 'Last Contact'];
          const callRows = calls.map((c) => [
            c.name || '-',
            c.callerName || 'Not assigned',
            c.contactNumber || '-',
            (c.callHistory || []).length,
            c.status || '-',
            c.lastContacted ? new Date(c.lastContacted).toLocaleDateString('en-IN') : 'Never'
          ]);
          addTable(callHeaders, callRows);
        } else {
          addLine('Status', 'No calling data available');
        }
      }

      const fileName = `sgse-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      window.alert('Unable to generate PDF report');
    }
  };

  const downloadDailyCalls = (section) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daily = calls.flatMap((contact) => (contact.callHistory || []).filter((call) => new Date(call.timestamp) >= start).map((call) => ({ contact, call })));
    const filteredDaily = section === 'all' ? daily : daily.filter(({ call }) => section === 'contacted' ? call.outcome === 'Contacted' : section === 'follow-ups' ? call.outcome === 'Follow-up' : call.status === section);
    const csv = ['contact,caller,phone,outcome,status,timestamp,note', ...filteredDaily.map(({ contact, call }) => [contact.name, contact.callerName || 'Unassigned', contact.contactNumber, call.outcome, call.status, call.timestamp, call.note].map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-calling-${section}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Business analytics</p>
          <h3>Reports & analytics</h3>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h4>Total sales</h4>
          <p>₹{summary.totalSales.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h4>Total purchases</h4>
          <p>₹{summary.totalPurchases.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h4>Total returns</h4>
          <p>₹{summary.totalReturns.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h4>Invoice count</h4>
          <p>{summary.invoiceCount}</p>
        </div>
      </div>

      {/* Calling Report Section */}
      <div className="panel">
        <h4>Calling Report ({calls.length} contacts)</h4>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : calls.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Caller</th>
                <th>Phone</th>
                <th>Calls</th>
                <th>Status</th>
                <th>Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {calls.slice(callPage * pageSize, (callPage + 1) * pageSize).map((c) => (
                <tr key={c._id || c.id}>
                  <td>{c.name}</td>
                  <td>{c.callerName || 'Not assigned'}</td>
                  <td>{c.contactNumber}</td>
                  <td>{(c.callHistory || []).length}</td>
                  <td><span className={`status-badge ${getStageClass(c.status)}`}>{c.status}</span></td>
                  <td>{c.lastContacted ? formatAbsoluteDate(c.lastContacted) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted empty-state-inline">No calling data available</p>
        )}
        <div className="table-controls">
          <label>Rows per page<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCallPage(0); setStockPage(0); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
          <span className="muted">Showing {calls.length ? callPage * pageSize + 1 : 0}-{Math.min((callPage + 1) * pageSize, calls.length)} of {calls.length}</span>
          <button className="btn outline" disabled={callPage === 0} onClick={() => setCallPage((page) => page - 1)}>Previous</button>
          <button className="btn outline" disabled={(callPage + 1) * pageSize >= calls.length} onClick={() => setCallPage((page) => page + 1)}>Next</button>
        </div>
        <div className="inline-actions">
          <button className="btn primary" onClick={() => downloadPdfReport('calling')}>Download Calling PDF</button>
          <button className="btn secondary" onClick={() => downloadReport('/reports/calling/export', 'calling-report.csv')}>Download Calling CSV</button>
          <button className="btn outline" onClick={() => downloadDailyCalls('all')}>Today: all calls</button>
          <button className="btn outline" onClick={() => downloadDailyCalls('contacted')}>Today: contacted</button>
          <button className="btn outline" onClick={() => downloadDailyCalls('follow-ups')}>Today: follow-ups</button>
          <button className="btn outline" onClick={() => downloadDailyCalls('Hot Lead')}>Today: hot leads</button>
        </div>
      </div>

      {/* Stock Report Section */}
      <div className="panel">
        <h4>Stock Report</h4>
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
            {stock.slice(stockPage * pageSize, (stockPage + 1) * pageSize).map((item) => (
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
        <div className="table-controls">
          <label>Rows per page<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCallPage(0); setStockPage(0); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
          <span className="muted">Showing {stock.length ? stockPage * pageSize + 1 : 0}-{Math.min((stockPage + 1) * pageSize, stock.length)} of {stock.length}</span>
          <button className="btn outline" disabled={stockPage === 0} onClick={() => setStockPage((page) => page - 1)}>Previous</button>
          <button className="btn outline" disabled={(stockPage + 1) * pageSize >= stock.length} onClick={() => setStockPage((page) => page + 1)}>Next</button>
        </div>
        <div className="inline-actions">
          <button className="btn primary" onClick={() => downloadPdfReport('stock')}>Download Stock PDF</button>
          <button className="btn secondary" onClick={() => downloadReport('/reports/stock/export', 'stock.csv')}>Download Stock CSV</button>
        </div>
      </div>

      {/* All Reports Download Section */}
      <div className="panel">
        <h4>All Reports & Exports</h4>
        <div className="inline-actions">
          <button className="btn primary" onClick={() => downloadPdfReport('all')}>Download All Reports PDF</button>
          <button className="btn secondary" onClick={() => downloadReport('/reports/invoices/export', 'invoices.csv')}>Invoices CSV</button>
          <button className="btn secondary" onClick={() => downloadReport('/reports/sales/export', 'sales.csv')}>Sales CSV</button>
          <button className="btn secondary" onClick={() => downloadReport('/reports/purchases/export', 'purchases.csv')}>Purchases CSV</button>
          <button className="btn secondary" onClick={() => downloadReport('/reports/returns/export', 'returns.csv')}>Returns CSV</button>
          <button className="btn outline" onClick={() => downloadPdfReport('summary')}>Summary PDF</button>
          <button className="btn outline" onClick={() => window.print()}>Print Page</button>
        </div>
      </div>
    </div>
  );
}

function ShopProfilePage({ user, setUser }) {
  const [form, setForm] = useState({ name: user.name || '', shopName: user.shopName || '', shopAddress: user.shopAddress || '', shopGSTIN: user.shopGSTIN || '', phone: user.phone || '', address: user.address || '', shopLogoUrl: user.shopLogoUrl || '' });
  const [logoFile, setLogoFile] = useState(null);
  const [message, setMessage] = useState('');

  const save = async (event) => {
    event.preventDefault();
    try {
      let nextUser = (await api.put('/auth/me', form)).data.user;
      if (logoFile) {
        const logoData = new FormData();
        logoData.append('logo', logoFile);
        nextUser = (await api.post('/auth/me/logo', logoData, { headers: { 'Content-Type': 'multipart/form-data' } })).data.user;
      }
      localStorage.setItem('user', JSON.stringify(nextUser));
      setUser(nextUser);
      setLogoFile(null);
      setMessage('Shop profile updated. New invoice headers will use these details.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update shop profile');
    }
  };

  return <div className="profile-page">
    <div className="page-header"><p className="eyebrow">Business identity</p><h3>Shop profile</h3><p className="muted">Keep the details on your invoices, receipts, and customer-facing documents accurate.</p></div>
    <form className="panel profile-form" onSubmit={save}>
      <div className="profile-form-heading"><div><h4>Business details</h4><p className="muted">These details are saved to your account.</p></div><div className="profile-mark">{(form.shopName || 'SG').slice(0, 2).toUpperCase()}</div></div>
      <div className="form-grid">
        <label>Your name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Shop name<input value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} /></label>
        <label>Business phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>GSTIN<input value={form.shopGSTIN} onChange={(e) => setForm({ ...form, shopGSTIN: e.target.value })} /></label>
        <label>Invoice address<textarea value={form.shopAddress} onChange={(e) => setForm({ ...form, shopAddress: e.target.value })} /></label>
        <label>Personal address<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label className="logo-upload-field">Shop logo<input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />{logoFile && <small>{logoFile.name}</small>}</label>
      </div>
      {message && <p className="status-message">{message}</p>}
      <button className="btn primary" type="submit">Save shop profile</button>
    </form>
  </div>;
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

const emptyEmployee = { employeeId: '', name: '', phone: '', role: 'Staff', joiningDate: '', monthlySalary: '', monthlyAdvance: '', fuelAllowance: '', incentive: '', otherAllowance: '', active: true };

function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyEmployee);
  const [selectedId, setSelectedId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState({ records: [], daysInMonth: 0 });
  const [attendanceForm, setAttendanceForm] = useState({ checkIn: '09:00', checkOut: '19:30', note: '' });
  const [payslip, setPayslip] = useState(null);
  const [message, setMessage] = useState('');

  const selectedEmployee = employees.find((employee) => String(employee._id) === selectedId);
  const loadEmployees = async () => { const response = await api.get('/employees'); setEmployees(response.data || []); };
  const loadAttendance = async (employeeId = selectedId) => { if (!employeeId) return; const response = await api.get(`/employees/${employeeId}/attendance`, { params: { month } }); setAttendance(response.data || { records: [], daysInMonth: 0 }); };
  const loadPayslip = async (employeeId = selectedId) => { if (!employeeId) return; const response = await api.get(`/employees/${employeeId}/payslip`, { params: { month } }); setPayslip(response.data); };

  useEffect(() => { loadEmployees().catch(() => setMessage('Unable to load employees')); }, []);
  useEffect(() => { if (selectedId) { loadAttendance(); loadPayslip(); } }, [selectedId, month]);

  const saveEmployee = async (event) => {
    event.preventDefault();
    try {
      const response = form._id ? await api.put(`/employees/${form._id}`, form) : await api.post('/employees', form);
      setMessage(form._id ? 'Employee updated' : 'Employee added');
      setForm(emptyEmployee);
      await loadEmployees();
      setSelectedId(String(response.data._id));
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to save employee'); }
  };
  const editEmployee = (employee) => setForm({ ...emptyEmployee, ...employee, _id: employee._id });
  const deleteEmployee = async (id) => { if (!window.confirm('Delete this employee and attendance history?')) return; await api.delete(`/employees/${id}`); setSelectedId(''); setPayslip(null); setMessage('Employee deleted'); await loadEmployees(); };
  const selectEmployee = (employee) => { setSelectedId(String(employee._id)); setForm(emptyEmployee); };
  const saveAttendance = async (event) => { event.preventDefault(); try { await api.post(`/employees/${selectedId}/attendance`, { date: attendanceDate, ...attendanceForm }); setMessage('Attendance saved'); await loadAttendance(); await loadPayslip(); } catch (error) { setMessage(error.response?.data?.message || 'Unable to save attendance'); } };
  const attendanceForDate = attendance.records.find((record) => record.date === attendanceDate);
  const printPayslip = () => { if (!payslip) return; window.print(); };

  return <div className="employees-page">
    <div className="page-header"><p className="eyebrow">People operations</p><h3>Employees & payroll</h3><p className="muted">Manage pay, daily attendance, advances, allowances, and monthly payslips in one place.</p></div>
    {message && <p className="status-message">{message}</p>}
    <div className="employee-layout">
      <section className="panel employee-directory"><div className="panel-header"><div><h4>Employee directory</h4><p className="muted">{employees.length} team member{employees.length === 1 ? '' : 's'}</p></div><button className="btn primary" type="button" onClick={() => setForm(emptyEmployee)}>Add employee</button></div>{employees.map((employee) => <button className={`employee-list-item ${selectedId === String(employee._id) ? 'selected' : ''}`} key={employee._id} type="button" onClick={() => selectEmployee(employee)}><span className="employee-avatar">{employee.name.slice(0, 2).toUpperCase()}</span><span><strong>{employee.name}</strong><small>{employee.employeeId} • {employee.role}</small></span><b>₹{Number(employee.monthlySalary || 0).toLocaleString()}</b></button>)}{!employees.length && <p className="empty-state muted">Add your first employee to start payroll.</p>}</section>
      <form className="panel employee-form" onSubmit={saveEmployee}><div className="panel-header"><div><h4>{form._id ? 'Edit employee' : 'Add employee'}</h4><p className="muted">Fixed monthly pay and deductions</p></div>{form._id && <button className="btn outline" type="button" onClick={() => setForm(emptyEmployee)}>Cancel</button>}</div><div className="form-grid"><label>Employee ID<input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label><label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Role<input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Joining date<input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></label><label>Monthly salary<input required type="number" min="0" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} /></label><label>Monthly advance<input type="number" min="0" value={form.monthlyAdvance} onChange={(e) => setForm({ ...form, monthlyAdvance: e.target.value })} /></label><label>Fuel allowance<input type="number" min="0" value={form.fuelAllowance} onChange={(e) => setForm({ ...form, fuelAllowance: e.target.value })} /></label><label>Incentive<input type="number" min="0" value={form.incentive} onChange={(e) => setForm({ ...form, incentive: e.target.value })} /></label><label>Other allowance<input type="number" min="0" value={form.otherAllowance} onChange={(e) => setForm({ ...form, otherAllowance: e.target.value })} /></label></div><div className="inline-actions"><button className="btn primary" type="submit">{form._id ? 'Save employee' : 'Add employee'}</button>{form._id && <button className="btn secondary" type="button" onClick={() => deleteEmployee(form._id)}>Delete employee</button>}</div></form>
    </div>
    {selectedEmployee && <section className="panel attendance-panel"><div className="panel-header"><div><p className="eyebrow">Daily time clock</p><h4>Attendance for {selectedEmployee.name}</h4></div><label className="month-picker">Payroll month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label></div><p className="muted">Check-in is expected by 9:30 AM. Checkout from 7:30 PM is a full day; earlier checkout is half-day.</p><form className="attendance-form" onSubmit={saveAttendance}><label>Date<input type="date" value={attendanceDate} onChange={(e) => { setAttendanceDate(e.target.value); const record = attendance.records.find((item) => item.date === e.target.value); setAttendanceForm({ checkIn: record?.checkIn || '', checkOut: record?.checkOut || '', note: record?.note || '' }); }} /></label><label>Check in<input type="time" value={attendanceForm.checkIn} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })} /></label><label>Check out<input type="time" value={attendanceForm.checkOut} onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })} /></label><label>Note<input value={attendanceForm.note} onChange={(e) => setAttendanceForm({ ...attendanceForm, note: e.target.value })} placeholder="Optional note" /></label><button className="btn primary" type="submit">Save day</button></form>{attendanceForDate && <p className={`attendance-status ${attendanceForDate.status}`}>{attendanceForDate.status} for {attendanceForDate.date}</p>}</section>}
    {payslip && <section className="panel payslip-panel"><div className="panel-header"><div><p className="eyebrow">Monthly salary slip</p><h4>{payslip.employee.name} • {payslip.month}</h4><p className="muted">{payslip.employee.employeeId} • {payslip.employee.role}</p></div><button className="btn secondary" type="button" onClick={printPayslip}>Print payslip</button></div><div className="payroll-metrics"><div><span>Present</span><strong>{payslip.present}</strong></div><div><span>Half-days</span><strong>{payslip.halfday}</strong></div><div><span>Absent</span><strong>{payslip.absent}</strong></div><div className="payable"><span>Net payable</span><strong>₹{Math.round(payslip.netPay).toLocaleString()}</strong></div></div><div className="payslip-lines"><div><span>Earned salary</span><strong>₹{Math.round(payslip.earnedSalary).toLocaleString()}</strong></div><div><span>Fuel + incentives + other</span><strong>₹{Math.round(payslip.allowances).toLocaleString()}</strong></div><div><span>Advance deduction</span><strong>- ₹{Math.round(payslip.advance).toLocaleString()}</strong></div></div></section>}
  </div>;
}

export default App;
