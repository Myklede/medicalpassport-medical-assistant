export type WoundTriageLevel =
  | 'emergency'
  | 'same-day'
  | 'prompt-review'
  | 'monitor';

export type WoundSymptoms = {
  uncontrolledBleeding: boolean;
  lossOfSensationOrFunction: boolean;
  exposedDeepStructure: boolean;
  fever: boolean;
  redStreaks: boolean;
  pusDrainage: boolean;
  spreadingRedness: boolean;
  worseningPain: boolean;
  warmth: boolean;
  swelling: boolean;
  deepOrGaping: boolean;
  bite: boolean;
  puncture: boolean;
  foreignObject: boolean;
  dirtyWound: boolean;
};

export type HealthContextRecord = {
  record_type: string;
  title: string;
  summary: string | null;
  status: string;
};

export type HistoryFactor = {
  key: 'diabetes' | 'circulation' | 'neuropathy' | 'immune' | 'anticoagulant';
  label: string;
  evidence: string[];
  note: string;
};

export type WoundSafetyReview = {
  level: WoundTriageLevel;
  label: string;
  action: string;
  reasons: string[];
  historyFactors: HistoryFactor[];
  limitations: string[];
};

const factorDefinitions: Array<{
  key: HistoryFactor['key'];
  label: string;
  patterns: RegExp[];
  note: string;
}> = [
  {
    key: 'diabetes',
    label: 'Diabetes-related healing risk',
    patterns: [/diabet/i, /hyperglyc/i, /insulin/i, /metformin/i],
    note: 'The record may indicate slower healing or reduced sensation; foot wounds need especially prompt review.',
  },
  {
    key: 'circulation',
    label: 'Circulation-related healing risk',
    patterns: [
      /peripheral arterial/i,
      /peripheral vascular/i,
      /poor circulation/i,
      /ischemi/i,
      /venous insufficiency/i,
    ],
    note: 'The record may indicate reduced blood flow that can affect healing.',
  },
  {
    key: 'neuropathy',
    label: 'Reduced-sensation risk',
    patterns: [/neuropath/i, /loss of sensation/i, /numbness/i],
    note: 'Reduced sensation can make pain an unreliable measure of severity.',
  },
  {
    key: 'immune',
    label: 'Immune-system risk',
    patterns: [
      /immunosuppress/i,
      /immunocomprom/i,
      /chemotherapy/i,
      /transplant/i,
      /prednisone/i,
      /corticosteroid/i,
    ],
    note: 'The record may indicate higher complication risk or less typical symptoms.',
  },
  {
    key: 'anticoagulant',
    label: 'Bleeding-related medication context',
    patterns: [
      /warfarin/i,
      /apixaban/i,
      /eliquis/i,
      /rivaroxaban/i,
      /xarelto/i,
      /dabigatran/i,
      /pradaxa/i,
      /anticoagul/i,
      /blood thinner/i,
    ],
    note: 'The medication list may include a blood thinner, which can affect bleeding.',
  },
];

export function emptyWoundSymptoms(): WoundSymptoms {
  return {
    uncontrolledBleeding: false,
    lossOfSensationOrFunction: false,
    exposedDeepStructure: false,
    fever: false,
    redStreaks: false,
    pusDrainage: false,
    spreadingRedness: false,
    worseningPain: false,
    warmth: false,
    swelling: false,
    deepOrGaping: false,
    bite: false,
    puncture: false,
    foreignObject: false,
    dirtyWound: false,
  };
}

export function findHistoryFactors(records: HealthContextRecord[]): HistoryFactor[] {
  const activeRecords = records.filter((record) => record.status === 'active');
  return factorDefinitions.flatMap((definition) => {
    const matches = activeRecords.filter((record) => {
      const searchable = `${record.title} ${record.summary ?? ''}`;
      return definition.patterns.some((pattern) => pattern.test(searchable));
    });
    if (!matches.length) return [];
    return [
      {
        key: definition.key,
        label: definition.label,
        evidence: matches.map((record) => record.title).slice(0, 3),
        note: definition.note,
      },
    ];
  });
}

export function reviewWoundSafety(input: {
  symptoms: WoundSymptoms;
  painScore: number;
  bodyLocation: string;
  records: HealthContextRecord[];
}): WoundSafetyReview {
  const { symptoms } = input;
  const historyFactors = findHistoryFactors(input.records);
  const reasons: string[] = [];
  let level: WoundTriageLevel = 'monitor';

  if (symptoms.uncontrolledBleeding) {
    reasons.push('Bleeding was reported as severe or not stopping with firm pressure.');
    level = 'emergency';
  }
  if (symptoms.lossOfSensationOrFunction) {
    reasons.push('Loss of feeling or normal function was reported below the injury.');
    level = 'emergency';
  }
  if (symptoms.exposedDeepStructure) {
    reasons.push('Deep tissue, tendon, or bone may be visible.');
    level = 'emergency';
  }

  const sameDaySignals: Array<[boolean, string]> = [
    [symptoms.fever, 'Fever was reported with the wound.'],
    [symptoms.redStreaks, 'A red streak extending from the wound was reported.'],
    [symptoms.pusDrainage, 'Pus-like drainage was reported.'],
    [symptoms.spreadingRedness, 'Redness appears to be spreading.'],
    [symptoms.deepOrGaping, 'The wound was reported as deep or gaping.'],
    [symptoms.foreignObject, 'An object or debris may be stuck in the wound.'],
    [symptoms.bite, 'A human or animal bite was reported.'],
  ];
  for (const [present, reason] of sameDaySignals) {
    if (!present) continue;
    reasons.push(reason);
    if (level !== 'emergency') level = 'same-day';
  }

  const location = input.bodyLocation.toLowerCase();
  const diabetes = historyFactors.some((factor) => factor.key === 'diabetes');
  if (diabetes && /foot|toe|heel|ankle/.test(location)) {
    reasons.push('A foot-area wound is paired with diabetes-related history in the record.');
    if (level !== 'emergency') level = 'same-day';
  }

  const promptSignals: Array<[boolean, string]> = [
    [symptoms.worseningPain, 'Pain was reported as getting worse.'],
    [symptoms.warmth, 'New warmth around the wound was reported.'],
    [symptoms.swelling, 'New or increasing swelling was reported.'],
    [symptoms.puncture, 'A puncture wound was reported.'],
    [symptoms.dirtyWound, 'The wound may be contaminated with dirt, soil, saliva, or another material.'],
    [input.painScore >= 8, 'Severe pain was reported.'],
  ];
  for (const [present, reason] of promptSignals) {
    if (!present) continue;
    reasons.push(reason);
    if (level === 'monitor') level = 'prompt-review';
  }

  if (
    level === 'monitor' &&
    historyFactors.some((factor) =>
      ['diabetes', 'circulation', 'neuropathy', 'immune', 'anticoagulant'].includes(
        factor.key,
      ),
    )
  ) {
    reasons.push('The saved medical record contains a factor that may change healing or complication risk.');
    level = 'prompt-review';
  }

  if (!reasons.length) {
    reasons.push('No urgent warning sign was selected in this assessment.');
  }

  const presentation = {
    emergency: {
      label: 'Emergency action may be needed',
      action:
        'Call 911 or your local emergency number now for severe bleeding that will not stop, loss of feeling or function, or a serious deep injury. Do not wait for this app.',
    },
    'same-day': {
      label: 'Same-day clinical review',
      action:
        'Contact a clinician or urgent care today. If symptoms rapidly worsen or you feel seriously unwell, use emergency services.',
    },
    'prompt-review': {
      label: 'Prompt clinician contact',
      action:
        'Contact your clinician promptly and follow any wound-care plan they have already given you. Seek faster care if any warning sign appears or worsens.',
    },
    monitor: {
      label: 'Close monitoring; no urgent sign reported',
      action:
        'Continue close observation and follow any existing care plan. A photo or checklist cannot confirm that a wound is safe; seek care if it worsens or does not heal.',
    },
  } satisfies Record<WoundTriageLevel, { label: string; action: string }>;

  return {
    level,
    ...presentation[level],
    reasons,
    historyFactors,
    limitations: [
      'The image has been stored for longitudinal review, but no trained image model analyzed it in this build.',
      'This screening cannot diagnose infection, tissue depth, circulation, or healing outcome.',
      'Medical-record matching uses only saved active entries and can miss incomplete or outdated information.',
    ],
  };
}

