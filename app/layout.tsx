import type { Metadata } from 'next';
import './globals.css';
import './styles/screens.css';
import './styles/game-hud.css';
import './styles/playful-ui.css';
import './styles/rewards.css';
import './styles/game-effects.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://utangbaseball.cloud'),
  title: '우땅야구',
  description:
    '우땅이와 함께 7개의 공을 빠르게 치고 최고 점수에 도전하는 야구 게임',
  manifest: '/manifest.webmanifest?v=20260908',
  icons: {
    icon: '/favicon.png?v=20260908',
    shortcut: '/favicon.png?v=20260908',
    apple: '/icons/apple-touch-icon.png?v=20260908',
  },
  openGraph: {
    title: '우땅야구',
    description: '우땅이와 함께 즐기는 빠른 7구 타격 게임',
    type: 'website',
    images: [
      {
        url: '/og-utangbaseball-v120.png',
        width: 1200,
        height: 630,
        alt: '따뜻한 야구장에서 타격하는 우땅이',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '우땅야구',
    description: '우땅이와 함께 즐기는 빠른 7구 타격 게임',
    images: ['/og-utangbaseball-v120.png'],
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
