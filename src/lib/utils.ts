import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ──────────────────────────────────────────
// Astronomical calculations
// ──────────────────────────────────────────

export interface TelescopeCalcInput {
  focalLengthMm: number
  apertureMm: number
  pixelSizeUm: number
  sensorWidthPx: number
  sensorHeightPx: number
}

export interface TelescopeCalcResult {
  plateScaleArcsecPx: string
  fovWidthArcmin: string
  fovHeightArcmin: string
  limitingMagnitude: string
  dawesLimitArcsec: string
  focalRatio: string
  sampling: 'oversampled' | 'optimal' | 'undersampled'
  samplingHint: string
}

export function calculateTelescope(input: TelescopeCalcInput): TelescopeCalcResult {
  const { focalLengthMm, apertureMm, pixelSizeUm, sensorWidthPx, sensorHeightPx } = input

  const plateScale = (pixelSizeUm / focalLengthMm) * 206.265
  const fovWidth   = (plateScale * sensorWidthPx) / 60
  const fovHeight  = (plateScale * sensorHeightPx) / 60
  const limitingMag = 2.1 + 5 * Math.log10(apertureMm)
  const dawes      = 116 / apertureMm
  const focalRatio = focalLengthMm / apertureMm

  let sampling: 'oversampled' | 'optimal' | 'undersampled'
  let samplingHint: string
  if (plateScale < 0.8) {
    sampling = 'oversampled'
    samplingHint = 'Considere binning 2×2'
  } else if (plateScale > 3.0) {
    sampling = 'undersampled'
    samplingHint = 'Considere um redutor focal'
  } else {
    sampling = 'optimal'
    samplingHint = 'Amostragem ótima'
  }

  return {
    plateScaleArcsecPx: plateScale.toFixed(2),
    fovWidthArcmin:     fovWidth.toFixed(2),
    fovHeightArcmin:    fovHeight.toFixed(2),
    limitingMagnitude:  limitingMag.toFixed(2),
    dawesLimitArcsec:   dawes.toFixed(2),
    focalRatio:         focalRatio.toFixed(1),
    sampling,
    samplingHint,
  }
}

// ──────────────────────────────────────────
// Date formatters
// ──────────────────────────────────────────

export function formatDate(date: Date | string) {
  return format(new Date(date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })
}

export function formatDateShort(date: Date | string) {
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatRelative(date: Date | string) {
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true })
}

// ──────────────────────────────────────────
// Number formatters
// ──────────────────────────────────────────

export function formatIntegration(minutes: number): string {
  if (minutes < 60) return `${minutes.toFixed(0)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function formatFileSize(bytes: bigint | number): string {
  const n = Number(bytes)
  if (n < 1024)        return `${n} B`
  if (n < 1024 ** 2)   return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3)   return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

// ──────────────────────────────────────────
// Filter colors
// ──────────────────────────────────────────

export const FILTER_COLORS: Record<string, string> = {
  L:    'bg-white/20 text-white border border-white/30',
  R:    'bg-red-500/20 text-red-300 border border-red-500/30',
  G:    'bg-green-500/20 text-green-300 border border-green-500/30',
  B:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  Ha:   'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  OIII: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  SII:  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
}

export function filterPillClass(filter: string): string {
  return FILTER_COLORS[filter] ?? 'bg-white/10 text-white/60 border border-white/20'
}

// ──────────────────────────────────────────
// Project status
// ──────────────────────────────────────────

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING:         'Planejamento',
  IN_PROGRESS:      'Em andamento',
  READY_TO_PROCESS: 'Pronto p/ processar',
  PROCESSING:       'Processando',
  COMPLETED:        'Concluído',
  ARCHIVED:         'Arquivado',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  PLANNING:         'bg-blue-500/20 text-blue-300',
  IN_PROGRESS:      'bg-amber-500/20 text-amber-300',
  READY_TO_PROCESS: 'bg-purple-500/20 text-purple-300',
  PROCESSING:       'bg-cosmos-500/20 text-cosmos-300',
  COMPLETED:        'bg-aurora-400/20 text-aurora-400',
  ARCHIVED:         'bg-white/10 text-white/55',
}
