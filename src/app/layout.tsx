import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'GlomoRegWatch - Regulatory Intelligence',
  description: 'AI-powered regulatory monitoring tool for Glomopay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased text-slate-800 bg-[#f8fafc]`}>
        {children}
      </body>
    </html>
  );
}
