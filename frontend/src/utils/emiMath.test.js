import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEmi } from './emiMath.js';

test('calculates a standard reducing-balance EMI', () => {
  const result = calculateEmi({ loanAmount: 100000, annualRate: 12, tenureMonths: 12 });
  assert.equal(result.principal, 100000);
  assert.equal(result.emi, 8884.88);
  assert.equal(result.totalPayment, 106618.56);
  assert.equal(result.totalInterest, 6618.56);
  assert.equal(result.schedule.length, 12);
  assert.equal(result.schedule.at(-1).closingBalance, 0);
});

test('supports zero-interest loans and down payment', () => {
  const result = calculateEmi({ loanAmount: 120000, downPayment: 20000, annualRate: 0, tenureMonths: 10, processingFeeRate: 1 });
  assert.equal(result.principal, 100000);
  assert.equal(result.emi, 10000);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.processingFee, 1000);
  assert.equal(result.totalOutflow, 121000);
});

test('clamps invalid or excessive inputs safely', () => {
  const result = calculateEmi({ loanAmount: 50000, downPayment: 100000, annualRate: -4, tenureMonths: -3 });
  assert.equal(result.principal, 0);
  assert.equal(result.emi, 0);
  assert.deepEqual(result.schedule, []);
});

test('extra monthly payments shorten the payoff period and reduce interest', () => {
  const regular = calculateEmi({ loanAmount: 100000, annualRate: 12, tenureMonths: 24 });
  const accelerated = calculateEmi({ loanAmount: 100000, annualRate: 12, tenureMonths: 24, extraMonthlyPayment: 1000 });
  assert.equal(accelerated.extraMonthlyPayment, 1000);
  assert.ok(accelerated.monthsSaved > 0);
  assert.ok(accelerated.totalInterest < regular.totalInterest);
  assert.equal(accelerated.schedule.at(-1).closingBalance, 0);
});
