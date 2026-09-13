import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeCoverage,
  buildPolicyProfile,
} from '../lib/insurance-analysis.ts';

const samplePages = [
  `MediPass Silver SBC
   What is the overall deductible? $1,000 individual.
   What is the out-of-pocket limit? $6,500 individual.`,
  `Common medical events
   Specialist visit $50 copay.
   Imaging CT/PET scans and MRI 20% coinsurance.
   Physical therapy $40 copay.`,
];

void test('extracts core SBC amounts and attaches page citations', () => {
  const profile = buildPolicyProfile(samplePages, 'sample-sbc.pdf');
  assert.equal(profile.extractionMode, 'document-text');
  assert.equal(profile.deductible, 1000);
  assert.equal(profile.outOfPocketMaximum, 6500);
  assert.equal(profile.rules.specialist.method, 'copay');
  assert.equal(profile.rules.specialist.value, 50);
  assert.equal(profile.rules.specialist.citation.page, 2);
});

void test('estimates in-network MRI cost with deductible and coinsurance', () => {
  const profile = buildPolicyProfile(samplePages, 'sample-sbc.pdf');
  const result = analyzeCoverage({
    profile,
    condition: 'Knee pain; the clinician recommended an MRI.',
    networkStatus: 'in-network',
    estimatedCost: 4000,
  });
  assert.equal(result.status, 'conditional');
  assert.equal(result.priorAuthorization, true);
  assert.equal(result.deductibleApplied, 1000);
  assert.equal(result.coinsuranceApplied, 600);
  assert.equal(result.estimatedMemberPays, 1600);
  assert.equal(result.estimatedPlanPays, 2400);
});

void test('keeps out-of-network estimate conservative', () => {
  const profile = buildPolicyProfile(samplePages, 'sample-sbc.pdf');
  const result = analyzeCoverage({
    profile,
    condition: 'Cardiology specialist visit.',
    networkStatus: 'out-of-network',
    estimatedCost: 300,
  });
  assert.equal(result.status, 'possibly-not-covered');
  assert.equal(result.estimatedPlanPays, 0);
  assert.equal(result.estimatedMemberPays, 300);
});

void test('labels unreadable documents as demo fallback', () => {
  const profile = buildPolicyProfile([], 'scan-only-sbc.pdf');
  const result = analyzeCoverage({
    profile,
    condition: 'Physical therapy for knee pain.',
    networkStatus: 'in-network',
  });
  assert.equal(profile.extractionMode, 'demo-fallback');
  assert.equal(result.extractionMode, 'demo-fallback');
  assert.ok(result.assumptions.some((item) => item.includes('simulated')));
});
