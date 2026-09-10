import { PortalWorkspace } from '../portal/portal-workspace';

export const dynamic = 'force-dynamic';

export default function PatientPortal() {
  return <PortalWorkspace mode="patient" />;
}
