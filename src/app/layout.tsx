import type { Metadata } from 'next'
import { Syne, Space_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title: 'AstroLog — Gerenciador de Astrofotografia',
  description: 'Gerencie seus projetos, sessões e equipamentos de astrofotografia.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-cosmos-950 text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
