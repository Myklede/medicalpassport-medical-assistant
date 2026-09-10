import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './portal/portal.css';
import { FeedbackWidget } from './portal/feedback-widget';

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
    <html lang="vi">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
