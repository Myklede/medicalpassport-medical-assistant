export type NetworkStatus = 'in-network' | 'out-of-network' | 'unknown';

export type PolicyCitation = {
  label: string;
  page: number | null;
  excerpt: string;
};

type BenefitRule = {
  label: string;
  method: 'copay' | 'coinsurance' | 'covered';
  value: number;
  priorAuthorization: boolean;
  visitLimit: number | null;
  citation: PolicyCitation;
};

export type PolicyProfile = {
  version: 1;
  planName: string;
  pageCount: number;
  extractionMode: 'document-text' | 'demo-fallback';
  extractionConfidence: 'medium' | 'low';
  deductible: number;
  outOfPocketMaximum: number;
  deductibleCitation: PolicyCitation;
  outOfPocketCitation: PolicyCitation;
  rules: Record<string, BenefitRule>;
};

export type CoverageAnalysis = {
  version: 1;
  status: 'likely-covered' | 'conditional' | 'possibly-not-covered';
  statusLabel: string;
  service: string;
  serviceWasInferred: boolean;
  coverageSummary: string;
  estimatedAllowedAmount: number;
  estimatedPlanPays: number;
  estimatedMemberPays: number;
  deductibleApplied: number;
  copayApplied: number;
  coinsuranceApplied: number;
  networkStatus: NetworkStatus;
  priorAuthorization: boolean;
  conditions: string[];
  assumptions: string[];
  citations: PolicyCitation[];
  extractionMode: PolicyProfile['extractionMode'];
  extractionConfidence: PolicyProfile['extractionConfidence'];
};

const demoValues = {
  deductible: 2500,
  outOfPocketMaximum: 7350,
  primaryCareCopay: 35,
  specialistCopay: 70,
  urgentCareCopay: 75,
  emergencyCopay: 500,
  therapyCopay: 50,
  coinsurance: 0.2,
};

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseMoney(value: string) {
  const number = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function pageCitation(
  pages: string[],
  patterns: RegExp[],
  label: string,
  fallback: string,
): PolicyCitation {
  for (let index = 0; index < pages.length; index += 1) {
    const page = compact(pages[index] ?? '');
    for (const pattern of patterns) {
      const match = pattern.exec(page);
      pattern.lastIndex = 0;
      if (!match || match.index === undefined) continue;
      const start = Math.max(0, match.index - 70);
      const end = Math.min(page.length, match.index + match[0].length + 120);
      return { label, page: index + 1, excerpt: page.slice(start, end) };
    }
  }
  return { label, page: null, excerpt: fallback };
}

function moneyNear(pages: string[], patterns: RegExp[]) {
  for (const page of pages) {
    const text = compact(page);
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      pattern.lastIndex = 0;
      if (!match || match.index === undefined) continue;
      const nearby = text.slice(match.index, match.index + 240);
      const amount = nearby.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
      if (amount) return parseMoney(amount[1]);
    }
  }
  return null;
}

function paymentNear(pages: string[], patterns: RegExp[]) {
  for (const page of pages) {
    const text = compact(page);
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      pattern.lastIndex = 0;
      if (!match || match.index === undefined) continue;
      const nearby = text.slice(match.index, match.index + 220);
      const amount = /\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/.exec(nearby);
      const percent = /([0-9]{1,2}(?:\.\d+)?)\s*%/.exec(nearby);
      if (amount && (!percent || amount.index < percent.index)) {
        const value = parseMoney(amount[1]);
        if (value !== null) return { method: 'copay' as const, value };
      }
      if (percent) {
        return {
          method: 'coinsurance' as const,
          value: Math.min(1, Number(percent[1]) / 100),
        };
      }
    }
  }
  return null;
}

function ruleFromPages(
  pages: string[],
  options: {
    key: string;
    label: string;
    patterns: RegExp[];
    fallbackMethod: BenefitRule['method'];
    fallbackValue: number;
    priorAuthorization?: boolean;
    visitLimit?: number | null;
  },
) {
  const payment = paymentNear(pages, options.patterns);
  const extracted = payment !== null;
  const method: BenefitRule['method'] = payment?.method ?? options.fallbackMethod;
  const value = payment?.value ?? options.fallbackValue;
  return {
    key: options.key,
    extracted,
    rule: {
      label: options.label,
      method,
      value,
      priorAuthorization: options.priorAuthorization ?? false,
      visitLimit: options.visitLimit ?? null,
      citation: pageCitation(
        pages,
        options.patterns,
        options.label,
        'No matching benefit line was found in the extractable text.',
      ),
    } satisfies BenefitRule,
  };
}

export function buildPolicyProfile(
  pagesInput: string[],
  filename: string,
): PolicyProfile {
  const rawPages = pagesInput.filter(Boolean).slice(0, 40);
  const pages = rawPages.map(compact).filter(Boolean);
  const deductiblePatterns = [/overall deductible/i, /deductible/i, /khấu trừ/i];
  const outOfPocketPatterns = [/out[- ]of[- ]pocket limit/i, /out[- ]of[- ]pocket maximum/i, /maximum.*pay/i];
  const deductible = moneyNear(pages, deductiblePatterns);
  const outOfPocketMaximum = moneyNear(pages, outOfPocketPatterns);

  const ruleEntries = [
    ruleFromPages(pages, { key: 'primary-care', label: 'Primary care visit', patterns: [/primary care visit/i, /primary care.*injury or illness/i], fallbackMethod: 'copay', fallbackValue: demoValues.primaryCareCopay }),
    ruleFromPages(pages, { key: 'specialist', label: 'Specialist visit', patterns: [/specialist visit/i, /specialist care/i], fallbackMethod: 'copay', fallbackValue: demoValues.specialistCopay }),
    ruleFromPages(pages, { key: 'urgent-care', label: 'Urgent care visit', patterns: [/urgent care/i], fallbackMethod: 'copay', fallbackValue: demoValues.urgentCareCopay }),
    ruleFromPages(pages, { key: 'emergency', label: 'Emergency care', patterns: [/emergency room care/i, /emergency medical/i], fallbackMethod: 'copay', fallbackValue: demoValues.emergencyCopay }),
    ruleFromPages(pages, { key: 'lab', label: 'Diagnostic laboratory testing', patterns: [/diagnostic test/i, /blood work/i, /laboratory/i], fallbackMethod: 'coinsurance', fallbackValue: demoValues.coinsurance }),
    ruleFromPages(pages, { key: 'imaging', label: 'Advanced diagnostic imaging', patterns: [/imaging.*ct.*pet/i, /mri/i, /diagnostic imaging/i], fallbackMethod: 'coinsurance', fallbackValue: demoValues.coinsurance, priorAuthorization: true }),
    ruleFromPages(pages, { key: 'therapy', label: 'Physical therapy', patterns: [/physical therapy/i, /rehabilitation services/i], fallbackMethod: 'copay', fallbackValue: demoValues.therapyCopay, visitLimit: 20 }),
    ruleFromPages(pages, { key: 'outpatient-surgery', label: 'Outpatient surgery', patterns: [/outpatient surgery/i, /facility fee.*surgery/i], fallbackMethod: 'coinsurance', fallbackValue: demoValues.coinsurance, priorAuthorization: true }),
    ruleFromPages(pages, { key: 'inpatient', label: 'Inpatient hospital stay', patterns: [/inpatient hospital/i, /hospital stay/i], fallbackMethod: 'coinsurance', fallbackValue: demoValues.coinsurance, priorAuthorization: true }),
    ruleFromPages(pages, { key: 'preventive', label: 'Preventive care', patterns: [/preventive care/i, /screening.*immunization/i], fallbackMethod: 'covered', fallbackValue: 0 }),
  ];

  const extractedSignals = Number(deductible !== null)
    + Number(outOfPocketMaximum !== null)
    + ruleEntries.filter((entry) => entry.extracted).length;
  const extractionMode = extractedSignals >= 2 ? 'document-text' : 'demo-fallback';
  const fallbackCitation = extractionMode === 'demo-fallback'
    ? 'The PDF was saved, but its benefit table was not clear enough for automatic extraction. This value comes from the simulated MediPass benefit profile.'
    : 'No clear value was found; the analyzer uses a marked demo assumption.';

  const rules = Object.fromEntries(
    ruleEntries.map(({ key, rule, extracted }) => [
      key,
      !extracted && extractionMode === 'demo-fallback'
        ? { ...rule, citation: { label: rule.label, page: null, excerpt: fallbackCitation } }
        : rule,
    ]),
  );

  const firstLine = rawPages.flatMap((page) => page.split(/\n+/)).map(compact).find((line) => line.length >= 4 && line.length <= 120);
  return {
    version: 1,
    planName: firstLine || filename.replace(/\.pdf$/i, '') || 'Uploaded SBC',
    pageCount: pagesInput.length,
    extractionMode,
    extractionConfidence: extractedSignals >= 5 ? 'medium' : 'low',
    deductible: deductible ?? demoValues.deductible,
    outOfPocketMaximum: outOfPocketMaximum ?? demoValues.outOfPocketMaximum,
    deductibleCitation: deductible !== null
      ? pageCitation(pages, deductiblePatterns, 'Deductible', fallbackCitation)
      : { label: 'Deductible', page: null, excerpt: fallbackCitation },
    outOfPocketCitation: outOfPocketMaximum !== null
      ? pageCitation(pages, outOfPocketPatterns, 'Out-of-pocket limit', fallbackCitation)
      : { label: 'Out-of-pocket limit', page: null, excerpt: fallbackCitation },
    rules,
  };
}

type ServiceMatch = {
  key: string;
  label: string;
  defaultCost: number;
  inferred: boolean;
};

function classifyService(condition: string): ServiceMatch {
  const value = condition.toLocaleLowerCase('vi');
  const matches: Array<[RegExp, Omit<ServiceMatch, 'inferred'>]> = [
    [/(mri|ct scan|pet scan|chụp cộng hưởng|chụp cắt lớp|chẩn đoán hình ảnh)/i, { key: 'imaging', label: 'Advanced diagnostic imaging', defaultCost: 1200 }],
    [/(phẫu thuật|surgery|mổ ngoại trú)/i, { key: 'outpatient-surgery', label: 'Outpatient surgery', defaultCost: 5000 }],
    [/(nhập viện|nằm viện|inpatient|hospital stay)/i, { key: 'inpatient', label: 'Inpatient hospital stay', defaultCost: 8500 }],
    [/(cấp cứu|emergency|er visit)/i, { key: 'emergency', label: 'Emergency care', defaultCost: 3200 }],
    [/(urgent care|khám khẩn)/i, { key: 'urgent-care', label: 'Urgent care visit', defaultCost: 240 }],
    [/(vật lý trị liệu|physical therapy|phục hồi chức năng)/i, { key: 'therapy', label: 'Physical therapy session', defaultCost: 180 }],
    [/(xét nghiệm|blood test|lab work|laboratory)/i, { key: 'lab', label: 'Diagnostic laboratory testing', defaultCost: 420 }],
    [/(dự phòng|preventive|vaccine|tiêm chủng|screening)/i, { key: 'preventive', label: 'Preventive care', defaultCost: 180 }],
    [/(chuyên khoa|specialist|tim mạch|da liễu|chấn thương chỉnh hình|nội tiết)/i, { key: 'specialist', label: 'Specialist visit', defaultCost: 260 }],
    [/(khám|bác sĩ|doctor|primary care|hen|asthma|tiểu đường|diabetes|đau|pain)/i, { key: 'primary-care', label: 'Primary care visit', defaultCost: 190 }],
  ];
  for (const [pattern, match] of matches) {
    if (pattern.test(value)) return { ...match, inferred: false };
  }
  return { key: 'specialist', label: 'Specialist visit (assumed)', defaultCost: 260, inferred: true };
}

function roundMoney(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function analyzeCoverage(input: {
  profile: PolicyProfile;
  condition: string;
  networkStatus: NetworkStatus;
  estimatedCost?: number | null;
}): CoverageAnalysis {
  const service = classifyService(input.condition);
  const rule = input.profile.rules[service.key] ?? input.profile.rules.specialist;
  const cost = input.estimatedCost && input.estimatedCost > 0
    ? Math.min(input.estimatedCost, 100000)
    : service.defaultCost;
  const effectiveNetwork = input.networkStatus === 'unknown' ? 'in-network' : input.networkStatus;
  const conditions = [
    'The service must be an eligible benefit and meet the plan’s medical-necessity requirements.',
    'The facility and clinician must be in network unless the plan includes out-of-network benefits.',
  ];
  if (rule.priorAuthorization) conditions.push('Prior authorization must be confirmed before the service is performed.');
  if (rule.visitLimit) conditions.push(`The benefit may have a visit limit; this demo profile uses ${rule.visitLimit} visits per year.`);

  const assumptions = [
    input.estimatedCost
      ? 'The estimate uses the amount entered by the user, which may differ from the insurer’s allowed amount.'
      : `No cost was entered, so the system uses a simulated allowed amount of ${cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
    'The SBC does not show how much deductible has already been used this year; this conservative estimate assumes the full deductible remains.',
  ];
  if (input.networkStatus === 'unknown') assumptions.push('Network status is unknown, so the estimate temporarily assumes an in-network facility.');
  if (service.inferred) assumptions.push('The description did not identify a specific service, so the system assumes one specialist visit.');
  if (input.profile.extractionMode === 'demo-fallback') assumptions.push('The PDF did not provide enough machine-readable text; the benefit rules and amounts are simulated MediPass data and were not read from the document.');

  let planPays = 0;
  let memberPays = cost;
  let deductibleApplied = 0;
  let copayApplied = 0;
  let coinsuranceApplied = 0;
  let status: CoverageAnalysis['status'] = 'likely-covered';

  if (effectiveNetwork === 'out-of-network') {
    status = 'possibly-not-covered';
    conditions.push('This estimate treats the out-of-network service as uncovered; call the insurer to confirm any exception.');
  } else if (rule.method === 'covered') {
    memberPays = 0;
    planPays = cost;
  } else if (rule.method === 'copay') {
    copayApplied = Math.min(cost, rule.value);
    memberPays = copayApplied;
    planPays = cost - memberPays;
  } else {
    deductibleApplied = Math.min(cost, input.profile.deductible);
    const afterDeductible = Math.max(0, cost - deductibleApplied);
    coinsuranceApplied = afterDeductible * rule.value;
    memberPays = deductibleApplied + coinsuranceApplied;
    planPays = cost - memberPays;
  }

  if (status !== 'possibly-not-covered' && (rule.priorAuthorization || service.inferred || input.networkStatus === 'unknown')) {
    status = 'conditional';
  }

  const statusLabel = status === 'likely-covered'
    ? 'Likely covered'
    : status === 'conditional'
      ? 'May be covered if conditions are met'
      : 'May not be covered';
  const coverageSummary = effectiveNetwork === 'out-of-network'
    ? 'Under the demo assumption, the plan may not pay for an out-of-network service.'
    : rule.priorAuthorization
      ? 'Benefits are estimated at the in-network level and depend on approved prior authorization.'
      : 'Benefits are estimated at the in-network level and still depend on the submitted claim.';

  return {
    version: 1,
    status,
    statusLabel,
    service: rule.label || service.label,
    serviceWasInferred: service.inferred,
    coverageSummary,
    estimatedAllowedAmount: roundMoney(cost),
    estimatedPlanPays: roundMoney(planPays),
    estimatedMemberPays: roundMoney(memberPays),
    deductibleApplied: roundMoney(deductibleApplied),
    copayApplied: roundMoney(copayApplied),
    coinsuranceApplied: roundMoney(coinsuranceApplied),
    networkStatus: input.networkStatus,
    priorAuthorization: rule.priorAuthorization,
    conditions,
    assumptions,
    citations: [rule.citation, input.profile.deductibleCitation, input.profile.outOfPocketCitation],
    extractionMode: input.profile.extractionMode,
    extractionConfidence: input.profile.extractionConfidence,
  };
}
