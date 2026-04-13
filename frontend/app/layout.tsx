import type { Metadata } from "next";

import { AppNavbar } from "@/components/AppNavbar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Healthcare App",
  description: "Document extraction workflow",
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppNavbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
