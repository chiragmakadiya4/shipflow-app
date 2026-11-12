import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShipFlow',
  description: 'Open-source release radar and deployment platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
