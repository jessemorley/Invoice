import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "fallback",
});

export const metadata: Metadata = {
  title: "Invoicing",
  description: "Freelance invoicing app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Invoices",
  },
  icons: {
    apple: "/app_icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" />
        <SpeedInsights />
      </body>
    </html>
  );
}
