import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VillaCuidar — Sistema ILPI',
  description: 'Sistema de gestão para Instituições de Longa Permanência para Idosos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
