import { jsPDF } from 'jspdf';

const safe = (value, fallback = '') => String(value ?? fallback);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function downloadQuotationPdf({ form = {}, result = {}, user = {}, quoteNumber = '' }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;
  const line = (label, value, x, width = 82) => {
    doc.setFont(undefined, 'bold');
    doc.text(`${label}:`, x, y);
    doc.setFont(undefined, 'normal');
    doc.text(doc.splitTextToSize(safe(value, '-'), width), x + 28, y);
  };
  const section = (title) => {
    y += 7;
    doc.setFillColor(23, 86, 112);
    doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text(title.toUpperCase(), margin + 3, y + 4.8);
    doc.setTextColor(27, 42, 55);
    y += 13;
  };

  doc.setFillColor(23, 49, 62);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setFillColor(224, 163, 58);
  doc.rect(0, 34, pageWidth, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(safe(user.shopName, 'SGSE Billing'), margin, 14);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text(doc.splitTextToSize(safe(user.shopAddress || user.address, 'Solar energy solutions'), 105), margin, 21);
  doc.text(`Phone: ${safe(user.phone, '-')}   GSTIN: ${safe(user.shopGSTIN, '-')}`, margin, 31);
  doc.text(`Quotation: ${safe(quoteNumber, 'Draft')}`, pageWidth - margin, 20, { align: 'right' });
  doc.text(new Date().toLocaleDateString('en-IN'), pageWidth - margin, 29, { align: 'right' });

  y = 47;
  doc.setTextColor(23, 86, 112);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('SOLAR EPC QUOTATION', margin, y);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  y += 9;
  line('Client', form.clientName || 'Client', margin);
  line('Contact', form.clientContact, margin + 100, 55);
  y += 6;
  line('Email', form.clientEmail, margin);
  line('Site', form.siteName, margin + 100, 55);
  y += 6;
  line('Address', form.clientAddress, margin);
  y += 6;
  line('Coordinates', `${safe(form.latitude, '-')}, ${safe(form.longitude, '-')}`, margin);

  section('Project design');
  const designRows = [
    ['Segment', form.segment], ['System type', form.systemType], ['Capacity', `${safe(form.capacity, 0)} kW`],
    ['Panel layout', `${safe(form.panelCount, 0)} × ${safe(form.panelWattage, 0)} W`], ['Roof', `${safe(form.roofLength, 0)} m × ${safe(form.roofWidth, 0)} m`],
    ['Tilt / azimuth', `${safe(form.tilt, 0)}° / ${safe(form.azimuth, 180)}°`], ['Panel / inverter', `${safe(form.panelBrand, '-') } / ${safe(form.inverterBrand, '-')}`],
    ['Battery', form.batteryType === 'None' ? 'None' : `${safe(form.batteryType)} · ${safe(form.batteryBrand)} · ${safe(form.batteryKwh)} kWh`]
  ];
  designRows.forEach(([label, value], index) => {
    if (index % 2 === 0) { doc.setFillColor(246, 249, 250); doc.rect(margin, y - 4, contentWidth, 7, 'F'); }
    doc.setFont(undefined, 'bold'); doc.text(label, margin + 3, y);
    doc.setFont(undefined, 'normal'); doc.text(doc.splitTextToSize(safe(value), contentWidth - 65), margin + 62, y);
    y += 7;
  });

  section('Estimate and finance');
  const financeRows = [
    ['Annual generation', `${Math.round(result.annualGeneration || 0).toLocaleString('en-IN')} kWh`], ['Annual saving', money(result.annualValue)],
    ['Project cost', money(result.cost)], ['GST rate', `${safe(form.gstRate, 0)}%`], ['Subsidy scenario', money(result.subsidy)],
    ['Finance amount', money(result.financed)], ['Illustrative EMI', `${money(result.emi)} / month`], ['Simple payback', `${Number(result.payback || 0).toFixed(1)} years`]
  ];
  financeRows.forEach(([label, value], index) => {
    if (index % 2 === 0) { doc.setFillColor(246, 249, 250); doc.rect(margin, y - 4, contentWidth, 7, 'F'); }
    doc.setFont(undefined, 'bold'); doc.text(label, margin + 3, y);
    doc.setFont(undefined, 'normal'); doc.text(safe(value), pageWidth - margin - 3, y, { align: 'right' });
    y += 7;
  });

  section('Notes and terms');
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  const notes = form.notes || 'This quotation is subject to site verification, engineering finalisation, equipment availability, subsidy confirmation, DISCOM approvals, and final agreement terms.';
  doc.text(doc.splitTextToSize(notes, contentWidth), margin, y);
  y += 22;
  doc.setDrawColor(150, 160, 166);
  doc.line(pageWidth - margin - 55, Math.min(y, pageHeight - 30), pageWidth - margin, Math.min(y, pageHeight - 30));
  doc.text('Authorized signatory', pageWidth - margin - 27.5, Math.min(y + 6, pageHeight - 24), { align: 'center' });
  doc.save(`${safe(form.clientName, 'solar-client').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-quotation.pdf`);
}
