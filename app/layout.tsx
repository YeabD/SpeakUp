import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const display = localFont({ src: './fonts/Outfit.ttf', variable: '--font-display', display: 'swap', weight: '100 900' });
const body = localFont({ src: './fonts/PlusJakartaSans.ttf', variable: '--font-body', display: 'swap', weight: '200 800' });

export const metadata: Metadata = {
  title: "SpeakUp",
  description: "Build speaking confidence through guided practice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased ${display.variable} ${body.variable}`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <a className="skip-link" href="#main-content">Skip to content</a>
          {children}
          <div className="studio-theme-control"><ThemeToggle /></div>
        </ThemeProvider>
      </body>
    </html>
  );
}
