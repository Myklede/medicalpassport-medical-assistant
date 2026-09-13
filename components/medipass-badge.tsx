import type { SVGProps } from 'react';

/** Code-native biometric shield; no external asset or font dependency. */
export default function MediPassBadge(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}>
    <rect width="40" height="40" rx="12" fill="#2563EB" />
    <path d="M20 6.5 31 11v8.3c0 6.5-4.8 11-11 14.2-6.2-3.2-11-7.7-11-14.2V11L20 6.5Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M14 16.5c0-3.3 2.5-5.5 6-5.5s6 2.2 6 5.5M17 16.5c0-1.7 1.1-2.8 3-2.8s3 1.1 3 2.8M17 25.5c.8 1.5 1.8 2.5 3 3.2 1.5-.9 2.5-2 3.4-3.5" stroke="#BFDBFE" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M6 21h9l2-4 3.2 8 2.8-5 2 1h9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
