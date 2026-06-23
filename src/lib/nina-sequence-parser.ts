// Parser do Advanced Sequencer do N.I.N.A. (.json).
// O formato muda entre versões, então a busca é defensiva: percorre a árvore
// recursivamente atrás de containers de alvo (DeepSkyObjectContainer) e de
// instruções de exposição (TakeExposure / TakeManyExposures / SmartExposure).

export interface NINAExposure {
  filter?:          string
  exposureSeconds:  number
  count:            number
  gain?:            number
  offset?:          number
  binning?:         string  // "1×1"
}

export interface NINATarget {
  name:      string
  ra?:       number   // horas decimais
  dec?:      number   // graus decimais
  exposures: NINAExposure[]
}

type Node = Record<string, any>

function typeOf(node: Node): string {
  return typeof node?.$type === 'string' ? node.$type : ''
}

function childItems(node: Node): Node[] {
  const items = node?.Items
  return Array.isArray(items) ? items : []
}

// ── Coordenadas ───────────────────────────────────────────────────────────────
function readCoordinates(target: Node): { ra?: number; dec?: number } {
  const coords = target?.Coordinates ?? target?.InputCoordinates ?? {}

  // RA: horas decimais diretas, ou horas/minutos/segundos separados
  let ra = num(coords.RA)
  if (ra === undefined && num(coords.RAHours) !== undefined) {
    ra = (num(coords.RAHours) ?? 0) + (num(coords.RAMinutes) ?? 0) / 60 + (num(coords.RASeconds) ?? 0) / 3600
  }

  // Dec: graus decimais diretos, ou graus/minutos/segundos separados (preservando o sinal)
  let dec = num(coords.Dec)
  if (dec === undefined && num(coords.DecDegrees) !== undefined) {
    const deg = num(coords.DecDegrees) ?? 0
    dec = Math.sign(deg) * (Math.abs(deg) + (num(coords.DecMinutes) ?? 0) / 60 + (num(coords.DecSeconds) ?? 0) / 3600)
  }

  if (ra !== undefined && (ra < 0 || ra > 24)) ra = undefined
  if (dec !== undefined && (dec < -90 || dec > 90)) dec = undefined
  return { ra, dec }
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && !isNaN(n) ? n : undefined
}

// ── Exposição ─────────────────────────────────────────────────────────────────
function readExposure(node: Node): NINAExposure | null {
  const exposureSeconds = num(node.ExposureTime) ?? num(node.ExposureSeconds)
  if (exposureSeconds === undefined || exposureSeconds <= 0) return null

  const count =
    num(node.TotalExposureCount) ??
    num(node.Iterations) ??
    num(node.ExposureCount) ??
    1

  const filterName: string | undefined =
    node.Filter?.Name ?? node.FilterType?.Name ?? node.Filter?._name ?? undefined

  const binX = num(node.Binning?.X) ?? num(node.BinningMode?.X)
  const binY = num(node.Binning?.Y) ?? num(node.BinningMode?.Y) ?? binX

  return {
    filter:          filterName?.trim() || undefined,
    exposureSeconds,
    count:           Math.max(1, Math.round(count)),
    gain:            num(node.Gain),
    offset:          num(node.Offset),
    binning:         binX ? `${Math.round(binX)}×${Math.round(binY ?? binX)}` : undefined,
  }
}

// Recolhe todas as exposições dentro de uma subárvore (um alvo).
function collectExposures(node: Node, acc: NINAExposure[]) {
  const t = typeOf(node)
  if (/TakeExposure|TakeManyExposures|SmartExposure|TakeSubframeExposure/.test(t)) {
    const e = readExposure(node)
    if (e) acc.push(e)
  }
  for (const child of childItems(node)) collectExposures(child, acc)
  // Alguns nós guardam a instrução em propriedades aninhadas (ex.: condições/triggers)
  if (Array.isArray(node?.Conditions)) for (const c of node.Conditions) collectExposures(c, acc)
}

// Percorre a árvore atrás de containers de alvo.
function collectTargets(node: Node, acc: NINATarget[]) {
  const t = typeOf(node)
  const target = node?.Target
  const isTargetContainer = /DeepSkyObjectContainer|TargetContainer/.test(t) || (target && target.TargetName)

  if (isTargetContainer && target) {
    const exposures: NINAExposure[] = []
    collectExposures(node, exposures)
    const { ra, dec } = readCoordinates(target)
    const name = (target.TargetName ?? target.Name ?? 'Alvo sem nome').toString().trim()
    if (exposures.length > 0) {
      acc.push({ name, ra, dec, exposures: mergeExposures(exposures) })
      return // não desce mais — exposições já coletadas para este alvo
    }
  }

  for (const child of childItems(node)) collectTargets(child, acc)
}

// Junta exposições idênticas (mesmo filtro/exp/gain/binning) somando as contagens.
function mergeExposures(list: NINAExposure[]): NINAExposure[] {
  const map = new Map<string, NINAExposure>()
  for (const e of list) {
    const key = [e.filter ?? '', e.exposureSeconds, e.gain ?? '', e.binning ?? ''].join('|')
    const existing = map.get(key)
    if (existing) existing.count += e.count
    else map.set(key, { ...e })
  }
  return [...map.values()]
}

export function parseNINASequence(json: unknown): NINATarget[] {
  if (!json || typeof json !== 'object') return []
  const targets: NINATarget[] = []
  collectTargets(json as Node, targets)

  // Fallback: nenhuma estrutura de alvo reconhecida, mas há exposições soltas
  if (targets.length === 0) {
    const exposures: NINAExposure[] = []
    collectExposures(json as Node, exposures)
    if (exposures.length > 0) {
      targets.push({ name: 'Sequência importada', exposures: mergeExposures(exposures) })
    }
  }

  return targets
}

// Helpers de exibição
export function totalIntegrationMin(t: NINATarget): number {
  return t.exposures.reduce((s, e) => s + (e.exposureSeconds * e.count) / 60, 0)
}
