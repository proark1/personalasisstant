import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LogoutButton } from "../src/components/logout-button";

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
      <body>
        <LogoutButton />
        {children}
      </body>
    </html>
  );
}
