export function calculateTaxableValue(inclusiveAmount, gstRate = 0) {
  const rate = Number(gstRate || 0);
  if (!Number.isFinite(Number(inclusiveAmount)) || Number(inclusiveAmount) <= 0) return 0;
  if (rate <= 0) return Number(inclusiveAmount);
  return Number((Number(inclusiveAmount) / (1 + rate / 100)).toFixed(2));
}

export function calculateGstBreakdown(inclusiveAmount, gstRate = 0) {
  const amount = Number(inclusiveAmount || 0);
  const rate = Number(gstRate || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { taxableValue: 0, gstAmount: 0, finalAmount: 0 };
  }

  const taxableValue = calculateTaxableValue(amount, rate);
  const gstAmount = Number((amount - taxableValue).toFixed(2));

  return {
    taxableValue,
    gstAmount,
    finalAmount: Number((taxableValue + gstAmount).toFixed(2))
  };
}

export function getEffectiveGstRate(entry) {
  const totalRate = Number(entry?.sgstRate || 0) + Number(entry?.cgstRate || 0) + Number(entry?.igstRate || 0);
  return Math.max(0, totalRate);
}
