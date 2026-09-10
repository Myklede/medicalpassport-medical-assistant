import { portalError, portalJson, readPortal, storageStatus, workspaceFor } from '@/db/portal-store';

export async function GET(request: Request) {
  try {
    const data = await readPortal(await workspaceFor(request));
    return portalJson({ ...data, storage: storageStatus(), checked_at: new Date().toISOString() });
  } catch (error) { return portalError(error); }
}
