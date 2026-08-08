import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from './config';

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
          <Link to="/accounting">Accounting</Link>
          <Link to="/reports">Reports</Link>
          {user.role === 'admin' && <Link to="/users">Users</Link>}
        </aside>
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/billing" element={<BillingPage />} />
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

function BillingPage() {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGSTIN, setPartyGSTIN] = useState('');
  const [type, setType] = useState('sale');
  const [billingMessage, setBillingMessage] = useState('');

  useEffect(() => { api.get('/items').then((res) => setItems(res.data)); }, []);

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
        items: selectedItems.map((entry) => ({ ...entry, total: entry.quantity * entry.price }))
      };
      await api.post('/invoices', payload);
      setBillingMessage('Invoice created successfully');
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
    <div>
      <h3>Single-price billing</h3>
      <div className="billing-grid">
        <div className="panel">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="return">Return</option>
          </select>
          <input placeholder="Party name" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          <input placeholder="Party phone" value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} />
          <input placeholder="Party GSTIN (optional)" value={partyGSTIN} onChange={(e) => setPartyGSTIN(e.target.value)} />
          <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          <div className="item-list">
            {items.map((item) => (
              <button key={item._id} className="item-chip" onClick={() => addItem(item)}>{item.name} — ₹{type === 'purchase' ? item.purchasePrice : item.salePrice}</button>
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
          {billingMessage && <p className="muted">{billingMessage}</p>}
          <button className="btn primary" onClick={saveInvoice}>Create bill</button>
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
        amount: Number(expenseForm.amount || 0)
      });
      setExpenseForm({ category: '', amount: '', accountId: '', paymentMethod: 'cash', note: '' });
      setMessage('Expense saved');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save expense');
    }
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
