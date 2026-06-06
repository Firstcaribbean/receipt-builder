import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Receipt Template Builder',
  description: 'Build editable receipt templates from uploaded design samples.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
