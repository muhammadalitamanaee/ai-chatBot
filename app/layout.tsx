import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["latin"],
  variable: "--font-vazirmatn",
});

export const metadata: Metadata = {
  title: "دستیار لیارا",
  description: "دستیار هوشمند مستندات لیارا",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Persian-first, RTL. Code/URLs are isolated as LTR at their use sites.
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
