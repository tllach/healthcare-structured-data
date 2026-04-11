import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Healthcare App",
  description: "Document extraction workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header>
          <nav aria-label="Main">
            <ul>
              <li>
                <Link href="/">Upload</Link>
              </li>
              <li>
                <Link href="/review">Review</Link>
              </li>
              <li>
                <Link href="/accuracy">Accuracy</Link>
              </li>
            </ul>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
