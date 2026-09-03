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
      { url: '/og-utangbaseball.png', width: 1200, height: 630, alt: '우땅야구 타격 장면' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '우땅야구',
    description: '우땅이와 함께 즐기는 10구 타격 게임',
    images: ['/og-utangbaseball.png'],
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
