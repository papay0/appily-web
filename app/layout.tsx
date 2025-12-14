import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Geist_Mono, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import "./globals.css";

import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interDisplay = Inter_Tight({
  variable: "--font-inter-display",
  subsets: ["latin"],
  weight: "variable",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: "italic",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Appily - Build native mobile apps with AI",
  description: "Turn your ideas into real iOS and Android apps in minutes. No coding required, no technical knowledge needed.",
  icons: {
    icon: "/appily-logo.svg",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${geistMono.variable} ${interDisplay.variable} ${playfair.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
