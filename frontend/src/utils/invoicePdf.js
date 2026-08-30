import { jsPDF } from 'jspdf';

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

const getItemTaxRate = (item = {}) => Number(item.sgstRate || 0) + Number(item.cgstRate || 0) + Number(item.igstRate || 0);
const safeValue = (value, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : Number(fallback);
};

export async function downloadInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 10;

  let sellerLogo = invoice.sellerLogo || null;
  try {
    const storedUser = localStorage.getItem('user');
    if (!sellerLogo && storedUser) {
      const su = JSON.parse(storedUser);
      if (su?.shopLogoUrl) sellerLogo = su.shopLogoUrl;
    }
  } catch {
    // ignore
  }

  doc.setFillColor(13, 82, 131);
  doc.rect(0, 0, pageWidth, 28, 'F');
  if (sellerLogo) {
    const imgData = await loadImageAsDataUrl(sellerLogo).catch(() => null);
    if (imgData) {
      try {
        doc.addImage(imgData, 'PNG', marginLeft, 7, 22, 22);
      } catch {
        try { doc.addImage(imgData, 'JPEG', marginLeft, 7, 22, 22); } catch {}
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(invoice.sellerName || 'SGSE Billing', marginLeft + 28, 16);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  if (invoice.sellerAddress) {
    const addressLines = doc.splitTextToSize(invoice.sellerAddress, contentWidth - 28);
    doc.text(addressLines, marginLeft + 28, 21);
  }

  y = 38;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  const invoiceTitle = invoice.type === 'purchase' ? 'PURCHASE INVOICE' : invoice.type === 'setup' ? 'SETUP BILL' : invoice.type === 'return' ? 'RETURN INVOICE' : 'GST INVOICE';
  doc.text(invoiceTitle, marginLeft, y);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Invoice No: ${invoice.invoiceNumber || 'N/A'}`, pageWidth - marginRight - 60, y);
  y += 6;
  doc.text(`Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, pageWidth - marginRight - 60, y);
  y += 8;

  doc.setDrawColor(218, 226, 233);
  doc.setFillColor(245, 249, 252);
  doc.roundedRect(marginLeft, y, contentWidth, 24, 2, 2, 'F');
  doc.setTextColor(30, 50, 72);
  doc.setFont(undefined, 'bold');
  doc.text('Bill To', marginLeft + 5, y + 7);
  doc.setFont(undefined, 'normal');
  doc.text(invoice.partyName || invoice.customerName || 'Walk-in Customer', marginLeft + 5, y + 13);
  doc.text(invoice.partyPhone || invoice.customerPhone || '—', marginLeft + 5, y + 18);
  doc.text(invoice.partyGSTIN || 'GSTIN: Not provided', pageWidth - marginRight - 55, y + 13, { align: 'right' });
  y += 30;

  doc.setTextColor(20, 20, 20);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  const headers = ['Item', 'Qty', 'Final Price', 'Base', 'GST', 'Amount'];
  const startX = [marginLeft + 2, marginLeft + 92, marginLeft + 118, marginLeft + 150, marginLeft + 172, marginLeft + 193];
  headers.forEach((header, index) => {
    doc.text(header, startX[index], y);
  });
  y += 5;

  doc.setDrawColor(200, 210, 220);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 4;

  const displayItems = invoice.type === 'setup'
    ? [{
        name: invoice.setupName || 'Setup Package',
        quantity: 1,
        price: safeValue(invoice.grandTotal, 0),
        sgstRate: 0,
        cgstRate: 0,
        igstRate: 0,
        total: safeValue(invoice.grandTotal, 0)
      }]
    : (Array.isArray(invoice.items) && invoice.items.length ? invoice.items : []);

  let subtotalValue = 0;
  let gstTotal = 0;

  displayItems.forEach((item, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const qty = safeValue(item.quantity, 1);
    const finalPrice = safeValue(item.price, 0);
    const taxRate = invoice.type === 'setup' ? 0 : getItemTaxRate(item);
    const taxableValue = invoice.type === 'setup'
      ? safeValue(invoice.subtotal, 0)
      : (taxRate > 0 ? Number((finalPrice / (1 + taxRate / 100)).toFixed(2)) : finalPrice);
    const lineTax = invoice.type === 'setup'
      ? safeValue(invoice.gstAmount, 0)
      : Number((finalPrice * qty - taxableValue * qty).toFixed(2));
    const lineTotal = invoice.type === 'setup'
      ? safeValue(invoice.grandTotal, 0)
      : Number((finalPrice * qty).toFixed(2));

    subtotalValue += invoice.type === 'setup' ? safeValue(invoice.subtotal, 0) : Number((taxableValue * qty).toFixed(2));
    gstTotal += invoice.type === 'setup' ? safeValue(invoice.gstAmount, 0) : lineTax;

    doc.setFont(undefined, 'normal');
    doc.text(String(index + 1), marginLeft + 2, y);
    const itemName = String(item.name || 'Item').slice(0, 25);
    doc.text(itemName, marginLeft + 10, y);
    doc.text(String(qty), marginLeft + 95, y);
    doc.text(`₹${finalPrice.toFixed(2)}`, marginLeft + 115, y);
    doc.text(`₹${(taxableValue).toFixed(2)}`, marginLeft + 150, y);
    doc.text(`₹${lineTax.toFixed(2)}`, marginLeft + 172, y);
    doc.text(`₹${lineTotal.toFixed(2)}`, marginLeft + 193, y, { align: 'right' });
    y += 6;
  });

  y += 5;
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 5;

  const subtotalFromInvoice = safeValue(invoice.subtotal, subtotalValue);
  const gstFromInvoice = safeValue(invoice.gstAmount, gstTotal);
  const grandTotal = safeValue(invoice.grandTotal, subtotalFromInvoice + gstFromInvoice);

  doc.setFont(undefined, 'bold');
  doc.text('Taxable Value', marginLeft + 140, y);
  doc.text(`₹${subtotalFromInvoice.toFixed(2)}`, pageWidth - marginRight, y, { align: 'right' });
  y += 6;
  doc.text('GST', marginLeft + 140, y);
  doc.text(`₹${gstFromInvoice.toFixed(2)}`, pageWidth - marginRight, y, { align: 'right' });
  y += 8;
  doc.setFillColor(244, 248, 251);
  doc.rect(marginLeft + 120, y - 4, contentWidth - 120, 10, 'F');
  doc.text('TOTAL', marginLeft + 140, y);
  doc.text(`₹${grandTotal.toFixed(2)}`, pageWidth - marginRight, y, { align: 'right' });
  y += 14;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  const declaration = 'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.';
  const declLines = doc.splitTextToSize(declaration, contentWidth - 30);
  doc.text(declLines, marginLeft, y);
  y += declLines.length * 4 + 8;
  doc.text(`Authorized Signatory`, pageWidth - marginRight - 30, y, { align: 'right' });
  doc.text(`For ${invoice.sellerName || 'SGSE Billing'}`, pageWidth - marginRight - 30, y + 6, { align: 'right' });

  doc.save(`${invoice.invoiceNumber || 'gst-invoice'}.pdf`);
}

export default downloadInvoicePdf;
