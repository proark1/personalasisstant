import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneBrain Assistant",
  description: "OneBrain assistant work surface"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5f1"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
