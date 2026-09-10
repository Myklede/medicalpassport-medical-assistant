import { PortalWorkspace } from './portal/portal-workspace';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <PortalWorkspace mode="patient" />;
}
