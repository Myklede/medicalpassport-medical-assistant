// Server-side QA helper. Secrets never enter the browser or test output.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadEnvFile } from 'node:process';

export function supabaseBrowserStore() {
  if (process.env.MEDIPASS_VERIFY_SUPABASE !== '1') return null;
  loadEnvFile('.env.local');
  const base = process.env.SUPABASE_URL?.trim(), key = process.env.SUPABASE_SECRET_KEY?.trim();
  assert.equal(base, 'https://gsllxxdewmksjbcnxgvp.supabase.co');
  assert.ok(key, 'Supabase server key required');
  // Only the localhost browser-qa identity. Never accept a production workspace.
  const workspace = 'demo-' + createHash('sha256').update('medipass-portal:browser-qa').digest('hex');
  const headers = { apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) };
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + '/rest/v1/' + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, `Supabase QA ${method}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  return {
    read: () => request('rpc/mp_portal_read', 'POST', { p_workspace: workspace }),
    async cleanup(legacyPatientId) {
      const filter = '?workspace_id=eq.' + workspace;
      for (const table of ['mp_feedback','mp_portal_audit','mp_encounter_labs','mp_encounter_medications','mp_encounter_procedures','mp_encounters','mp_patient_conditions','mp_patient_allergies','mp_clinicians','mp_portal_patients']) await request(table + filter, 'DELETE');
      await request('mp_portal_workspaces?id=eq.' + workspace, 'DELETE');
      if (legacyPatientId) {
        assert.match(legacyPatientId, /^[a-f0-9-]{36}$/);
        for (const table of ['medipass_health_records','medipass_audit_events']) await request(table + '?patient_id=eq.' + legacyPatientId, 'DELETE');
        await request('medipass_patients?id=eq.' + legacyPatientId, 'DELETE');
      }
      assert.equal((await request('mp_portal_workspaces?id=eq.' + workspace)).length, 0);
    },
  };
}
