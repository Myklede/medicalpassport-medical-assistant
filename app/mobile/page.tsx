'use client';
import { useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import Link from '@/components/app-link';

export default function MobilePreview() {
  const [path, setPath] = useState('/patient'), [ready, setReady] = useState(false), [width, setWidth] = useState(390);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('path') || '/patient';
    try { const url = new URL(requested, window.location.origin); if (url.origin === window.location.origin && !url.pathname.startsWith('/mobile')) setPath(url.pathname + url.search + url.hash); } catch { /* use patient view */ }
    setReady(true);
  }, []);
  function currentPath() {
    try { const location = frame.current?.contentWindow?.location; if (location && !location.pathname.startsWith('/mobile')) return location.pathname + location.search + location.hash; } catch { /* frame not ready */ }
    return path;
  }
  return <main className="mp-phone-preview"><header><div><Smartphone /><strong>MediPass · Giao diện điện thoại</strong></div><label>Chiều rộng <select value={width} onChange={e => setWidth(Number(e.target.value))}><option value={360}>360 px</option><option value={390}>390 px</option><option value={430}>430 px</option></select></label><Link href={path} onClick={e => { e.preventDefault(); window.location.assign(currentPath()); }}><Monitor size={18} />Về máy tính</Link></header><p>Dùng các nút, nhập hồ sơ và ghim bình luận ngay trong màn hình này.</p><div className="mp-phone-frame" style={{ width }}>{ready && <iframe ref={frame} title="MediPass trên điện thoại" src={path} allow="camera; microphone" />}</div></main>;
}
