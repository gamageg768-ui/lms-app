import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EduPortal LMS',
  description: 'A comprehensive learning management system for A/L students',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} bg-white text-gray-900 min-h-screen select-none`}>
        {children}
      </body>
    </html>
  );
}
