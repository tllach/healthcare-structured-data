import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Healthcare App",
  description: "Document extraction workflow",
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header>
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-2 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-bold text-blue-600">MedExtract</span>
              <span className="text-sm text-gray-500">
                AI-powered prior authorization
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
