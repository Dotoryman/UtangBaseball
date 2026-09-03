import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://utangbaseball.cloud'),
  title: '우땅야구',
  description:
    '우땅이와 함께 10개의 공을 치고 최고 점수에 도전하는 1분 야구 게임',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: '우땅야구',
    description: '우땅이와 함께 즐기는 10구 타격 게임',
    type: 'website',
    images: [
      { url: '/og-utangbaseball-v4.png', width: 1200, height: 630, alt: '야간 야구장에서 타격하는 우땅이' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '우땅야구',
    description: '우땅이와 함께 즐기는 10구 타격 게임',
    images: ['/og-utangbaseball-v4.png'],
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
