import { portalError, portalJson, readBody, readPortal, savePortal, workspaceFor } from '@/db/portal-store';
import { validateFeedback } from '@/lib/portal-validation';
export async function GET(request: Request) {
  try {
    const data = await readPortal(await workspaceFor(request));
    return portalJson({ requests: data.feedback.sort((a, b) => b.created_at.localeCompare(a.created_at)) });
  } catch (error) { return portalError(error); }
}
export async function POST(request: Request) {
  try {
    const workspace = await workspaceFor(request);
    const feedback = validateFeedback(await readBody(request));
    return portalJson({ request: await savePortal(workspace, 'feedback', feedback) }, feedback.version ? 200 : 201);
  } catch (error) { return portalError(error); }
}
