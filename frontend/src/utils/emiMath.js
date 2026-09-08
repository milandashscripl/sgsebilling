const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

export function calculateEmi({ loanAmount = 0, downPayment = 0, annualRate = 0, tenureMonths = 0, processingFeeRate = 0, extraMonthlyPayment = 0 } = {}) {
  const cost = Math.max(0, Number(loanAmount) || 0);
  const upfront = Math.min(cost, Math.max(0, Number(downPayment) || 0));
  const principal = roundCurrency(cost - upfront);
  const rate = Math.max(0, Number(annualRate) || 0);
  const months = Math.max(0, Math.floor(Number(tenureMonths) || 0));
  const extraPayment = Math.max(0, Number(extraMonthlyPayment) || 0);
  const monthlyRate = rate / 1200;
  const emi = principal === 0 || months === 0
    ? 0
    : monthlyRate === 0
      ? principal / months
      : principal * monthlyRate * ((1 + monthlyRate) ** months) / (((1 + monthlyRate) ** months) - 1);
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= months && balance > 0; month += 1) {
    const interest = monthlyRate === 0 ? 0 : balance * monthlyRate;
    const payment = month === months ? balance + interest : Math.min(balance + interest, emi + extraPayment);
    const principalPaid = Math.min(balance, payment - interest);
    balance = Math.max(0, balance - principalPaid);
    schedule.push({
      month,
      openingBalance: roundCurrency(balance + principalPaid),
      emi: roundCurrency(payment),
      principalPaid: roundCurrency(principalPaid),
      interest: roundCurrency(interest),
      closingBalance: roundCurrency(balance)
    });
  }

  const totalPayment = roundCurrency(schedule.reduce((sum, row) => sum + row.emi, 0));
  const totalInterest = roundCurrency(totalPayment - principal);
  const processingFee = roundCurrency(principal * Math.max(0, Number(processingFeeRate) || 0) / 100);

  return {
    cost: roundCurrency(cost),
    downPayment: roundCurrency(upfront),
    principal,
    annualRate: rate,
    tenureMonths: months,
    processingFeeRate: Math.max(0, Number(processingFeeRate) || 0),
    extraMonthlyPayment: extraPayment,
    monthsSaved: Math.max(0, months - schedule.length),
    emi: roundCurrency(emi),
    totalPayment,
    totalInterest,
    processingFee,
    totalOutflow: roundCurrency(upfront + totalPayment + processingFee),
    schedule
  };
}
