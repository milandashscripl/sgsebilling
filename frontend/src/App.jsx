import { useEffect, useState } from 'react';
import { Link, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { downloadInvoicePdf } from './utils/invoicePdf';
import api from './api';
// Time helpers (module-level) used across pages
const getNowLocalDateTime = () => new Date().toISOString().slice(0, 16);

const formatAbsoluteDate = (date) => {
  if (!date) return 'Never';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getTimeAgo = (date) => {
  if (!date) return 'Never';
  const then = new Date(date);
  if (isNaN(then.getTime())) return 'Invalid date';
  const now = Date.now();
  const diff = Math.floor((now - then.getTime()) / 1000);
  if (diff < 0) return 'In future';
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatAbsoluteDate(date);
};

const isRecentContact = (date, seconds = 86400) => {
  if (!date) return false;
  const then = new Date(date);
  if (isNaN(then.getTime())) return false;
  const now = Date.now();
  const diff = Math.floor((now - then.getTime()) / 1000);
  return diff >= 0 && diff < seconds;
};
import './animations.css';

// api instance imported from ./api

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
      {user ? <AuthenticatedApp user={user} logout={logout} setUser={setUser} /> : <PublicApp setUser={setUser} />}
    </div>
  );
}

function PublicApp({ setUser }) {
  return (
    <div className="public-screen">
      <div className="hero-card">
        <div className="hero-header">
          <img src="/logo.svg" alt="Suryaghar logo" className="hero-logo" />
          <div>
            <p className="eyebrow">Modern billing & stock management</p>
            <h1>SGSE Billing Suite</h1>
          </div>
        </div>
        <p>Create invoices, manage stock, handle purchases, returns, payments, and reports from one polished workspace.</p>
        <div className="hero-actions">
          <Link className="btn primary" to="/login">Login</Link>
          <Link className="btn secondary" to="/register">Create account</Link>
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

function AuthenticatedApp({ user, logout, setUser }) {
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
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/dashboard">Dashboard</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/items">Items</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/stock">Stock</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/billing">Billing</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/accounting">Accounting</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/contacts">Contacts</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/calling">Calling</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/profile">Shop profile</NavLink>
          <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/reports">Reports</NavLink>
          {user.role === 'admin' && <NavLink className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'} to="/users">Users</NavLink>}
        </aside>
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/accounting" element={<AccountingPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/calling" element={<CallingPage />} />
            <Route path="/profile" element={<ProfilePage user={user} setUser={setUser} />} />
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

import AnalyticsDashboard from './components/AnalyticsDashboard';

function Dashboard({ user }) {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/reports/summary').then((res) => setSummary(res.data));
    api.get('/items').then((res) => setItems(res.data));
  }, []);

  const lowStockItems = items.filter((item) => Number(item.stock) < 5);

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h3>Welcome back, {user.name || 'Manager'}</h3>
          <p className="muted">A concise view of sales, inventory and follow-up activity for fast decisions.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><h4>Total sales</h4><p>₹{summary.totalSales.toLocaleString()}</p><p className="muted">Sales across all invoices</p></div>
        <div className="stat-card"><h4>Total purchases</h4><p>₹{summary.totalPurchases.toLocaleString()}</p><p className="muted">Purchase spend tracked</p></div>
        <div className="stat-card"><h4>Total returns</h4><p>₹{summary.totalReturns.toLocaleString()}</p><p className="muted">Returns and adjustments</p></div>
        <div className="stat-card"><h4>Invoice count</h4><p>{summary.invoiceCount}</p><p className="muted">Invoices generated</p></div>
      </div>

      <AnalyticsDashboard />

      <div className="panel">
        <h4>Stock highlights</h4>
        {lowStockItems.length === 0 ? (
          <p className="muted">No items are critically low in stock right now.</p>
        ) : (
          <ul className="highlight-list">
            {lowStockItems.map((item) => (
              <li key={item._id}>{item.name} — {item.stock} pcs left</li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h4>Quick actions</h4>
        <div className="action-grid">
          <Link className="btn primary" to="/billing">Create new invoice</Link>
          <Link className="btn secondary" to="/stock">Review inventory</Link>
          <Link className="btn secondary" to="/contacts">Follow-up customers</Link>
          <Link className="btn secondary" to="/reports">View reports</Link>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, setUser }) {
  const [form, setForm] = useState({
    shopName: user.shopName || '',
    shopAddress: user.shopAddress || '',
    shopGSTIN: user.shopGSTIN || '',
    shopLogoUrl: user.shopLogoUrl || '',
    phone: user.phone || '',
    address: user.address || ''
  });
  const [message, setMessage] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');

  useEffect(() => {
    setForm({
      shopName: user.shopName || '',
      shopAddress: user.shopAddress || '',
      shopGSTIN: user.shopGSTIN || '',
      shopLogoUrl: user.shopLogoUrl || '',
      phone: user.phone || '',
      address: user.address || ''
    });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await api.put('/auth/me', form);
      const updatedUser = res.data.user;
      setMessage('Profile saved successfully');
      if (setUser) {
        setUser(updatedUser);
      }
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save profile');
    }
  };

  const uploadLogoFile = async (file) => {
    if (!file) return;
    setLogoUploadError('');
    setLogoUploading(true);

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await api.post('/auth/me/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updatedUser = res.data.user;
      setForm((prev) => ({ ...prev, shopLogoUrl: updatedUser.shopLogoUrl }));
      if (setUser) setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setMessage('Logo uploaded successfully');
    } catch (error) {
      setLogoUploadError(error.response?.data?.message || 'Unable to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div>
      <h3>Shop profile & invoice header</h3>
      <form className="panel" onSubmit={saveProfile}>
        <div className="form-grid">
          <input placeholder="Shop name" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
          <input placeholder="Shop address" value={form.shopAddress} onChange={(e) => setForm({ ...form, shopAddress: e.target.value })} />
          <input placeholder="Shop GSTIN" value={form.shopGSTIN} onChange={(e) => setForm({ ...form, shopGSTIN: e.target.value })} />
          <input placeholder="Shop logo URL" value={form.shopLogoUrl} onChange={(e) => setForm({ ...form, shopLogoUrl: e.target.value })} />
          <div>
            <label className="file-label">Upload logo image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadLogoFile(e.target.files?.[0])}
            />
            {logoUploading && <p className="muted">Uploading logo...</p>}
            {logoUploadError && <p className="error">{logoUploadError}</p>}
          </div>
          <input placeholder="Shop phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Shop billing address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        {message && <p className="muted">{message}</p>}
        <button className="btn primary" type="submit">Save profile</button>
      </form>
      {form.shopLogoUrl && (
        <div className="panel">
          <h4>Logo preview</h4>
          <img src={form.shopLogoUrl} alt="Shop logo preview" style={{ maxWidth: '200px', maxHeight: '120px', display: 'block' }} />
          <p className="muted">Use a public image URL or data URI. If the invoice PDF cannot render the logo, view the invoice header text instead.</p>
        </div>
      )}
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

function StockPage() {
  const [items, setItems] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockSearch, setStockSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadStock = async () => {
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
        setMessage(error.response?.data?.message || 'Unable to load stock');
      }
    };
    loadStock();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesStock = item.name.toLowerCase().includes(stockSearch.toLowerCase());
    const matchesType = item.itemType?.toLowerCase().includes(typeSearch.toLowerCase());
    const matchesCategory = item.category?.toLowerCase().includes(categorySearch.toLowerCase());
    return matchesStock && matchesType && matchesCategory;
  });

  const groupedByType = itemTypes.map((type) => ({
    ...type,
    items: filteredItems.filter((item) => item.itemType === type.name)
  })).filter((group) => group.items.length > 0);

  const untypedItems = filteredItems.filter((item) => !item.itemType);
  const groupedByCategory = categories.map((category) => ({
    ...category,
    items: filteredItems.filter((item) => item.category === category.name)
  })).filter((group) => group.items.length > 0);

  const typeStockTotals = groupedByType.map((group) => ({
    name: group.name,
    totalStock: group.items.reduce((sum, item) => sum + (item.stock || 0), 0),
    count: group.items.length
  }));

  return (
    <div>
      <h3>Stock overview</h3>
      <div className="panel">
        <div className="form-grid">
          <input placeholder="Search item name" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} />
          <input placeholder="Filter by type" value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)} />
          <input placeholder="Filter by category" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} />
        </div>
      </div>

      <div className="stats-grid">
        {typeStockTotals.map((group) => (
          <div key={group.name} className="stat-card">
            <h4>{group.name}</h4>
            <p>{group.count} item{group.count !== 1 ? 's' : ''}</p>
            <p>{group.totalStock} total stock</p>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Stock by item type</h4>
        {groupedByType.map((group) => (
          <div className="panel" key={group._id}>
            <h5>{group.name} — {group.items.reduce((sum, item) => sum + (item.stock || 0), 0)} in stock</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Spec</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.category || 'General'}</td>
                    <td>{item.specification || '-'}</td>
                    <td>{item.stock}</td>
                    <td>₹{item.salePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {untypedItems.length > 0 && (
          <div className="panel">
            <h5>Other items</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {untypedItems.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.category || 'General'}</td>
                    <td>{item.stock}</td>
                    <td>₹{item.salePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h4>Stock by category</h4>
        {groupedByCategory.map((group) => (
          <div className="panel" key={group._id}>
            <h5>{group.name} — {group.items.reduce((sum, item) => sum + (item.stock || 0), 0)} in stock</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Spec</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.itemType || 'General'}</td>
                    <td>{item.specification || '-'}</td>
                    <td>{item.stock}</td>
                    <td>₹{item.salePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGSTIN, setPartyGSTIN] = useState('');
  const [type, setType] = useState('sale');
  const [billingMode, setBillingMode] = useState('normal');
  const [singleDescription, setSingleDescription] = useState('Full setup');
  const [singleTotalAfterGst, setSingleTotalAfterGst] = useState('');
  const [singleGstType, setSingleGstType] = useState('cgst-sgst');
  const [singleCgstRate, setSingleCgstRate] = useState('0');
  const [singleSgstRate, setSingleSgstRate] = useState('0');
  const [singleIgstRate, setSingleIgstRate] = useState('0');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [billingMessage, setBillingMessage] = useState('');

  useEffect(() => {
    api.get('/items').then((res) => setItems(res.data));
    api.get('/accounting/accounts').then((res) => setAccounts(res.data)).catch(() => setAccounts([]));
  }, []);

  const addItem = (item) => {
    setSelectedItems((prev) => {
      const existing = prev.find((x) => x.item === item._id);
      if (existing) {
        return prev.map((x) => x.item === item._id ? { ...x, quantity: x.quantity + 1 } : x);
      }

      const price = type === 'purchase' ? item.purchasePrice : item.salePrice;
      return [...prev, { item: item._id, name: item.name, description: item.description || item.name, quantity: 1, unit: item.unit || 'pcs', price, sgstRate: item.sgstRate || 0, cgstRate: item.cgstRate || 0, igstRate: item.igstRate || 0, total: price }];
    });
  };

  const updateQty = (id, delta) => {
    setSelectedItems((prev) => prev.map((entry) => entry.item === id ? { ...entry, quantity: Math.max(1, entry.quantity + delta) } : entry));
  };

  const removeItem = (id) => {
    setSelectedItems((prev) => prev.filter((entry) => entry.item !== id));
  };

  const saveInvoice = async () => {
    if (billingMode === 'normal' && !selectedItems.length) {
      setBillingMessage('Please add at least one item before creating a bill');
      return;
    }

    if (billingMode === 'single' && (!singleTotalAfterGst || Number(singleTotalAfterGst) <= 0)) {
      setBillingMessage('Enter a valid total amount after GST before creating a bill');
      return;
    }

    if (Number(paidAmount) > 0 && !paymentAccount) {
      setBillingMessage('Select an account for the payment');
      return;
    }

    try {
      const singleTaxRate = singleGstType === 'igst'
        ? Number(singleIgstRate) || 0
        : (Number(singleCgstRate) || 0) + (Number(singleSgstRate) || 0);
      const totalAfter = Number(singleTotalAfterGst) || 0;
      const baseAmount = singleTaxRate > 0 ? totalAfter / (1 + singleTaxRate / 100) : totalAfter;
      const gstAmountSingle = totalAfter - baseAmount;

      const itemsPayload = billingMode === 'single'
        ? (selectedItems.length ? selectedItems.map((entry) => ({
            itemId: entry.item,
            name: entry.name,
            quantity: entry.quantity,
            unit: entry.unit,
            price: entry.price,
            sgstRate: entry.sgstRate,
            cgstRate: entry.cgstRate,
            igstRate: entry.igstRate,
            total: entry.quantity * entry.price
          })) : [{
            name: singleDescription || 'Single price service',
            quantity: 1,
            unit: 'pcs',
            price: Number(baseAmount.toFixed(2)),
            sgstRate: singleGstType === 'cgst-sgst' ? Number(singleSgstRate) || 0 : 0,
            cgstRate: singleGstType === 'cgst-sgst' ? Number(singleCgstRate) || 0 : 0,
            igstRate: singleGstType === 'igst' ? Number(singleIgstRate) || 0 : 0,
            total: Number(baseAmount.toFixed(2))
          }])
        : selectedItems.map((entry) => ({
            itemId: entry.item,
            name: entry.name,
            quantity: entry.quantity,
            unit: entry.unit,
            price: entry.price,
            sgstRate: entry.sgstRate,
            cgstRate: entry.cgstRate,
            igstRate: entry.igstRate,
            total: entry.quantity * entry.price
          }));

      const payload = {
        partyName: partyName || customerName,
        partyPhone: partyPhone || customerPhone,
        partyGSTIN,
        customerName,
        customerPhone,
        type,
        items: itemsPayload,
        subtotal: billingMode === 'single' ? Number(baseAmount.toFixed(2)) : undefined,
        gstAmount: billingMode === 'single' ? Number(gstAmountSingle.toFixed(2)) : undefined,
        grandTotal: billingMode === 'single' ? totalAfter : undefined,
        paidAmount: Number(paidAmount) || 0,
        accountId: paymentAccount || undefined,
        paymentMethod,
        notes: notes || ''
      };

      const res = await api.post('/invoices', payload);
      const invoice = res.data;
      setBillingMessage('Invoice created successfully');
      setSelectedItems([]);
      setPartyName('');
      setPartyPhone('');
      setPartyGSTIN('');
      setCustomerName('');
      setCustomerPhone('');
      setSingleDescription('Full setup');
      setSingleTotalAfterGst('');
      setSingleGstType('cgst-sgst');
      setSingleCgstRate('0');
      setSingleSgstRate('0');
      setSingleIgstRate('0');
      setPaidAmount('');
      setNotes('');
      setPaymentAccount('');
      setPaymentMethod('cash');
      setBillingMode('normal');
      downloadInvoicePdf(invoice);
    } catch (error) {
      setBillingMessage(error.response?.data?.message || 'Unable to create invoice');
    }
  };

  const previewInvoice = async () => {
    if (billingMode === 'normal' && !selectedItems.length) {
      setBillingMessage('Please add at least one item before previewing');
      return;
    }
    if (billingMode === 'single' && (!singleTotalAfterGst || Number(singleTotalAfterGst) <= 0)) {
      setBillingMessage('Enter a valid total amount after GST before previewing');
      return;
    }

    const singleTaxRate = singleGstType === 'igst'
      ? Number(singleIgstRate) || 0
      : (Number(singleCgstRate) || 0) + (Number(singleSgstRate) || 0);
    const totalAfter = Number(singleTotalAfterGst) || 0;
    const baseAmount = singleTaxRate > 0 ? totalAfter / (1 + singleTaxRate / 100) : totalAfter;
    const gstAmountSingle = totalAfter - baseAmount;

    const itemsPayload = billingMode === 'single'
      ? (selectedItems.length ? selectedItems.map((entry) => ({
          itemId: entry.item,
          name: entry.name,
          quantity: entry.quantity,
          unit: entry.unit,
          price: entry.price,
          sgstRate: entry.sgstRate,
          cgstRate: entry.cgstRate,
          igstRate: entry.igstRate,
          total: entry.quantity * entry.price
        })) : [{
          name: singleDescription || 'Single price service',
          quantity: 1,
          unit: 'pcs',
          price: Number(baseAmount.toFixed(2)),
          sgstRate: singleGstType === 'cgst-sgst' ? Number(singleSgstRate) || 0 : 0,
          cgstRate: singleGstType === 'cgst-sgst' ? Number(singleCgstRate) || 0 : 0,
          igstRate: singleGstType === 'igst' ? Number(singleIgstRate) || 0 : 0,
          total: Number(baseAmount.toFixed(2))
        }])
      : selectedItems.map((entry) => ({
          itemId: entry.item,
          name: entry.name,
          quantity: entry.quantity,
          unit: entry.unit,
          price: entry.price,
          sgstRate: entry.sgstRate,
          cgstRate: entry.cgstRate,
          igstRate: entry.igstRate,
          total: entry.quantity * entry.price
        }));

    const subtotalPreview = itemsPayload.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);
    const gstPreview = itemsPayload.reduce((s, it) => {
      const base = (it.price || 0) * (it.quantity || 1);
      return s + (base * (it.sgstRate || 0) / 100) + (base * (it.cgstRate || 0) / 100) + (base * (it.igstRate || 0) / 100);
    }, 0);
    const grandTotalPreview = billingMode === 'single' ? Number(totalAfter || 0) : subtotalPreview + gstPreview;

    const invoicePreview = {
      invoiceNumber: `PREVIEW-${Date.now()}`,
      createdAt: new Date().toISOString(),
      partyName: partyName || customerName,
      partyPhone: partyPhone || customerPhone,
      partyGSTIN,
      customerName,
      customerPhone,
      type,
      items: itemsPayload,
      subtotal: Number(subtotalPreview.toFixed(2)),
      gstAmount: Number(gstPreview.toFixed(2)),
      grandTotal: Number(grandTotalPreview.toFixed(2)),
      paidAmount: Number(paidAmount) || 0,
      accountId: paymentAccount || undefined,
      paymentMethod,
      notes: notes || ''
    };

    try {
      sessionStorage.setItem('invoicePreview', JSON.stringify(invoicePreview));
      window.open('/invoice-preview.html', '_blank');
    } catch (e) {
      setBillingMessage('Unable to open preview');
    }
  };

  const subtotal = selectedItems.reduce((sum, entry) => sum + entry.quantity * entry.price, 0);
  const gstAmount = selectedItems.reduce((sum, entry) => {
    const base = entry.quantity * entry.price;
    return sum + (base * (entry.sgstRate || 0) / 100) + (base * (entry.cgstRate || 0) / 100) + (base * (entry.igstRate || 0) / 100);
  }, 0);
  const total = subtotal + gstAmount;

  const singleTaxRate = singleGstType === 'igst'
    ? Number(singleIgstRate) || 0
    : (Number(singleCgstRate) || 0) + (Number(singleSgstRate) || 0);
  const singleTotal = Number(singleTotalAfterGst) || 0;
  const singleBaseAmount = singleTaxRate > 0 ? singleTotal / (1 + singleTaxRate / 100) : singleTotal;
  const singleGstAmount = singleTotal - singleBaseAmount;
  const singleBalance = singleTotal - Number(paidAmount || 0);

  const loadImageAsDataUrl = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Billing</p>
        <h3>Invoice creation</h3>
        <p className="muted">Add items, choose payment details, and generate a polished PDF invoice instantly.</p>
      </div>

      <div className="billing-grid">
        <div className="panel">
          <h4>Invoice details</h4>
          <div className="form-grid">
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>📋 Invoice Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%' }}>
                <option value="sale">Sale (Selling to customer)</option>
                <option value="purchase">Purchase (Buying from supplier)</option>
                <option value="return">Return (Return goods)</option>
              </select>
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Choose whether this is a sale, purchase, or return</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>⚙️ Billing Mode *</label>
              <select value={billingMode} onChange={(e) => setBillingMode(e.target.value)} style={{ width: '100%' }}>
                <option value="normal">Normal Billing (Select items from list)</option>
                <option value="single">Single Price Billing (One line item with fixed total)</option>
              </select>
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Normal for multiple items, Single for complete setup billing</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>🏢 Party/Buyer Name *</label>
              <input placeholder="Enter customer or party name" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Name of the person/company buying from you</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>📱 Party Phone</label>
              <input placeholder="Enter phone number" value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Contact number for billing</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>🔢 Party GSTIN</label>
              <input placeholder="15-digit GSTIN (optional)" value={partyGSTIN} onChange={(e) => setPartyGSTIN(e.target.value)} />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>GST registration number if available</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>👤 Customer Name (Delivery)</label>
              <input placeholder="Person name for delivery" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Name of person receiving delivery</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>📞 Delivery Phone</label>
              <input placeholder="Delivery contact phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Contact for delivery confirmation</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>💳 Payment Account *</label>
              <select value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} style={{ width: '100%' }}>
                <option value="">Select account for payment</option>
                {accounts.map((account) => (
                  <option key={account._id || account.id} value={account._id || account.id}>{account.name} ({account.type})</option>
                ))}
              </select>
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Account where payment will be recorded</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>💰 Payment Method *</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%' }}>
                <option value="cash">💵 Cash</option>
                <option value="phonepe">📱 PhonePe</option>
                <option value="gpay">📱 Google Pay</option>
                <option value="neft">🏦 NEFT</option>
                <option value="rtgs">🏦 RTGS</option>
                <option value="withdrawal">💸 Withdrawal</option>
              </select>
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>How payment was received or will be made</p>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px' }}>📝 Invoice Notes</label>
              <textarea placeholder="Any special terms, warranty info, or notes for this invoice" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: '70px' }} />
              <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Warranty, terms, conditions, or any special notes</p>
            </div>\n          </div>
          {billingMode === 'normal' ? (
            <div className="item-list">
              {items.length ? items.map((item) => (
                <button key={item._id} className="item-chip" onClick={() => addItem(item)}>{item.name} — ₹{type === 'purchase' ? item.purchasePrice : item.salePrice}</button>
              )) : <p className="muted">No items available. Add items in the Items section first.</p>}
            </div>
          ) : (
            <div className="form-grid">
              <input placeholder="Single price description" value={singleDescription} onChange={(e) => setSingleDescription(e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Total amount after GST" value={singleTotalAfterGst} onChange={(e) => setSingleTotalAfterGst(e.target.value)} />
              <select value={singleGstType} onChange={(e) => setSingleGstType(e.target.value)}>
                <option value="cgst-sgst">CGST + SGST</option>
                <option value="igst">IGST</option>
              </select>
              {singleGstType === 'cgst-sgst' ? (
                <>
                  <input type="number" min="0" step="0.01" placeholder="CGST %" value={singleCgstRate} onChange={(e) => setSingleCgstRate(e.target.value)} />
                  <input type="number" min="0" step="0.01" placeholder="SGST %" value={singleSgstRate} onChange={(e) => setSingleSgstRate(e.target.value)} />
                </>
              ) : (
                <input type="number" min="0" step="0.01" placeholder="IGST %" value={singleIgstRate} onChange={(e) => setSingleIgstRate(e.target.value)} />
              )}
              <p className="muted">Enter the final amount including GST. The base price will be calculated automatically.</p>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="billing-panel-header">
            <h4>{billingMode === 'normal' ? 'Selected items' : 'Single price details'}</h4>
            <span className="badge">{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}</span>
          </div>
          {billingMode === 'normal' ? (
            selectedItems.length === 0 ? (
              <p className="muted">No items added yet. Click an item to include it in the invoice.</p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Price</th>
                      <th>GST</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((entry) => {
                      const lineGst = ((entry.quantity * entry.price) * ((entry.sgstRate || 0) + (entry.cgstRate || 0) + (entry.igstRate || 0)) / 100).toFixed(2);
                      return (
                        <tr key={entry.item}>
                          <td>{entry.name}</td>
                          <td>{entry.quantity}</td>
                          <td>{entry.unit}</td>
                          <td>₹{entry.price.toFixed(2)}</td>
                          <td>₹{lineGst}</td>
                          <td>₹{(entry.quantity * entry.price + Number(lineGst)).toFixed(2)}</td>
                          <td><button className="btn secondary" type="button" onClick={() => removeItem(entry.item)}>Remove</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Base price</th>
                    <th>GST</th>
                    <th>Total after GST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{singleDescription || 'Single price service'}</td>
                    <td>₹{singleBaseAmount.toFixed(2)}</td>
                    <td>₹{singleGstAmount.toFixed(2)} ({singleTaxRate.toFixed(2)}%)</td>
                    <td>₹{singleTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="billing-summary">
            <div className="summary-row"><span>Subtotal</span><strong>₹{billingMode === 'normal' ? subtotal.toFixed(2) : singleBaseAmount.toFixed(2)}</strong></div>
            <div className="summary-row"><span>GST</span><strong>₹{billingMode === 'normal' ? gstAmount.toFixed(2) : singleGstAmount.toFixed(2)}</strong></div>
            <div className="summary-row"><span>Total</span><strong>₹{billingMode === 'normal' ? total.toFixed(2) : singleTotal.toFixed(2)}</strong></div>
            <div className="summary-row"><span>Paid</span><strong>₹{Number(paidAmount || 0).toFixed(2)}</strong></div>
            <div className="summary-row"><span>Balance</span><strong>₹{billingMode === 'normal' ? (total - Number(paidAmount || 0)).toFixed(2) : singleBalance.toFixed(2)}</strong></div>
            <div className="summary-row"><span>Payment</span><strong>{paymentMethod}</strong></div>
          </div>
          <input type="number" min="0" step="0.01" placeholder="Paid amount" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
          {billingMessage && <p className="message">{billingMessage}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn outline" type="button" onClick={previewInvoice}>Preview</button>
            <button className="btn primary" onClick={saveInvoice}>Create invoice</button>
          </div>
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
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', accountId: '', paymentMethod: 'cash', note: '' });
  const [message, setMessage] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [expenseSearchText, setExpenseSearchText] = useState('');
  const [expensePaymentFilter, setExpensePaymentFilter] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');

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

  const applyDateFilter = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr);
  };

  const filteredExpenses = expenses.filter((exp) => {
    try {
      const expDate = exp.date ? new Date(exp.date) : null;
      const from = applyDateFilter(filterFromDate);
      const to = applyDateFilter(filterToDate);
      if (from && expDate && expDate < from) return false;
      if (to && expDate && expDate > to) return false;
      if (expenseSearchText) {
        const txt = expenseSearchText.toLowerCase();
        if (!((exp.category || '').toLowerCase().includes(txt) || (exp.note || '').toLowerCase().includes(txt))) return false;
      }
      if (expensePaymentFilter && expensePaymentFilter !== (exp.paymentMethod || '')) return false;
      if (expenseCategoryFilter && expenseCategoryFilter !== (exp.category || '')) return false;
      return true;
    } catch (e) {
      return true;
    }
  });

  const filteredTransactions = transactions.filter((tx) => {
    try {
      const txDate = tx.date ? new Date(tx.date) : null;
      const from = applyDateFilter(filterFromDate);
      const to = applyDateFilter(filterToDate);
      if (from && txDate && txDate < from) return false;
      if (to && txDate && txDate > to) return false;
      return true;
    } catch (e) {
      return true;
    }
  });

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
        amount: Number(expenseForm.amount || 0)
      });
      setExpenseForm({ category: '', amount: '', accountId: '', paymentMethod: 'cash', note: '' });
      setMessage('Expense saved');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save expense');
    }
  };

  const getAccountName = (accountId) => {
    const account = accounts.find((acc) => String(acc._id || acc.id) === String(accountId));
    return account ? account.name : 'Unknown account';
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
        <h4>Payment method summary</h4>
        {summary.paymentMethods.map((entry) => (
          <div className="list-row" key={entry.method}>
            <div><strong>{entry.method}</strong></div>
            <div>₹{Number(entry.total || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Expenses list</h4>
        <div className="form-row">
          <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
          <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
          <input placeholder="Search category or note" value={expenseSearchText} onChange={(e) => setExpenseSearchText(e.target.value)} />
          <select value={expensePaymentFilter} onChange={(e) => setExpensePaymentFilter(e.target.value)}>
            <option value="">All payments</option>
            <option value="cash">Cash</option>
            <option value="phonepe">PhonePe</option>
            <option value="gpay">GPay</option>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="withdrawal">Withdrawal</option>
          </select>
          <input placeholder="Category filter" value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value)} />
          <button className="btn secondary" type="button" onClick={() => { setFilterFromDate(''); setFilterToDate(''); setExpenseSearchText(''); setExpensePaymentFilter(''); setExpenseCategoryFilter(''); }}>Clear</button>
        </div>

        {filteredExpenses.length === 0 ? (
          <p className="muted">No expenses match the selected filters.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense._id || expense.id}>
                    <td>{expense.date || '-'}</td>
                    <td>{expense.category || '-'}</td>
                    <td>{getAccountName(expense.accountId)}</td>
                    <td>{expense.paymentMethod || '-'}</td>
                    <td>₹{Number(expense.amount || 0).toLocaleString()}</td>
                    <td>{expense.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h4>Recent ledger entries</h4>
        {filteredTransactions.map((entry) => (
          <div className="list-row" key={entry._id || entry.id}>
            <div>
              <strong>{entry.reference || entry.note || 'Ledger entry'}</strong>
              <div className="muted">{entry.date || '-'} • {entry.paymentMethod || 'Unknown'}</div>
            </div>
            <div>{entry.type === 'income' ? '+' : '-'} ₹{Number(entry.amount || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState({ totalSales: 0, totalPurchases: 0, totalReturns: 0, invoiceCount: 0 });
  const [stock, setStock] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [stockSearch, setStockSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [reportFromDate, setReportFromDate] = useState('');
  const [reportToDate, setReportToDate] = useState('');

  useEffect(() => {
    api.get('/reports/summary', { params: { fromDate: reportFromDate, toDate: reportToDate } }).then((res) => setSummary(res.data));
  }, [reportFromDate, reportToDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.get('/reports/stock', { params: { search: stockSearch, fromDate: reportFromDate, toDate: reportToDate } })
        .then((res) => setStock(res.data))
        .catch(() => setStock([]));
    }, 250);

    return () => clearTimeout(timer);
  }, [stockSearch, reportFromDate, reportToDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.get('/reports/invoices', { params: { search: invoiceSearch, fromDate: reportFromDate, toDate: reportToDate } })
        .then((res) => setInvoices(res.data))
        .catch(() => setInvoices([]));
    }, 250);

    return () => clearTimeout(timer);
  }, [invoiceSearch, reportFromDate, reportToDate]);

  const downloadReport = async (path, filename, params = {}) => {
    try {
      const res = await api.get(path, { responseType: 'blob', params });
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
    const doc = new jsPDF();
    let y = 20;
    const dateRange = reportFromDate || reportToDate ? `Date range: ${reportFromDate || 'Any'} - ${reportToDate || 'Any'}` : 'Date range: All time';

    doc.setFontSize(16);
    doc.text('SGSE Billing Report', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(dateRange, 14, y);
    y += 12;

    doc.setFontSize(11);
    doc.text(`Sales: ₹${summary.totalSales.toLocaleString()}`, 14, y);
    y += 7;
    doc.text(`Purchases: ₹${summary.totalPurchases.toLocaleString()}`, 14, y);
    y += 7;
    doc.text(`Returns: ₹${summary.totalReturns.toLocaleString()}`, 14, y);
    y += 7;
    doc.text(`Invoice count: ${summary.invoiceCount}`, 14, y);
    y += 11;

    doc.setFontSize(13);
    doc.text('Stock report', 14, y);
    y += 8;
    doc.setFontSize(10);

    stock.forEach((item) => {
      const line = `${item.name} | ${item.itemType || '-'} | ${item.category || 'General'} | Stock: ${item.stock}`;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 6;
    });

    if (invoices.length) {
      doc.addPage();
      y = 20;
      doc.setFontSize(13);
      doc.text('Invoice report', 14, y);
      y += 8;
      doc.setFontSize(10);

      invoices.forEach((invoice) => {
        const line = `${invoice.invoiceNumber} | ${invoice.partyName || invoice.customerName || '-'} | ₹${(invoice.grandTotal || 0).toFixed(2)} | ${invoice.paymentStatus || '-'} | ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '-'}`;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 14, y);
        y += 6;
      });
    }

    doc.save('sgse-report.pdf');
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
        <div className="form-row">
          <input
            type="text"
            placeholder="Search item name in stock"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />
          <input type="date" value={reportFromDate} onChange={(e) => setReportFromDate(e.target.value)} />
          <input type="date" value={reportToDate} onChange={(e) => setReportToDate(e.target.value)} />
        </div>
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
              <tr key={item._id || item.id}>
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
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/stock/export', 'stock.csv', { search: stockSearch, fromDate: reportFromDate, toDate: reportToDate })}>Download stock CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadPdfReport()}>Download filtered PDF report</button>
        </div>
      </div>

      <div className="panel">
        <h4>Invoice report</h4>
        <div className="form-row">
          <input
            type="text"
            placeholder="Search party or customer name"
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
          />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Party / Customer</th>
              <th>Type</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice._id || invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.partyName || invoice.customerName}</td>
                <td>{invoice.type}</td>
                <td>₹{invoice.grandTotal || 0}</td>
                <td>{invoice.paymentStatus}</td>
                <td>{invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inline-actions">
          <button className="btn primary" type="button" onClick={() => downloadReport('/reports/invoices/export', 'invoices.csv', { search: invoiceSearch, fromDate: reportFromDate, toDate: reportToDate })}>Download invoices CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/sales/export', 'sales.csv', { search: invoiceSearch, fromDate: reportFromDate, toDate: reportToDate })}>Download sales CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/purchases/export', 'purchases.csv', { search: invoiceSearch, fromDate: reportFromDate, toDate: reportToDate })}>Download purchases CSV</button>
          <button className="btn secondary" type="button" onClick={() => downloadReport('/reports/returns/export', 'returns.csv', { search: invoiceSearch, fromDate: reportFromDate, toDate: reportToDate })}>Download returns CSV</button>
          <button className="btn secondary" type="button" onClick={downloadPdfReport}>Download filtered PDF report</button>
          <button className="btn secondary" type="button" onClick={() => window.print()}>Print report</button>
        </div>
      </div>
    </div>
  );
}

function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  // Use module-level time helpers: `getNowLocalDateTime`, `getTimeAgo`, `isRecentContact`
  
  const getStatusColor = (status) => {
    const colors = {
      'Hot Lead': '#d32f2f',
      'Warm Lead': '#ff6f00',
      'Cool Lead': '#1976d2',
      'May Convert': '#388e3c',
      'Not Interested': '#757575',
      'Following Up': '#0288d1'
    };
    return colors[status] || '#186FAF';
  };
  
  const [form, setForm] = useState({
    callerName: '',
    name: '',
    contactNumber: '',
    consumerNumber: '',
    status: 'Warm Lead',
    review: '',
    followUpStrategy: '',
    followUpCount: '0',
    nextFollowUp: '',
    lastContacted: ''
  });
  const [editingContactId, setEditingContactId] = useState(null);
  const [message, setMessage] = useState('');
  const [contactFromDate, setContactFromDate] = useState('');
  const [contactToDate, setContactToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lastContactedFrom, setLastContactedFrom] = useState('');
  const [lastContactedTo, setLastContactedTo] = useState('');
  const [callOutcome, setCallOutcome] = useState('Contacted');
  const [callNote, setCallNote] = useState('');
  const [callTimestamp, setCallTimestamp] = useState(getNowLocalDateTime());

  const loadContacts = async () => {
    try {
      const response = await api.get('/contacts', {
        params: {
          fromDate: contactFromDate || undefined,
          toDate: contactToDate || undefined
        }
      });
      setContacts(response.data.contacts || response.data || []);
    } catch (error) {
      console.error('Could not load contacts', error);
      setContacts([]);
      setMessage(error.response?.data?.message || 'Unable to load contacts');
    }
  };

  useEffect(() => { loadContacts(); }, [contactFromDate, contactToDate]);

  const resetForm = () => {
    setForm({
      callerName: '',
      name: '',
      contactNumber: '',
      consumerNumber: '',
      status: 'Warm Lead',
      review: '',
      followUpStrategy: '',
      followUpCount: '0',
      nextFollowUp: '',
      lastContacted: ''
    });
    setEditingContactId(null);
    setMessage('');
  };

  const saveContact = async (e) => {
    e.preventDefault();
    if (!form.name || !form.contactNumber) {
      setMessage('Name and contact number are required');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      // When adding a new contact, assume it has been contacted and record review
      const payload = {
        ...form,
        followUpCount: editingContactId ? Number(form.followUpCount || 0) : Math.max(1, Number(form.followUpCount || 0)),
        nextFollowUp: form.nextFollowUp || null,
        lastContacted: editingContactId ? (form.lastContacted || null) : nowIso
      };

      let created;
      if (editingContactId) {
        await api.put(`/contacts/${editingContactId}`, payload);
        setMessage('Contact updated');
      } else {
        const res = await api.post('/contacts', payload);
        created = res.data;
        setMessage('Contact added and marked as contacted');
      }
      // If we created a new contact, also log an initial call entry using the review as note
      if (created && created.id) {
        try {
          await api.post(`/contacts/${created.id}/calls`, {
            timestamp: nowIso,
            note: form.review || '',
            outcome: form.status || 'Contacted',
            statusOnCall: form.status || 'Warm Lead'
          });
        } catch (e) {
          // non-fatal
        }
      }

      resetForm();
      await loadContacts();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save contact');
    }
  };

  const editContact = (contact) => {
    setEditingContactId(contact.id || contact._id);
    setForm({
      callerName: contact.callerName || '',
      name: contact.name || '',
      contactNumber: contact.contactNumber || '',
      consumerNumber: contact.consumerNumber || '',
      status: contact.status || 'Warm Lead',
      review: contact.review || '',
      followUpStrategy: contact.followUpStrategy || '',
      followUpCount: String(contact.followUpCount || 0),
      nextFollowUp: contact.nextFollowUp ? contact.nextFollowUp.slice(0, 10) : '',
      lastContacted: contact.lastContacted ? contact.lastContacted.slice(0, 16) : ''
    });
    setMessage('Editing contact');
  };

  const logContactCall = async (contact) => {
    try {
      const payload = {
        timestamp: callTimestamp || new Date().toISOString(),
        note: callNote,
        outcome: callOutcome || 'Contacted',
        statusOnCall: callOutcome === 'Not Interested' ? 'Not Interested' : contact.status || 'Warm Lead'
      };
      await api.post(`/contacts/${contact.id || contact._id}/calls`, payload);
      setMessage('Call logged successfully');
      setCallNote('');
      setCallTimestamp('');
      await loadContacts();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to log call');
    }
  };

  const applyLastContactFilter = (contact) => {
    try {
      const lc = contact.lastContacted ? new Date(contact.lastContacted) : null;
      const from = lastContactedFrom ? new Date(lastContactedFrom) : null;
      const to = lastContactedTo ? new Date(lastContactedTo) : null;
      if (from && lc && lc < from) return false;
      if (to && lc && lc > to) return false;
      if (statusFilter && contact.status !== statusFilter) return false;
      return true;
    } catch (e) {
      return true;
    }
  };

  const getDateSlotLabel = (contact) => {
    if (!contact.lastContacted) return 'No call date';
    return new Date(contact.lastContacted).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const filteredContacts = contacts.filter((c) => applyLastContactFilter(c));
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const key = contact.lastContacted ? new Date(contact.lastContacted).toISOString().slice(0, 10) : 'no-date';
    if (!acc[key]) {
      acc[key] = {
        label: getDateSlotLabel(contact),
        items: []
      };
    }
    acc[key].items.push(contact);
    return acc;
  }, {});
  const groupedDateKeys = Object.keys(groupedContacts).sort();

  const deleteContact = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await api.delete(`/contacts/${id}`);
      setMessage('Contact deleted');
      await loadContacts();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to delete contact');
    }
  };

  const downloadContactsCsv = async () => {
    try {
      const res = await api.get('/contacts/export', {
        responseType: 'blob',
        params: { fromDate: contactFromDate, toDate: contactToDate }
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'contacts.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to download contacts');
    }
  };

  return (
    <div>
      <h3>Calling & Customer follow-up</h3>
      {message && <p className="muted">{message}</p>}
      <div className="panel">
        <h4>{editingContactId ? 'Edit contact' : 'Add contact'}</h4>
        <form className="form-grid" onSubmit={saveContact}>
          <input placeholder="Caller name" value={form.callerName} onChange={(e) => setForm({ ...form, callerName: e.target.value })} />
          <input placeholder="Customer name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Contact number" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />
          <input placeholder="Consumer number" value={form.consumerNumber} onChange={(e) => setForm({ ...form, consumerNumber: e.target.value })} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="Hot Lead">Hot Lead</option>
            <option value="Warm Lead">Warm Lead</option>
            <option value="Cool Lead">Cool Lead</option>
            <option value="May Convert">May Convert</option>
            <option value="Not Interested">Not Interested</option>
            <option value="Following Up">Following Up</option>
          </select>
          <input placeholder="Next follow-up date" type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
          <input placeholder="Last contacted" type="datetime-local" value={form.lastContacted} onChange={(e) => setForm({ ...form, lastContacted: e.target.value })} />
          <input placeholder="Follow-up count" type="number" min="0" value={form.followUpCount} onChange={(e) => setForm({ ...form, followUpCount: e.target.value })} />
          <input placeholder="Review by caller" value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} />
          <input placeholder="Follow-up strategy" value={form.followUpStrategy} onChange={(e) => setForm({ ...form, followUpStrategy: e.target.value })} />
          <div className="inline-actions">
            <button className="btn primary" type="submit">{editingContactId ? 'Save contact' : 'Add contact'}</button>
            <button className="btn secondary" type="button" onClick={resetForm}>Reset</button>
          </div>
        </form>
      </div>

      <div className="panel contacts-panel">
        <div className="panel-header">
          <div>
            <h4>Contact list</h4>
            <p className="muted">Filter by date, status or recent call time to find the right customer quickly.</p>
          </div>
        </div>
        <div className="form-row filter-bar">
          <input type="date" value={contactFromDate} onChange={(e) => setContactFromDate(e.target.value)} />
          <input type="date" value={contactToDate} onChange={(e) => setContactToDate(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Hot Lead">Hot Lead</option>
            <option value="Warm Lead">Warm Lead</option>
            <option value="Cool Lead">Cool Lead</option>
            <option value="May Convert">May Convert</option>
            <option value="Not Interested">Not Interested</option>
            <option value="Following Up">Following Up</option>
          </select>
          <input type="datetime-local" value={lastContactedFrom} onChange={(e) => setLastContactedFrom(e.target.value)} />
          <input type="datetime-local" value={lastContactedTo} onChange={(e) => setLastContactedTo(e.target.value)} />
          <button className="btn secondary" type="button" onClick={downloadContactsCsv}>Download CSV</button>
          <button className="btn secondary" type="button" onClick={() => { setContactFromDate(''); setContactToDate(''); setStatusFilter(''); setLastContactedFrom(''); setLastContactedTo(''); }}>Clear</button>
        </div>

        {contacts.length === 0 ? (
          <div className="empty-state">
            <h4>No contacts yet</h4>
            <p className="muted">There are no saved lead records yet. Add a contact above to start tracking calls and follow-ups.</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="empty-state">
            <h4>No contacts match filters</h4>
            <p className="muted">Try clearing the filter values or adjusting the date range.</p>
          </div>
        ) : (
          groupedDateKeys.map((slotKey) => (
            <div key={slotKey} className="date-slot">
              <div className="date-slot-header">{groupedContacts[slotKey].label}</div>
              <div className="date-slot-list">
                {groupedContacts[slotKey].items.map((contact) => (
                  <div key={contact.id || contact._id} className="panel contact-card" style={{ borderLeft: `4px solid ${getStatusColor(contact.status)}` }}>
                    <div className="list-row">
                      <div className="contact-header">
                        <strong style={{ fontSize: '16px' }}>{contact.name}</strong>
                        <div className="muted" style={{ marginTop: '4px', fontSize: '13px' }}>👤 {contact.callerName || 'Unknown'} • 📱 {contact.contactNumber} • 🆔 {contact.consumerNumber || 'No consumer number'}</div>
                        <div style={{ marginTop: '8px' }}>
                          <span className={`badge status-badge status-${String(contact.status || 'Warm Lead').replace(/\s+/g, '-').toLowerCase()}`} style={{ backgroundColor: getStatusColor(contact.status), color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{contact.status}</span>
                          {isRecentContact(contact.lastContacted) && <span className="badge-recent" style={{ marginLeft: '8px', backgroundColor: '#4CAF50', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', animation: 'pulse 1.5s infinite' }}>🟢 RECENT</span>}
                        </div>
                      </div>
                      <div className="inline-actions">
                        <button className="btn secondary" type="button" onClick={() => editContact(contact)}>✏️ Edit</button>
                        <button className="btn secondary" type="button" onClick={() => deleteContact(contact.id || contact._id)}>🗑️ Delete</button>
                      </div>
                    </div>
                    <div className="contact-meta" style={{ marginTop: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <p className="muted" style={{ marginBottom: '4px' }}><strong>⭐ Review:</strong></p>
                          <p style={{ marginLeft: '20px', fontSize: '13px' }}>{contact.review || 'No review yet'}</p>
                        </div>
                        <div>
                          <p className="muted" style={{ marginBottom: '4px' }}><strong>📋 Plan:</strong></p>
                          <p style={{ marginLeft: '20px', fontSize: '13px' }}>{contact.followUpStrategy || 'No strategy defined'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="contact-meta" style={{ marginTop: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <p className="muted" style={{ marginBottom: '4px' }}><strong>📞 Calls:</strong></p>
                          <p style={{ marginLeft: '20px', fontSize: '13px' }}>{contact.followUpCount || 0}</p>
                        </div>
                        <div>
                          <p className="muted" style={{ marginBottom: '4px' }}><strong>📅 Last Contacted:</strong></p>
                          <p style={{ marginLeft: '20px', fontSize: '13px' }}>{contact.lastContacted ? formatAbsoluteDate(contact.lastContacted) : 'Never'}</p>
                          <p style={{ marginLeft: '20px', fontSize: '12px', color: '#666' }}>({getTimeAgo(contact.lastContacted)})</p>
                        </div>
                        <div>
                          <p className="muted" style={{ marginBottom: '4px' }}><strong>⏭️ Next Follow-up:</strong></p>
                          <p style={{ marginLeft: '20px', fontSize: '13px' }}>{contact.nextFollowUp ? new Date(contact.nextFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not scheduled'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="form-row call-log-row">
                      <select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                        <option value="Contacted">Contacted</option>
                        <option value="Hot Lead">Hot Lead</option>
                        <option value="Warm Lead">Warm Lead</option>
                        <option value="May Convert">May Convert</option>
                        <option value="Not Interested">Not Interested</option>
                      </select>
                      <input type="datetime-local" value={callTimestamp} onChange={(e) => setCallTimestamp(e.target.value)} />
                      <input placeholder="Call note" value={callNote} onChange={(e) => setCallNote(e.target.value)} />
                      <button className="btn primary" type="button" onClick={() => logContactCall(contact)}>Log call</button>
                    </div>
                    {contact.callHistory && contact.callHistory.length > 0 && (
                      <div className="call-history">
                        <strong>Recent call history</strong>
                        {contact.callHistory.slice(-3).reverse().map((entry, index) => (
                          <div key={`${contact.id || contact._id}-call-${index}`} className="call-history-entry">
                            <div><strong>{new Date(entry.timestamp).toLocaleString()}</strong> — {entry.status || entry.outcome}</div>
                            <div className="muted">{entry.note || 'No note recorded'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
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

function CallingPage() {
  const [contacts, setContacts] = useState([]);
  const [calls, setCalls] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [sortBy, setSortBy] = useState('latest');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCallId, setEditingCallId] = useState(null);
  const [editingNote, setEditingNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCalls();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const loadCalls = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts');
      setContacts(res.data);
      
      // Aggregate all calls from all contacts
      const allCalls = [];
      res.data.forEach((contact) => {
        if (contact.callHistory && Array.isArray(contact.callHistory)) {
          contact.callHistory.forEach((call) => {
            allCalls.push({
              ...call,
              id: `${contact._id}-${call.timestamp}`,
              contactId: contact._id,
              contactName: contact.name,
              contactNumber: contact.contactNumber,
              consumerNumber: contact.consumerNumber,
              review: contact.review,
              status: call.status || contact.status,
              callerName: contact.callerName
            });
          });
        }
      });
      
      setCalls(allCalls);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Unable to load calls', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sortCalls = (callsToSort) => {
    const sorted = [...callsToSort];
    if (sortBy === 'latest') {
      sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.contactName || '').localeCompare(b.contactName || ''));
    }
    return sorted;
  };

  const filteredCalls = sortCalls(calls.filter((call) => {
    const matchesStatus = !filterStatus || call.status === filterStatus;
    const matchesSearch = !searchTerm || 
      call.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.contactNumber.includes(searchTerm) ||
      (call.note && call.note.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  }));

  const updateCallNote = async (contactId, callTimestamp, newNote) => {
    try {
      const contact = contacts.find(c => c._id === contactId);
      if (!contact) throw new Error('Contact not found');
      
      const updatedContact = {
        ...contact,
        callHistory: contact.callHistory.map(call => 
          new Date(call.timestamp).toISOString() === new Date(callTimestamp).toISOString()
            ? { ...call, note: newNote }
            : call
        )
      };
      
      await api.put(`/contacts/${contactId}`, updatedContact);
      showMessage('Call note updated successfully', 'success');
      setEditingCallId(null);
      await loadCalls();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Unable to update call note', 'error');
    }
  };

  const deleteCall = async (contactId, callTimestamp) => {
    if (!window.confirm('Delete this call record?')) return;
    
    try {
      const contact = contacts.find(c => c._id === contactId);
      if (!contact) throw new Error('Contact not found');
      
      const updatedContact = {
        ...contact,
        callHistory: contact.callHistory.filter(call => 
          new Date(call.timestamp).toISOString() !== new Date(callTimestamp).toISOString()
        ),
        followUpCount: Math.max(0, (contact.followUpCount || 1) - 1)
      };
      
      await api.put(`/contacts/${contactId}`, updatedContact);
      showMessage('Call record deleted successfully', 'success');
      await loadCalls();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Unable to delete call record', 'error');
    }
  };

  const getStatusColor = (status) => {
    const statusMap = {
      'Hot Lead': '#B43D34',
      'Warm Lead': '#9C5E11',
      'Cool Lead': '#2F4BA0',
      'May Convert': '#136648',
      'Not Interested': '#4D5973',
      'Following Up': '#1F5C8E',
      'Contacted': '#1F5C8E'
    };
    return statusMap[status] || '#5E6F83';
  };

  // Use shared time helper
  // `getTimeAgo` is defined at module level

  const isRecentCall = (date) => isRecentContact(date, 7200); // last 2 hours

  const getCallStats = () => {
    const stats = {
      total: calls.length,
      today: calls.filter(c => {
        const callDate = new Date(c.timestamp);
        const today = new Date();
        return callDate.toDateString() === today.toDateString();
      }).length,
      hotLeads: calls.filter(c => c.status === 'Hot Lead').length,
      followed: calls.filter(c => c.outcome === 'Contacted').length
    };
    return stats;
  };

  const stats = getCallStats();

  return (
    <div className="page-transition">
      <div className="page-header">
        <div>
          <p className="eyebrow">Call Management</p>
          <h3>Call History & Follow-ups</h3>
          <p className="muted">Review all customer calls, manage notes, and track customer engagement.</p>
        </div>
      </div>

      {/* Call Statistics Dashboard */}
      <div className="calling-stats">
        <div className="calling-stat-card">
          <div className="calling-stat-number">{stats.total}</div>
          <div className="calling-stat-label">Total Calls</div>
        </div>
        <div className="calling-stat-card">
          <div className="calling-stat-number">{stats.today}</div>
          <div className="calling-stat-label">Today</div>
        </div>
        <div className="calling-stat-card">
          <div className="calling-stat-number">{stats.hotLeads}</div>
          <div className="calling-stat-label">Hot Leads</div>
        </div>
        <div className="calling-stat-card">
          <div className="calling-stat-number">{stats.followed}</div>
          <div className="calling-stat-label">Followed Up</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="panel">
        <div className="form-grid">
          <input 
            placeholder="🔍 Search by name, phone, or note..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Hot Lead">🔥 Hot Lead</option>
            <option value="Warm Lead">☀️ Warm Lead</option>
            <option value="Cool Lead">❄️ Cool Lead</option>
            <option value="May Convert">✅ May Convert</option>
            <option value="Not Interested">❌ Not Interested</option>
            <option value="Following Up">📞 Following Up</option>
            <option value="Contacted">✓ Contacted</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="latest">Latest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">By name</option>
            <option value="status">By status</option>
          </select>
        </div>
      </div>

      {/* Toast Notification */}
      {message && (
        <div className={`toast ${messageType}`}>
          <span>{message}</span>
        </div>
      )}

      {/* Call List */}
      <div className="panel">
        {filteredCalls.length === 0 ? (
          <div className="empty-state">
            <p className="muted">📞 No calls found. {calls.length === 0 ? 'Start by adding contacts and logging calls.' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <div>
            <p className="muted" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Showing {filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''}</span>
              <span>💬 {loading ? <span className="spinner"></span> : 'Ready'}</span>
            </p>
            {filteredCalls.map((call) => (
              <div key={call.id} className="calling-list-item">
                <div className="calling-item-header">
                  <div style={{ flex: 1 }}>
                    <div className="calling-item-name">{call.contactName}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span className="calling-item-time">📅 {formatAbsoluteDate(call.timestamp)}</span>
                      <span className="calling-item-time-relative">({getTimeAgo(call.timestamp)})</span>
                      {isRecentCall(call.timestamp) && <span className="badge-recent">Recent</span>}
                    </div>
                  </div>
                  <div className="calling-item-status">
                    <span className="status-badge" style={{ background: `rgba(${getStatusColor(call.status)}, 0.1)`, color: getStatusColor(call.status) }}>
                      {call.status || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="calling-item-details">
                  <div className="calling-item-detail">
                    <span className="calling-item-detail-label">📱 Mobile:</span> {call.contactNumber}
                  </div>
                  <div className="calling-item-detail">
                    <span className="calling-item-detail-label">🆔 Consumer #:</span> {call.consumerNumber || 'N/A'}
                  </div>
                  <div className="calling-item-detail">
                    <span className="calling-item-detail-label">📞 Outcome:</span> {call.outcome || 'Contacted'}
                  </div>
                  {call.callerName && (
                    <div className="calling-item-detail">
                      <span className="calling-item-detail-label">👤 Caller:</span> {call.callerName}
                    </div>
                  )}
                </div>

                {call.review && (
                  <div className="calling-item-review">
                    <strong>⭐ Customer Review:</strong> {call.review}
                  </div>
                )}

                {editingCallId === call.id ? (
                  <div className="form-row" style={{ marginTop: '10px' }}>
                    <textarea
                      placeholder="📝 Add or edit call note..."
                      value={editingNote}
                      onChange={(e) => setEditingNote(e.target.value)}
                      style={{ flex: '1 1 100%', minHeight: '80px' }}
                    />
                    <div className="inline-actions" style={{ flex: '1 1 100%' }}>
                      <button className="btn primary" onClick={() => updateCallNote(call.contactId, call.timestamp, editingNote)}>Save Note</button>
                      <button className="btn secondary" onClick={() => setEditingCallId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {call.note && (
                      <div className="calling-item-review" style={{ marginTop: '10px', borderLeftColor: '#3F9AE8' }}>
                        <strong>📝 Note:</strong> {call.note}
                      </div>
                    )}
                  </>
                )}

                <div className="calling-item-actions">
                  <button className="btn secondary" onClick={() => {
                    setEditingCallId(call.id);
                    setEditingNote(call.note || '');
                  }}>
                    {editingCallId === call.id ? '✕ Cancel' : '✏️ Edit Note'}
                  </button>
                  <button className="btn secondary" onClick={() => deleteCall(call.contactId, call.timestamp)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
