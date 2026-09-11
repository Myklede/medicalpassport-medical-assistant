import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COUNTRIES,
  MEDICATION_EXCHANGES,
  medicationSearchText,
  pairReview,
  type CountryCode,
} from '../lib/medication-exchange.ts';

const countries = Object.keys(COUNTRIES) as CountryCode[];

void test('demo contains exactly 20 reviewed medication groups for all four countries', () => {
  assert.equal(MEDICATION_EXCHANGES.length, 20);
  assert.deepEqual(countries.sort(), ['CN', 'IN', 'US', 'VN']);
  assert.equal(new Set(MEDICATION_EXCHANGES.map((item) => item.id)).size, 20);
  for (const medication of MEDICATION_EXCHANGES) {
    assert.match(medication.atc, /^[A-Z]\d{2}[A-Z]{2}\d{2}$/);
    assert.deepEqual(Object.keys(medication.products).sort(), [
      'CN',
      'IN',
      'US',
      'VN',
    ]);
    assert.ok(medication.safetyNote.length > 30);
    assert.ok(medication.excipientWatch.length > 30);
    assert.equal(medication.pharmacistChecks.length, 3);
  }
});

void test('catalog contains both OTC and prescription examples', () => {
  const classes = new Set(
    MEDICATION_EXCHANGES.flatMap((item) =>
      countries.map((code) => item.products[code].access),
    ),
  );
  assert.ok(classes.has('otc'));
  assert.ok(classes.has('rx'));
  assert.ok(classes.has('verify'));
});

void test('Panadol and Tylenol normalize to the same ingredient group', () => {
  const item = MEDICATION_EXCHANGES.find(
    (medication) => medication.id === 'paracetamol',
  );
  assert.ok(item);
  assert.equal(item.products.VN.exampleName, 'Panadol 500 mg');
  assert.equal(item.products.US.exampleName, 'Tylenol Extra Strength');
  assert.match(medicationSearchText(item), /panadol/);
  assert.match(medicationSearchText(item), /tylenol/);
  assert.match(item.inn, /paracetamol.+acetaminophen/i);
});

void test('pair review never declares automatic substitution', () => {
  for (const medication of MEDICATION_EXCHANGES) {
    for (const from of countries) {
      for (const to of countries) {
        if (from === to) continue;
        const review = pairReview(medication, from, to);
        assert.equal(review.requiresExpertReview, true);
        assert.doesNotMatch(
          review.summary,
          /tương đương điều trị|thay thế an toàn/i,
        );
      }
    }
  }
});

void test('known cross-border formulation and access differences are surfaced', () => {
  const inhaler = MEDICATION_EXCHANGES.find((item) => item.id === 'salbutamol');
  const cough = MEDICATION_EXCHANGES.find(
    (item) => item.id === 'dextromethorphan',
  );
  assert.ok(inhaler && cough);
  assert.equal(pairReview(inhaler, 'VN', 'US').sameStrength, false);
  assert.equal(pairReview(cough, 'US', 'CN').accessChanged, true);
  assert.equal(cough.products.CN.access, 'rx');
});
