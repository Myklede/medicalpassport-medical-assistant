import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emptyWoundSymptoms,
  reviewWoundSafety,
  type HealthContextRecord,
} from '../lib/wound-safety.ts';

const noRecords: HealthContextRecord[] = [];

void test('routes uncontrolled bleeding to the emergency boundary', () => {
  const symptoms = emptyWoundSymptoms();
  symptoms.uncontrolledBleeding = true;
  const review = reviewWoundSafety({
    symptoms,
    painScore: 2,
    bodyLocation: 'left hand',
    records: noRecords,
  });

  assert.equal(review.level, 'emergency');
  assert.match(review.action, /911|emergency number/i);
});

void test('routes reported infection warning signs to same-day review', () => {
  const symptoms = emptyWoundSymptoms();
  symptoms.redStreaks = true;
  symptoms.fever = true;
  const review = reviewWoundSafety({
    symptoms,
    painScore: 4,
    bodyLocation: 'forearm',
    records: noRecords,
  });

  assert.equal(review.level, 'same-day');
  assert.ok(review.reasons.some((reason) => /red streak/i.test(reason)));
});

void test('pairs a foot wound with active diabetes history conservatively', () => {
  const review = reviewWoundSafety({
    symptoms: emptyWoundSymptoms(),
    painScore: 0,
    bodyLocation: 'right heel',
    records: [
      {
        record_type: 'condition',
        title: 'Type 2 diabetes mellitus',
        summary: 'Managed by primary care.',
        status: 'active',
      },
    ],
  });

  assert.equal(review.level, 'same-day');
  assert.equal(review.historyFactors[0]?.key, 'diabetes');
});

void test('does not match inactive history as a current modifier', () => {
  const review = reviewWoundSafety({
    symptoms: emptyWoundSymptoms(),
    painScore: 0,
    bodyLocation: 'right heel',
    records: [
      {
        record_type: 'condition',
        title: 'Gestational diabetes',
        summary: null,
        status: 'resolved',
      },
    ],
  });

  assert.equal(review.level, 'monitor');
  assert.equal(review.historyFactors.length, 0);
});

void test('uses medication history as context without diagnosing', () => {
  const review = reviewWoundSafety({
    symptoms: emptyWoundSymptoms(),
    painScore: 1,
    bodyLocation: 'lower leg',
    records: [
      {
        record_type: 'medication',
        title: 'Apixaban 5 mg',
        summary: 'Twice daily.',
        status: 'active',
      },
    ],
  });

  assert.equal(review.level, 'prompt-review');
  assert.equal(review.historyFactors[0]?.key, 'anticoagulant');
  assert.ok(review.limitations.some((limitation) => /cannot diagnose/i.test(limitation)));
});

void test('a low-signal assessment never claims the wound is safe', () => {
  const review = reviewWoundSafety({
    symptoms: emptyWoundSymptoms(),
    painScore: 1,
    bodyLocation: 'knee',
    records: noRecords,
  });

  assert.equal(review.level, 'monitor');
  assert.doesNotMatch(review.label, /\bsafe\b/i);
  assert.match(review.action, /cannot confirm/i);
});
