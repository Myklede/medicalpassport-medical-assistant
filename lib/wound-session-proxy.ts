const backend = 'http://127.0.0.1:8000';
const route = /^\/api\/wound-sessions(?:\/[0-9a-f]{32}(?:\/visits(?:\/[0-9a-f]{32}(?:\/(?:image|analyze))?)?)?)?$/;

/** Fixed local adapter: the phone talks to the web server, never its own loopback. */
export async function proxyWoundSession(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!route.test(url.pathname)) return Response.json({ detail: 'Không tìm thấy đường dẫn theo dõi.' }, { status: 404 });
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return new Response(null, { status: 405 });
  const origin = request.headers.get('origin');
  if (request.method !== 'GET' && origin && origin !== url.origin) {
    return Response.json({ detail: 'Yêu cầu phải đến từ cùng trang MediPass.' }, { status: 403 });
  }
  const length = Number(request.headers.get('content-length') || '0');
  if (length > 9 * 1024 * 1024) return Response.json({ detail: 'Ảnh vượt giới hạn 8 MiB.' }, { status: 413 });
  try {
    const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
    if (body && body.byteLength > 9 * 1024 * 1024) return Response.json({ detail: 'Ảnh vượt giới hạn 8 MiB.' }, { status: 413 });
    const headers = new Headers();
    if (body) headers.set('Content-Type', request.headers.get('content-type') || 'application/octet-stream');
    const response = await fetch(`${backend}${url.pathname}${url.search}`, {
      method: request.method, body, headers, redirect: 'error', signal: AbortSignal.timeout(60_000),
    });
    return new Response(response.body, { status: response.status, headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return Response.json({ detail: 'Chưa kết nối được dịch vụ vết thương trên máy chủ MediPass. Hãy chạy Python API cổng 8000; dữ liệu đã lưu vẫn được giữ lại.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
