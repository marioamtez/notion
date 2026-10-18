import type { Metadata } from "next";
import { JetBrains_Mono, Lora } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { EdgeStoreProvider } from "@/lib/edgestore";
import { ToasterProvider } from "@/components/providers/toaster-provider";

const mozillaText = localFont({
  src: [
    {
      path: "../public/MozillaText-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/MozillaText-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/MozillaText-Medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-mozilla-text",
});
const mozillaHeadline = localFont({
  src: "../public/MozillaHeadline-Light.ttf",
  weight: "300",
  style: "normal",
  variable: "--font-mozilla-headline",
});
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Mbrand Notion",
  description: "El Notion de Mbrand",
  icons: { icon: [] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${mozillaText.className} ${mozillaText.variable} ${mozillaHeadline.variable} ${lora.variable} ${jetbrainsMono.variable}`}
      >
        <QueryProvider>
          <EdgeStoreProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              storageKey="zotion-theme-2"
            >
              <ToasterProvider />
              <ModalProvider />
              {children}
            </ThemeProvider>
          </EdgeStoreProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
