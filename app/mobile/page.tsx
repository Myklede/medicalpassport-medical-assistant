'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Monitor } from 'lucide-react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';

function previewPath() {
  const requested = new URLSearchParams(window.location.search).get('path') || '/patient';
  try { const url = new URL(requested, window.location.origin); if (url.origin === window.location.origin && !url.pathname.startsWith('/mobile')) return url.pathname + url.search + url.hash; } catch { /* use patient view */ }
  return '/patient';
}
function subscribePath(sync: () => void) {
  window.addEventListener('popstate', sync);
  return () => window.removeEventListener('popstate', sync);
}

export default function MobilePreview() {
  const path = useSyncExternalStore(subscribePath, previewPath, () => null);
  const [width, setWidth] = useState(390);
  const frame = useRef<HTMLIFrameElement>(null);
  function currentPath() {
    try { const location = frame.current?.contentWindow?.location; if (location && !location.pathname.startsWith('/mobile')) return location.pathname + location.search + location.hash; } catch { /* frame not ready */ }
    return path || '/patient';
  }
  return <main className="mp-phone-preview"><header><Link href="/" className="rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand compact subtitle="Giao diện điện thoại" /></Link><label>Chiều rộng <select value={width} onChange={e => setWidth(Number(e.target.value))}><option value={360}>360 px</option><option value={390}>390 px</option><option value={430}>430 px</option></select></label><Link href={path || '/patient'} onClick={e => { e.preventDefault(); window.location.assign(currentPath()); }}><Monitor size={18} />Về máy tính</Link></header><p>Dùng các nút, nhập hồ sơ và ghim bình luận ngay trong màn hình này.</p><div className="mp-phone-frame" style={{ width }}>{path && <iframe ref={frame} title="MediPass trên điện thoại" src={path} allow="camera; microphone" />}</div></main>;
}
