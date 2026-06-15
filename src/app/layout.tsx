import type { Metadata } from "next";
import { RefreshGesture } from "@/components/news/RefreshGesture";
import { TopNav } from "@/components/news/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance News",
  description:
    "A trusted open-access finance news feed with clear source attribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RefreshGesture />
        <TopNav />
        {children}
      </body>
    </html>
  );
}
