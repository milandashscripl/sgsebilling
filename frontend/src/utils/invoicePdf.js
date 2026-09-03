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
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const formatMoney = (value) => `₹${safeValue(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let y = 14;

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

  doc.setFillColor(20, 42, 61);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(236, 156, 54);
  doc.rect(0, 32, pageWidth, 2, 'F');
  if (sellerLogo) {
    const imgData = await loadImageAsDataUrl(sellerLogo).catch(() => null);
    if (imgData) {
      try {
        doc.addImage(imgData, 'PNG', marginLeft, 7, 20, 20);
      } catch {
        try { doc.addImage(imgData, 'JPEG', marginLeft, 7, 20, 20); } catch {}
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.setFont(undefined, 'bold');
  doc.text(invoice.sellerName || 'SGSE Billing', marginLeft + 26, 17);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  const sellerAddress = invoice.sellerAddress || 'Business address';
  const sellerAddressLines = doc.splitTextToSize(sellerAddress, contentWidth - 28);
  doc.text(sellerAddressLines, marginLeft + 26, 24);

  y = 40;
  doc.setDrawColor(220, 226, 233);
  doc.setFillColor(244, 247, 249);
  doc.roundedRect(marginLeft, y, contentWidth, 24, 2, 2, 'F');
  doc.setDrawColor(220, 226, 231);
  doc.roundedRect(marginLeft, y, contentWidth, 24, 2, 2, 'S');
  doc.setTextColor(20, 42, 61);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('TAX INVOICE', marginLeft + 5, y + 9);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(74, 88, 99);
  doc.text(`Invoice No: ${invoice.invoiceNumber || 'N/A'}`, pageWidth - marginRight - 5, y + 7, { align: 'right' });
  doc.text(`Nature: ${invoice.natureOfSupply || 'B2B'}`, pageWidth - marginRight - 5, y + 12, { align: 'right' });
  doc.text(`Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, pageWidth - marginRight - 5, y + 17, { align: 'right' });
  y += 30;

  doc.setTextColor(20, 42, 61);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  const invoiceTitle = invoice.type === 'purchase' ? 'PURCHASE INVOICE' : invoice.type === 'setup' ? 'SETUP BILL' : invoice.type === 'return' ? 'RETURN INVOICE' : 'GST INVOICE';
  doc.text(invoiceTitle, marginLeft, y);
  doc.setDrawColor(236, 156, 54);
  doc.setLineWidth(1.2);
  doc.line(marginLeft, y + 3, marginLeft + 30, y + 3);
  doc.setLineWidth(0.2);
  y += 7;

  doc.setDrawColor(220, 228, 236);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(marginLeft, y, contentWidth, 26, 2, 2, 'FD');
  doc.setFont(undefined, 'bold');
  doc.text('Bill To', marginLeft + 5, y + 7);
  doc.setFont(undefined, 'normal');
  const billToName = invoice.partyName || invoice.customerName || 'Walk-in Customer';
  const billToPhone = invoice.partyPhone || invoice.customerPhone || '—';
  const billToGstin = invoice.partyGSTIN || 'GSTIN: Not provided';
  const billToLines = doc.splitTextToSize(billToName, 62);
  doc.text(billToLines, marginLeft + 5, y + 13);
  if (billToPhone) doc.text(billToPhone, marginLeft + 5, y + 18 + (billToLines.length - 1) * 3.5);
  doc.text(billToGstin, pageWidth - marginRight - 52, y + 13, { align: 'right' });
  y += 32 + Math.max(0, billToLines.length - 1) * 2;

  doc.setTextColor(20, 20, 20);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(8.2);
  const tableX = [marginLeft + 5, marginLeft + 103, marginLeft + 122, marginLeft + 148, pageWidth - marginRight - 5];
  const headers = ['Item', 'Qty', 'Base', 'GST', 'Amount'];
  doc.setFillColor(20, 42, 61);
  doc.rect(marginLeft, y - 5, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  headers.forEach((header, index) => {
    doc.text(header, tableX[index], y + 1, { align: index === 4 ? 'right' : 'left' });
  });
  y += 8;

  doc.setTextColor(20, 20, 20);
  doc.setDrawColor(205, 214, 224);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 2;

  const setupRows = Array.isArray(invoice.items) && invoice.items.length ? invoice.items : [];
  const displayItems = invoice.type === 'setup' ? setupRows : (Array.isArray(invoice.items) && invoice.items.length ? invoice.items : []);

  let subtotalValue = 0;
  let gstTotal = 0;

  displayItems.forEach((item, index) => {
    if (y > 246) {
      doc.addPage();
      y = 18;
    }

    const qty = safeValue(item.quantity, 1);
    const finalPrice = safeValue(item.price, 0);
    const taxRate = invoice.type === 'setup' ? 0 : getItemTaxRate(item);
    const taxableValue = invoice.type === 'setup' ? 0 : (taxRate > 0 ? Number((finalPrice / (1 + taxRate / 100)).toFixed(2)) : finalPrice);
    const lineTax = invoice.type === 'setup' ? 0 : Number((finalPrice * qty - taxableValue * qty).toFixed(2));
    const lineTotal = invoice.type === 'setup' ? 0 : Number((finalPrice * qty).toFixed(2));

    subtotalValue += invoice.type === 'setup' ? 0 : Number((taxableValue * qty).toFixed(2));
    gstTotal += invoice.type === 'setup' ? 0 : lineTax;

    doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255);
    const rowHeight = 6 + Math.max(0, linesToRender.length - 1) * 4;
    doc.rect(marginLeft, y - 2, contentWidth, rowHeight, 'F');
    doc.setFont(undefined, 'normal');
    const itemName = String(item.name || 'Item');
    const itemLines = doc.splitTextToSize(itemName, 52);
    const linesToRender = itemLines.slice(0, 2);
    doc.text(String(index + 1), marginLeft + 5, y + 3);
    linesToRender.forEach((line, lineIndex) => {
      doc.text(line, marginLeft + 13, y + 3 + (lineIndex * 4));
    });

    doc.text(String(qty), tableX[1], y + 3);
    doc.text(invoice.type === 'setup' ? '—' : formatMoney(taxableValue), tableX[2], y + 3);
    doc.text(invoice.type === 'setup' ? '—' : formatMoney(lineTax), tableX[3], y + 3);
    doc.text(invoice.type === 'setup' ? '—' : formatMoney(lineTotal), tableX[4], y + 3, { align: 'right' });
    y += rowHeight;
  });

  y += 4;
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  const subtotalFromInvoice = safeValue(invoice.subtotal, subtotalValue);
  const gstFromInvoice = safeValue(invoice.gstAmount, gstTotal);
  const grandTotal = safeValue(invoice.grandTotal, subtotalFromInvoice + gstFromInvoice);

  doc.setFillColor(244, 247, 249);
  doc.setDrawColor(220, 226, 231);
  doc.roundedRect(pageWidth - marginRight - 76, y, 76, 30, 2, 2, 'FD');
  doc.setTextColor(74, 88, 99);
  doc.setFont(undefined, 'bold');
  doc.text('Taxable', pageWidth - marginRight - 68, y + 7);
  doc.text(formatMoney(subtotalFromInvoice), pageWidth - marginRight - 5, y + 7, { align: 'right' });
  doc.text('GST', pageWidth - marginRight - 68, y + 13);
  doc.text(formatMoney(gstFromInvoice), pageWidth - marginRight - 5, y + 13, { align: 'right' });
  doc.setTextColor(20, 42, 61);
  doc.text('TOTAL', pageWidth - marginRight - 68, y + 21);
  doc.text(formatMoney(grandTotal), pageWidth - marginRight - 5, y + 21, { align: 'right' });
  y += 38;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  const declaration = 'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.';
  const declLines = doc.splitTextToSize(declaration, contentWidth - 20);
  doc.text(declLines, marginLeft, y);
  y += declLines.length * 4 + 10;
  doc.setDrawColor(236, 156, 54);
  doc.line(pageWidth - marginRight - 52, y - 3, pageWidth - marginRight, y - 3);
  doc.text('Authorized Signatory', pageWidth - marginRight - 28, y, { align: 'right' });
  doc.text(`For ${invoice.sellerName || 'SGSE Billing'}`, pageWidth - marginRight - 28, y + 6, { align: 'right' });

  doc.save(`${invoice.invoiceNumber || 'gst-invoice'}.pdf`);
}

export default downloadInvoicePdf;
