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

  doc.setFillColor(12, 82, 131);
  doc.rect(0, 0, pageWidth, 28, 'F');
  if (sellerLogo) {
    const imgData = await loadImageAsDataUrl(sellerLogo).catch(() => null);
    if (imgData) {
      try {
        doc.addImage(imgData, 'PNG', marginLeft, 6, 22, 22);
      } catch {
        try { doc.addImage(imgData, 'JPEG', marginLeft, 6, 22, 22); } catch {}
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont(undefined, 'bold');
  doc.text(invoice.sellerName || 'SGSE Billing', marginLeft + 28, 16);
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  const sellerAddress = invoice.sellerAddress || 'Business address';
  const sellerAddressLines = doc.splitTextToSize(sellerAddress, contentWidth - 32);
  doc.text(sellerAddressLines, marginLeft + 28, 21);

  y = 38;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  const invoiceTitle = invoice.type === 'purchase' ? 'PURCHASE INVOICE' : invoice.type === 'setup' ? 'SETUP BILL' : invoice.type === 'return' ? 'RETURN INVOICE' : 'GST INVOICE';
  doc.text(invoiceTitle, marginLeft, y);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8.5);
  const rightMetaX = pageWidth - marginRight - 58;
  doc.text(`Invoice No: ${invoice.invoiceNumber || 'N/A'}`, rightMetaX, y);
  doc.text(`Nature: ${invoice.natureOfSupply || 'B2B'}`, rightMetaX, y + 5);
  doc.text(`Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, rightMetaX, y + 10);
  y += 14;

  doc.setDrawColor(220, 228, 236);
  doc.setFillColor(246, 249, 252);
  doc.roundedRect(marginLeft, y, contentWidth, 26, 2.5, 2.5, 'F');
  doc.setTextColor(30, 50, 72);
  doc.setFont(undefined, 'bold');
  doc.text('Bill To', marginLeft + 5, y + 7);
  doc.setFont(undefined, 'normal');
  const billToName = invoice.partyName || invoice.customerName || 'Walk-in Customer';
  const billToPhone = invoice.partyPhone || invoice.customerPhone || '—';
  const billToGstin = invoice.partyGSTIN || 'GSTIN: Not provided';
  const billToLines = doc.splitTextToSize(billToName, 62);
  doc.text(billToLines, marginLeft + 5, y + 13);
  doc.text(billToPhone, marginLeft + 5, y + 18 + (billToLines.length - 1) * 3.5);
  doc.text(billToGstin, pageWidth - marginRight - 52, y + 13, { align: 'right' });
  y += 32 + Math.max(0, billToLines.length - 1) * 2;

  doc.setTextColor(20, 20, 20);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(8.5);
  const itemNameWidth = 52;
  const qtyX = marginLeft + 84;
  const finalPriceX = marginLeft + 104;
  const baseX = marginLeft + 136;
  const gstX = marginLeft + 160;
  const amountX = marginLeft + 186;
  const headers = ['Item', 'Qty', 'Final Price', 'Base', 'GST', 'Amount'];
  const startX = [marginLeft + 2, qtyX, finalPriceX, baseX, gstX, amountX];
  headers.forEach((header, index) => {
    doc.text(header, startX[index], y);
  });
  y += 5;

  doc.setDrawColor(205, 214, 224);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 4;

  const setupRows = Array.isArray(invoice.items) && invoice.items.length ? invoice.items : [];
  const displayItems = invoice.type === 'setup' ? setupRows : (Array.isArray(invoice.items) && invoice.items.length ? invoice.items : []);

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
      ? 0
      : (taxRate > 0 ? Number((finalPrice / (1 + taxRate / 100)).toFixed(2)) : finalPrice);
    const lineTax = invoice.type === 'setup'
      ? 0
      : Number((finalPrice * qty - taxableValue * qty).toFixed(2));
    const lineTotal = invoice.type === 'setup'
      ? 0
      : Number((finalPrice * qty).toFixed(2));

    subtotalValue += invoice.type === 'setup' ? 0 : Number((taxableValue * qty).toFixed(2));
    gstTotal += invoice.type === 'setup' ? 0 : lineTax;

    doc.setFont(undefined, 'normal');
    const itemName = String(item.name || 'Item');
    const itemLines = doc.splitTextToSize(itemName, itemNameWidth);
    const linesToRender = itemLines.slice(0, 2);
    doc.text(String(index + 1), marginLeft + 2, y + 2);
    linesToRender.forEach((line, lineIndex) => {
      doc.text(line, marginLeft + 10, y + 2 + (lineIndex * 4));
    });
    doc.text(String(qty), qtyX + 4, y + 2);
    doc.text(invoice.type === 'setup' ? '' : `₹${finalPrice.toFixed(2)}`, finalPriceX + 2, y + 2);
    doc.text(invoice.type === 'setup' ? '' : `₹${(taxableValue).toFixed(2)}`, baseX + 2, y + 2);
    doc.text(invoice.type === 'setup' ? '' : `₹${lineTax.toFixed(2)}`, gstX + 2, y + 2);
    doc.text(invoice.type === 'setup' ? '' : `₹${lineTotal.toFixed(2)}`, amountX + 2, y + 2, { align: 'right' });
    y += 5 + Math.max(0, linesToRender.length - 1) * 4;
  });

  y += 5;
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 5;

  const subtotalFromInvoice = safeValue(invoice.subtotal, subtotalValue);
  const gstFromInvoice = safeValue(invoice.gstAmount, gstTotal);
  const grandTotal = safeValue(invoice.grandTotal, subtotalFromInvoice + gstFromInvoice);

  doc.setFont(undefined, 'bold');
  doc.text('Taxable Value', marginLeft + 120, y);
  doc.text(`₹${subtotalFromInvoice.toFixed(2)}`, pageWidth - marginRight, y, { align: 'right' });
  y += 6;
  doc.text('GST', marginLeft + 120, y);
  doc.text(`₹${gstFromInvoice.toFixed(2)}`, pageWidth - marginRight, y, { align: 'right' });
  y += 8;
  doc.setFillColor(244, 248, 251);
  doc.rect(marginLeft + 120, y - 4, contentWidth - 120, 10, 'F');
  doc.text('TOTAL', marginLeft + 120, y);
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
