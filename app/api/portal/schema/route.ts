import schema from '@/supabase/migrations/20260909000000_medipass_portal.sql?raw';
import previousRecords from '@/supabase/migrations/20260905000000_medipass_core.sql?raw';
import annotations from '@/supabase/migrations/20260909020000_visual_annotations.sql?raw';
import preserveDemo from '@/supabase/migrations/20260909010000_preserve_portal_demo.sql?raw';
import { portalError, workspaceFor } from '@/db/portal-store';
export async function GET(request: Request) {
  try {
    await workspaceFor(request);
    return new Response(`${previousRecords}\n\n${schema}\n\n${preserveDemo}\n\n${annotations}`, { headers: { 'Content-Type': 'application/sql; charset=utf-8', 'Content-Disposition': 'attachment; filename="medipass_portal_setup.sql"', 'Cache-Control': 'no-store' } });
  } catch (error) { return portalError(error); }
}
