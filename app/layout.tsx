import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './portal/portal.css';
import { FeedbackWidget } from './portal/review-widget';
import { ThemeToggle } from '@/components/theme-toggle';

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl = new URL(
  'https://medipass-medical-assistant-demo.thnguyen7807.chatgpt.site',
);
const socialImageUrl = new URL('/og.png', siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'MediPass — Your portable medical history',
  icons: { icon: { url: '/medipass-icon.svg', type: 'image/svg+xml' } },
  description:
    'A working prototype for organizing a patient-controlled, portable health record.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'MediPass',
    title: 'MediPass — Your portable medical history',
    description:
      'Organize a patient-controlled health history and keep it ready wherever care happens.',
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: 'MediPass portable medical record',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MediPass — Your portable medical history',
    description:
      'Organize a patient-controlled health history and keep it ready wherever care happens.',
    images: [socialImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem('medipass-theme');var theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.classList.toggle('dark',theme==='dark');root.dataset.theme=theme;root.style.colorScheme=theme;}catch(_){}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ThemeToggle />
        <FeedbackWidget />
      </body>
    </html>
  );
}
