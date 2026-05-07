import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Truss Calculator",
  description: "Planungswerkzeug fuer Standsicherheits-Berechnungen von Traversensystemen.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  )
}
