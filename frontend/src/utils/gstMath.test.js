import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGstBreakdown, calculateTaxableValue } from './gstMath.js';

test('GST breakdown returns correct taxable value and GST amount for 18% rate', () => {
  const result = calculateGstBreakdown(1180, 18);
  assert.equal(result.taxableValue, 1000);
  assert.equal(result.gstAmount, 180);
  assert.equal(result.finalAmount, 1180);
  assert.equal(result.sgstAmount, 90);
  assert.equal(result.cgstAmount, 90);
});

test('Taxable value calculation is precise for inclusive pricing', () => {
  const taxable = calculateTaxableValue(1180, 18);
  assert.equal(taxable, 1000);
});
