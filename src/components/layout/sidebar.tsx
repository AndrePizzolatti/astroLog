'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard, Telescope, CloudSun, Bell, Settings,
  LogOut, Star, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',           icon: LayoutDashboard, label: 'Projetos' },
  { href: '/dashboard/equipment', icon: Telescope,        label: 'Equipamento' },
  { href: '/dashboard/weather',   icon: CloudSun,         label: 'Previsão' },
  { href: '/dashboard/alerts',    icon: Bell,             label: 'Alertas' },
  { href: '/dashboard/settings',  icon: Settings,         label: 'Configurações' },
]

export function Sidebar() {
  const pathname  = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full border-r border-white/5 bg-cosmos-950/80 backdrop-blur-sm">
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cosmos-500/20 border border-cosmos-500/30 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 text-cosmos-400" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: 'var(--font-syne)' }}>
            AstroLog
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150',
                active
                  ? 'bg-cosmos-500/20 text-white border border-cosmos-500/20'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-cosmos-400" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      {session?.user && (
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-cosmos-500/30 flex items-center justify-center text-xs text-cosmos-300 font-bold">
                {session.user.name?.charAt(0) ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/70 truncate">{session.user.name}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors duration-150"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </button>
        </div>
      )}
    </aside>
  )
}
