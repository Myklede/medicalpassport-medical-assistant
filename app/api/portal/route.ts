import { portalError, portalJson, readPortal, storageStatus, workspaceFor } from '@/db/portal-store';
export async function GET(request: Request) {
  try {
    const data = await readPortal(await workspaceFor(request));
    return portalJson({ patients: data.patients, clinicians: data.clinicians, storage: storageStatus(), demo: true });
  } catch (error) { return portalError(error); }
}
