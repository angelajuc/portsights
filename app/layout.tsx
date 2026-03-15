import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portsights AI Driven Customs Brokerage Intelligence',
  description: 'Automate manual data entry with AI powered document extraction and HTS code classification',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
