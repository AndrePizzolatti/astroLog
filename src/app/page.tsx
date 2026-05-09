import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  Star, Layers, Telescope, CloudSun, Library,
  Camera, CalendarDays, Clock, ArrowRight,
} from 'lucide-react'

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Nav ── */}
      <header className="border-b border-white/5 bg-cosmos-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cosmos-500/20 border border-cosmos-500/30 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-cosmos-400" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: 'var(--font-syne)' }}>
              AstroLog
            </span>
          </div>
          <Link href="/login" className="btn-primary text-sm px-4 py-1.5">
            Entrar
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cosmos-800/30 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/3 w-[200px] h-[200px] bg-aurora-400/5 rounded-full blur-2xl" />
          <div className="absolute top-1/4 right-1/3 w-[180px] h-[180px] bg-nebula-400/5 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-aurora-400/20 bg-aurora-400/5 text-aurora-400 text-xs font-medium mb-2">
            <Star className="w-3 h-3" />
            Gerenciador de Astrofotografia
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Seus projetos de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cosmos-300 to-aurora-400">
              astrofotografia
            </span>
            , organizados.
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            Do planejamento à ficha técnica final. Registre sessões, gerencie equipamentos,
            acompanhe a previsão do céu e reutilize calibrações — tudo em um lugar.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/login" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
              Começar agora <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-secondary text-base px-6 py-3">
              Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 pb-24 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={Layers}
            color="text-cosmos-400"
            bg="bg-cosmos-500/10"
            title="Projetos e Sessões"
            description="Organize por objeto-alvo. Registre cada noite com gain, exposição, seeing, guiagem e condições atmosféricas."
          />
          <FeatureCard
            icon={Telescope}
            color="text-nebula-400"
            bg="bg-nebula-400/10"
            title="Equipamentos"
            description="Cadastre telescópios, câmeras e montagens. Monte setups nomeados e reutilize entre projetos."
          />
          <FeatureCard
            icon={CloudSun}
            color="text-aurora-400"
            bg="bg-aurora-400/10"
            title="Previsão do Céu"
            description="7 noites de forecast com score para astrofotografia. Nuvens hora a hora baseados na sua localização."
          />
          <FeatureCard
            icon={Library}
            color="text-star-400"
            bg="bg-star-400/10"
            title="Biblioteca de Calibração"
            description="Darks e biases por câmera. O sistema encontra automaticamente os frames compatíveis com cada sessão."
          />
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-3 gap-8 text-center">
          <Stat icon={CalendarDays} value="7 noites" label="de previsão de céu" />
          <Stat icon={Camera}       value="±2°C"     label="tolerância de temperatura no matching" />
          <Stat icon={Clock}        value="100%"      label="dos dados na sua conta" />
        </div>
      </section>

      {/* ── CTA bottom ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center w-full">
        <h2
          className="text-2xl sm:text-3xl font-bold text-white mb-4"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          Pronto para organizar suas noites de captura?
        </h2>
        <p className="text-white/40 mb-8">
          Login com Google ou GitHub. Sem cadastro manual.
        </p>
        <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-base px-6 py-3">
          Criar conta gratuita <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-white/20">
          <span>AstroLog v0.1.0</span>
          <span>Astrofotografia · Feito no Brasil</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon: Icon, color, bg, title, description,
}: {
  icon: React.ElementType
  color: string
  bg: string
  title: string
  description: string
}) {
  return (
    <div className="card p-5 space-y-3">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <h3 className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-syne)' }}>
        {title}
      </h3>
      <p className="text-xs text-white/40 leading-relaxed">{description}</p>
    </div>
  )
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-center gap-2">
        <Icon className="w-4 h-4 text-cosmos-400" />
        <p className="text-2xl font-bold text-white mono">{value}</p>
      </div>
      <p className="text-xs text-white/30">{label}</p>
    </div>
  )
}
