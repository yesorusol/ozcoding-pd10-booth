import type { Metadata } from "next";
import { Black_Han_Sans, Noto_Sans_KR, DotGothic16 } from "next/font/google";
import "./globals.css";

// Heavy bold Korean + Latin sans for the marquee headline / hero text.
const marquee = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marquee",
  display: "swap",
});

// Clean Korean + Latin sans used everywhere else (lists, copy, captions).
const body = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

// Pixel-art Korean+Latin font for sheet header/footer (Y2K poster vibe).
const pixelFont = DotGothic16({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OZCODING PD10 부스",
  description: "PD10 네트워킹 데이 Y2K 포토부스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${marquee.variable} ${body.variable} ${pixelFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
