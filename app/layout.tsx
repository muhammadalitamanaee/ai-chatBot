import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Chatbot",
  description: "Your personal AI assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Add 'dark' class here to enable dark mode globally
    // Remove it to go back to light mode
    // Later you can toggle this dynamically with a button
    <html lang="en" className="">
      <body className={`${geist.className} antialiased`}>{children}</body>
    </html>
  );
}
