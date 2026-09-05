import { env } from 'cloudflare:workers';

import { getPatientContext, writeAudit } from '@/db/runtime';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxBytes = 8 * 1024 * 1024;

function safeFilename(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
  return cleaned || 'attachment';
}

export async function POST(request: Request) {
  try {
    const context = await getPatientContext(request);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Choose a file to upload.' }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return Response.json(
        { error: 'Only PDF, JPEG, and PNG files are accepted.' },
        { status: 400 },
      );
    }
    if (!file.size || file.size > maxBytes) {
      return Response.json(
        { error: 'The attachment must be between 1 byte and 8 MB.' },
        { status: 400 },
      );
    }
    if (!env.FILES) throw new Error('The R2 file binding is unavailable.');

    const id = crypto.randomUUID();
    const filename = safeFilename(file.name);
    const objectKey = `patients/${context.patientId}/${id}-${filename}`;
    await env.FILES.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { recordOwner: context.patientId },
    });

    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        `INSERT INTO storage_objects
         (id, patient_id, object_key, original_filename, mime_type, byte_size,
          purpose, uploaded_by_user_id, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'medical-record-attachment', ?, ?, NULL)`,
      )
        .bind(
          id,
          context.patientId,
          objectKey,
          file.name.slice(0, 180),
          file.type,
          String(file.size),
          context.userId,
          now,
        )
        .run();
    } catch (error) {
      await env.FILES.delete(objectKey);
      throw error;
    }

    await writeAudit(context, 'upload', 'DocumentReference', id);
    return Response.json({
      id,
      name: file.name,
      mime_type: file.type,
      byte_size: file.size,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not upload this attachment.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const context = await getPatientContext(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'File id is required.' }, { status: 400 });
    const metadata = await env.DB.prepare(
      `SELECT id, object_key, original_filename, mime_type
       FROM storage_objects
       WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(id, context.patientId)
      .first<{
        id: string;
        object_key: string;
        original_filename: string;
        mime_type: string;
      }>();
    if (!metadata) return Response.json({ error: 'File not found.' }, { status: 404 });
    const object = await env.FILES.get(metadata.object_key);
    if (!object) return Response.json({ error: 'File not found.' }, { status: 404 });

    await writeAudit(context, 'download', 'DocumentReference', metadata.id);
    return new Response(object.body, {
      headers: {
        'Content-Type': metadata.mime_type,
        'Content-Disposition': `inline; filename="${safeFilename(metadata.original_filename)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not open this attachment.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getPatientContext(request);
    const body = (await request.json()) as { id?: string };
    const id = typeof body.id === 'string' ? body.id.trim().slice(0, 80) : '';
    if (!id) return Response.json({ error: 'File id is required.' }, { status: 400 });
    const metadata = await env.DB.prepare(
      `SELECT id, object_key FROM storage_objects
       WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(id, context.patientId)
      .first<{ id: string; object_key: string }>();
    if (!metadata) return Response.json({ error: 'File not found.' }, { status: 404 });

    await env.FILES.delete(metadata.object_key);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE health_records SET attachment_id = NULL, updated_at = ?
         WHERE patient_id = ? AND attachment_id = ?`,
      ).bind(now, context.patientId, id),
      env.DB.prepare(
        `UPDATE storage_objects SET deleted_at = ?
         WHERE id = ? AND patient_id = ?`,
      ).bind(now, id, context.patientId),
    ]);
    await writeAudit(context, 'delete', 'DocumentReference', id);
    return Response.json({ id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not delete this attachment.' }, { status: 500 });
  }
}
