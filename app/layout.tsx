import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ClearPath — AI Customs Intelligence',
  description: 'Automate customs entry with AI-powered document extraction and HTS classification',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
