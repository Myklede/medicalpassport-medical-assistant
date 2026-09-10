import { portalError, portalJson, readBody, readPortal, savePortal, workspaceFor } from '@/db/portal-store';
import { safeId, validateEncounter, PortalError } from '@/lib/portal-validation';
export async function GET(request: Request) {
  try {
    const workspace = await workspaceFor(request);
    const patientId = safeId(new URL(request.url).searchParams.get('patient_id'));
    const data = await readPortal(workspace);
    if (!data.patients.some(p => p.id === patientId)) throw new PortalError('Không tìm thấy bệnh nhân.', 404);
    return portalJson({ encounters: data.encounters.filter(e => e.patient_id === patientId).sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at)) });
  } catch (error) { return portalError(error); }
}
export async function POST(request: Request) {
  try {
    const workspace = await workspaceFor(request);
    const encounter = validateEncounter(await readBody(request));
    return portalJson({ encounter: await savePortal(workspace, 'encounter', encounter) }, encounter.version ? 200 : 201);
  } catch (error) { return portalError(error); }
}
