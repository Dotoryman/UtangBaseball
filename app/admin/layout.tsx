import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: '우땅 연구소',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
