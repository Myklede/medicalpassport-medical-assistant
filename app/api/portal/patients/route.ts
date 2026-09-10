import { portalError, portalJson, readBody, savePortal, workspaceFor } from '@/db/portal-store';
import { validatePatient } from '@/lib/portal-validation';
export async function POST(request: Request) {
  try {
    const workspace = await workspaceFor(request);
    const patient = validatePatient(await readBody(request));
    return portalJson({ patient: await savePortal(workspace, 'patient', patient) }, patient.version ? 200 : 201);
  } catch (error) { return portalError(error); }
}
