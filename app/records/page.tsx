import { MedicalDashboard } from '../medical-dashboard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Previous records — MediPass' };

export default async function PreviousRecords({ searchParams }: {
  searchParams: Promise<{ patient?: string | string[] }>;
}) {
  const { patient } = await searchParams;
  // Portal context is for return links only. Legacy records keep their own
  // server-resolved identity; these two patient stores must not be conflated.
  const returnPatientId = typeof patient === 'string' ? patient : undefined;
  return <MedicalDashboard portal="editor" returnPatientId={returnPatientId} />;
}
