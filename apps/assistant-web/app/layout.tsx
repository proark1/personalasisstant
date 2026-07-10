import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getServerSessionToken } from "../src/api/session";
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

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The session cookie is httpOnly, so the client can't tell if it's signed in;
  // decide server-side whether to show the sign-out control.
  const authenticated = Boolean(await getServerSessionToken());
  return (
    <html lang="en">
      <body>
        {authenticated ? <LogoutButton /> : null}
        {children}
      </body>
    </html>
  );
}
