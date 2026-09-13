import regularFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import boldFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import {
  portalError,
  readPortal,
  storageStatus,
  workspaceFor,
} from '@/db/portal-store';
import { buildIpsBundle, createIpsSnapshot } from '@/lib/ips';
import { buildIpsPdf } from '@/lib/ips-pdf';
import { PortalError, safeId } from '@/lib/portal-validation';

function downloadName(recordNumber: string, extension: 'pdf' | 'json'): string {
  const safeRecordNumber = recordNumber
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .slice(0, 60);
  return `medipass-ips-${safeRecordNumber || 'patient'}.${extension}`;
}

function downloadHeaders(contentType: string, filename: string): HeadersInit {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    Vary: 'oai-authenticated-user-id',
    'X-Content-Type-Options': 'nosniff',
  };
}

async function fontBytes(
  assetUrl: string,
  requestUrl: string,
): Promise<Uint8Array> {
  const response = await fetch(new URL(assetUrl, requestUrl));
  if (!response.ok)
    throw new PortalError('Unable to load the font required to create the PDF.', 500);
  return new Uint8Array(await response.arrayBuffer());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const patientId = safeId(url.searchParams.get('patient_id'));
    const format = url.searchParams.get('format') || 'pdf';
    if (format !== 'pdf' && format !== 'json') {
      throw new PortalError('Export format must be PDF or FHIR JSON.');
    }

    const data = await readPortal(await workspaceFor(request));
    const patient = data.patients.find((item) => item.id === patientId);
    if (!patient) throw new PortalError('Patient not found.', 404);
    const snapshot = createIpsSnapshot(
      patient,
      data.encounters,
      storageStatus().label,
    );
    const bundle = buildIpsBundle(snapshot);

    if (format === 'json') {
      return new Response(JSON.stringify(bundle, null, 2), {
        headers: downloadHeaders(
          'application/fhir+json; charset=utf-8',
          downloadName(patient.medical_record_number, 'json'),
        ),
      });
    }

    const [regular, bold] = await Promise.all([
      fontBytes(regularFontUrl, request.url),
      fontBytes(boldFontUrl, request.url),
    ]);
    const pdf = await buildIpsPdf(snapshot, bundle, regular, bold);
    return new Response(new Uint8Array(pdf).buffer, {
      headers: downloadHeaders(
        'application/pdf',
        downloadName(patient.medical_record_number, 'pdf'),
      ),
    });
  } catch (error) {
    return portalError(error);
  }
}
