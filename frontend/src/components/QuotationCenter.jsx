import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({ baseURL: API_BASE_URL });
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const initialForm = {
  clientName: '', clientContact: '', clientEmail: '', clientAddress: '', siteName: 'Bargarh, Odisha', latitude: '21.333', longitude: '83.617',
  segment: 'Residential', systemType: 'On-grid', capacity: '5', panelWattage: '550', panelCount: '10', roofLength: '8', roofWidth: '5', tilt: '20',
  tariff: '5', projectCost: '325000', gstRate: '0', centralSubsidy: '78000', stateSubsidy: '60000', financePercent: '80', interestRate: '6', tenureYears: '10',
  panelBrand: 'Waaree', inverterBrand: 'Growatt', batteryType: 'None', batteryBrand: 'Eastman', batteryKwh: '5', notes: ''
};

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(number(value));
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '-';
const getToken = () => localStorage.getItem('token');

function calculate(form) {
  const capacity = number(form.capacity, 5);
  const annualGeneration = capacity * 5.2 * 365 * (1 - 0.14) * (1 - number(form.shading, 5) / 100);
  const annualValue = annualGeneration * number(form.tariff, 5);
  const cost = number(form.projectCost);
  const subsidy = number(form.centralSubsidy) + number(form.stateSubsidy);
  const financed = cost * number(form.financePercent, 80) / 100;
  const monthlyRate = number(form.interestRate, 6) / 100 / 12;
  const monthsCount = Math.max(1, number(form.tenureYears, 10) * 12);
  const emi = monthlyRate ? financed * monthlyRate * ((1 + monthlyRate) ** monthsCount) / (((1 + monthlyRate) ** monthsCount) - 1) : financed / monthsCount;
  return { capacity, annualGeneration, annualValue, cost, subsidy, financed, emi, payback: Math.max(0, cost - subsidy) / Math.max(annualValue, 1), monthsCount };
}

function ThreeDPreview({ form }) {
  const count = Math.max(1, Math.min(36, Math.round(number(form.panelCount, 10))));
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return <div className="quotation-3d-wrap"><div className="quotation-3d-scene" style={{ '--roof-tilt': `${number(form.tilt, 20) - 12}deg` }}><div className="quotation-roof">{Array.from({ length: count }, (_, index) => <span key={index} style={{ width: `${100 / columns}%`, height: `${100 / rows}%` }} />)}</div><div className="quotation-house" /><div className="quotation-inverter">INVERTER</div></div><div className="quotation-3d-caption">Interactive roof concept · {form.roofLength || 8}m × {form.roofWidth || 5}m · {count} modules</div></div>;
}

export default function QuotationCenter({ user }) {
  const [form, setForm] = useState(() => ({ ...initialForm, clientName: '' }));
  const [quotes, setQuotes] = useState([]);
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [view, setView] = useState('builder');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const result = useMemo(() => calculate(form), [form]);

  const loadQuotes = async () => {
    try { const response = await api.get('/quotations', { headers: { Authorization: `Bearer ${getToken()}` } }); setQuotes(response.data || []); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to load quotations'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadQuotes(); }, []);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const saveQuote = async (event) => {
    event?.preventDefault();
    if (!form.clientName.trim()) { setMessage('Add a client name before saving the quotation'); return; }
    try {
      const payload = { ...form, calculations: result, companyName: user.shopName || 'SGSE Billing' };
      const response = activeQuoteId
        ? await api.put(`/quotations/${activeQuoteId}`, payload, { headers: { Authorization: `Bearer ${getToken()}` } })
        : await api.post('/quotations', payload, { headers: { Authorization: `Bearer ${getToken()}` } });
      setQuotes((current) => activeQuoteId ? current.map((quote) => quote.id === activeQuoteId ? response.data : quote) : [response.data, ...current]);
      setActiveQuoteId(response.data.id); setMessage('Quotation saved to the workspace'); setView('history');
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to save quotation'); }
  };
  const openQuote = (quote) => { setForm({ ...initialForm, ...(quote.data || quote) }); setActiveQuoteId(quote.id); setView('builder'); setMessage(`Editing ${quote.quoteNumber}`); };
  const deleteQuote = async (quote) => {
    if (!window.confirm(`Delete ${quote.quoteNumber}?`)) return;
    try { await api.delete(`/quotations/${quote.id}`, { headers: { Authorization: `Bearer ${getToken()}` } }); setQuotes((current) => current.filter((item) => item.id !== quote.id)); setMessage('Quotation deleted'); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to delete quotation'); }
  };
  const newQuote = () => { setForm({ ...initialForm }); setActiveQuoteId(null); setView('builder'); setMessage('New quotation ready'); };

  return <div className="quotation-page">
    <div className="page-header quotation-header"><div><p className="eyebrow">Solar EPC workspace</p><h3>3D quotation center</h3><p className="muted">Design, calculate, and manage client-ready solar proposals with your shop data.</p></div><div className="inline-actions"><button className="btn outline" type="button" onClick={() => setView('history')}>Quotation history ({quotes.length})</button><button className="btn primary" type="button" onClick={newQuote}>New quotation</button></div></div>
    {message && <p className="status-message">{message}</p>}
    <div className="quotation-tabs"><button className={view === 'builder' ? 'active' : ''} onClick={() => setView('builder')}>Proposal builder</button><button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>Saved quotations</button></div>
    {view === 'history' ? <section className="panel quotation-history"><div className="panel-header"><div><h4>Saved quotations</h4><p className="muted">Stored securely for this shop account.</p></div><button className="btn primary" onClick={newQuote}>Create quotation</button></div>{loading ? <p className="muted">Loading quotations...</p> : quotes.length ? <div className="quotation-history-list">{quotes.map((quote) => <div className="quotation-history-row" key={quote.id}><div><strong>{quote.quoteNumber}</strong><span>{quote.clientName} · {quote.data?.capacity || quote.capacity || 0} kW · {quote.data?.systemType || quote.systemType || 'On-grid'}</span></div><div><strong>{money(quote.calculations?.cost || quote.data?.projectCost || quote.projectCost)}</strong><span>{formatDate(quote.updatedAt || quote.createdAt)}</span></div><div className="inline-actions"><button className="btn outline" onClick={() => openQuote(quote)}>Open</button><button className="btn danger" onClick={() => deleteQuote(quote)}>Delete</button></div></div>)}</div> : <p className="empty-state">No quotations saved yet.</p>}</section> : <form className="quotation-layout" onSubmit={saveQuote}>
      <div className="quotation-main"><section className="panel"><div className="panel-header"><div><h4>Client and site</h4><p className="muted">The proposal will use these details.</p></div><span className="quotation-number">{activeQuoteId ? 'Editing saved quote' : 'Draft quotation'}</span></div><div className="form-grid"><label>Client / firm name<input required value={form.clientName} onChange={(event) => update('clientName', event.target.value)} /></label><label>Contact number<input value={form.clientContact} onChange={(event) => update('clientContact', event.target.value)} /></label><label>Email<input type="email" value={form.clientEmail} onChange={(event) => update('clientEmail', event.target.value)} /></label><label>Site / location<input value={form.siteName} onChange={(event) => update('siteName', event.target.value)} /></label><label className="span-full">Site address<textarea rows="2" value={form.clientAddress} onChange={(event) => update('clientAddress', event.target.value)} /></label><label>Latitude<input type="number" step="0.000001" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} /></label><label>Longitude<input type="number" step="0.000001" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} /></label></div></section>
        <section className="panel"><div className="panel-header"><div><h4>3D EPC design</h4><p className="muted">Adjust the roof concept and equipment selection.</p></div></div><div className="form-grid"><label>Segment<select value={form.segment} onChange={(event) => update('segment', event.target.value)}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>MW Project</option></select></label><label>System type<select value={form.systemType} onChange={(event) => update('systemType', event.target.value)}><option>On-grid</option><option>Hybrid Without Battery</option><option>Hybrid With Battery</option><option>Off-grid</option></select></label><label>Capacity (kW)<input type="number" min="0.5" step="0.5" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} /></label><label>Panel count<input type="number" min="1" max="36" value={form.panelCount} onChange={(event) => update('panelCount', event.target.value)} /></label><label>Panel wattage (W)<input type="number" min="100" value={form.panelWattage} onChange={(event) => update('panelWattage', event.target.value)} /></label><label>Roof length (m)<input type="number" min="1" step="0.1" value={form.roofLength} onChange={(event) => update('roofLength', event.target.value)} /></label><label>Roof width (m)<input type="number" min="1" step="0.1" value={form.roofWidth} onChange={(event) => update('roofWidth', event.target.value)} /></label><label>Tilt (degrees)<input type="number" min="0" max="45" value={form.tilt} onChange={(event) => update('tilt', event.target.value)} /></label><label>Panel brand<select value={form.panelBrand} onChange={(event) => update('panelBrand', event.target.value)}><option>Waaree</option><option>Adani</option><option>Vikram</option><option>Havells</option></select></label><label>Inverter brand<select value={form.inverterBrand} onChange={(event) => update('inverterBrand', event.target.value)}><option>Growatt</option><option>Sungrow</option><option>Waaree</option><option>Havells</option></select></label></div><ThreeDPreview form={form} /></section>
        <section className="panel"><div className="panel-header"><div><h4>Commercials and finance</h4><p className="muted">Use editable assumptions before issuing a proposal.</p></div></div><div className="form-grid"><label>Tariff (INR / kWh)<input type="number" min="0" step="0.01" value={form.tariff} onChange={(event) => update('tariff', event.target.value)} /></label><label>Project cost (INR)<input type="number" min="0" value={form.projectCost} onChange={(event) => update('projectCost', event.target.value)} /></label><label>GST rate (%)<input type="number" min="0" step="0.1" value={form.gstRate} onChange={(event) => update('gstRate', event.target.value)} /></label><label>Central subsidy (INR)<input type="number" min="0" value={form.centralSubsidy} onChange={(event) => update('centralSubsidy', event.target.value)} /></label><label>State subsidy scenario (INR)<input type="number" min="0" value={form.stateSubsidy} onChange={(event) => update('stateSubsidy', event.target.value)} /></label><label>Finance percentage<input type="number" min="0" max="100" value={form.financePercent} onChange={(event) => update('financePercent', event.target.value)} /></label><label>Interest rate (%)<input type="number" min="0" step="0.1" value={form.interestRate} onChange={(event) => update('interestRate', event.target.value)} /></label><label>Tenure (years)<input type="number" min="1" value={form.tenureYears} onChange={(event) => update('tenureYears', event.target.value)} /></label><label className="span-full">Proposal notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Warranty, approvals, installation assumptions..." /></label></div></section></div>
      <aside className="quotation-sidebar"><section className="panel quotation-summary"><div className="panel-header"><div><h4>Live estimate</h4><p className="muted">Scenario values update as you edit.</p></div></div><div className="quotation-kpis"><div><span>System size</span><strong>{result.capacity.toFixed(2)} kW</strong></div><div><span>Annual generation</span><strong>{Math.round(result.annualGeneration).toLocaleString('en-IN')} kWh</strong></div><div><span>Annual saving</span><strong>{money(result.annualValue)}</strong></div><div><span>Payback</span><strong>{result.payback.toFixed(1)} yrs</strong></div></div><div className="quotation-bars">{months.map((month, index) => <span key={month} title={`${month}: ${Math.round(result.annualGeneration / 12 * (0.75 + (index % 4) / 8)).toLocaleString('en-IN')} kWh`} style={{ height: `${35 + ((index * 17) % 55)}%` }} />)}</div><div className="quotation-finance"><span>Finance amount</span><strong>{money(result.financed)}</strong><span>Illustrative EMI</span><strong>{money(result.emi)} / month</strong><span>Subsidy scenario</span><strong>{money(result.subsidy)}</strong></div><button className="btn primary quotation-save" type="submit">{activeQuoteId ? 'Update quotation' : 'Save quotation'}</button><button className="btn secondary quotation-print" type="button" onClick={() => window.print()}>Print / save PDF</button></section><section className="panel quotation-preview"><div className="panel-header"><div><h4>Client preview</h4><p className="muted">A compact review before saving.</p></div></div><div className="quotation-paper"><strong>{user.shopName || 'SGSE Billing'}</strong><h5>Solar EPC Proposal</h5><p>{form.clientName || 'Client name'} · {form.siteName || 'Site location'}</p><hr /><div><span>System</span><b>{result.capacity.toFixed(2)} kW {form.systemType}</b></div><div><span>Equipment</span><b>{form.panelBrand} / {form.inverterBrand}</b></div><div><span>Project cost</span><b>{money(result.cost)}</b></div><div><span>Annual generation</span><b>{Math.round(result.annualGeneration).toLocaleString('en-IN')} kWh</b></div><div><span>Validity</span><b>15 days</b></div></div></section></aside>
    </form>}
  </div>;
}
