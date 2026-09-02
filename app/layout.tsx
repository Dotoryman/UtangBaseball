import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '우땅야구 | 10구 한구승부',
  description:
    '우땅이와 함께 10개의 공을 치고 최고 점수에 도전하는 1분 야구 게임',
  openGraph: {
    title: '우땅야구',
    description: '10구로 겨루는 오늘의 한구승부',
    type: 'website',
    images: [{ url: '/og.png', width: 1536, height: 864, alt: '우땅야구 타격 장면' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '우땅야구',
    description: '10구로 겨루는 오늘의 한구승부',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
