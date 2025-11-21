import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from '@/lib/auth-context'
import "./globals.css";
// import ScoreUpdater from "@/components/ScoreUpdater";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlexBet - Sports Prediction Market Trading Platform",
  description: "Trade sports outcomes in real-time on FlexBet. Buy and sell shares during live matches, exit anytime for profit or loss. South Africa's premier sports prediction market with AMM technology and hybrid order book.",
  keywords: ["sports betting", "prediction market", "sports trading", "AMM", "South Africa", "live betting", "sports shares"],
  authors: [{ name: "FlexBet" }],
  openGraph: {
    title: "FlexBet - Trade Sports Like Stocks",
    description: "Buy low, sell high on live sports events. Exit positions anytime with FlexBet's innovative sports prediction market.",
    type: "website",
    locale: "en_ZA",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlexBet - Trade Sports Like Stocks",
    description: "Buy low, sell high on live sports events. Exit positions anytime.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
           {/* <ScoreUpdater /> */}
        </AuthProvider>
      </body>
    </html>
  );
}
