import type { Metadata } from 'next';

import { InsuranceWorkspace } from './insurance-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Insurance Policy Check — MediPass',
  description:
    'Save and reuse SBC documents to create conditional benefit estimates with source references.',
};

export default function InsurancePage() {
  return <InsuranceWorkspace />;
}
