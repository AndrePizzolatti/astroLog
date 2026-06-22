#!/usr/bin/env node
// AstroLog — Agente local do Siril
// Processa um projeto com siril-cli, limpa intermediários, ARQUIVA os resultados
// (SSD + pasta do Google Drive sincronizado) e reporta os caminhos finais pro
// AstroLog. Também organiza uma pasta de captura na estrutura do Siril.
// Zero dependências (Node 18+).
//
// Config: crie "siril-agent.config.json" ao lado deste script:
//   {
//     "appUrl": "https://seu-app.vercel.app",
//     "token":  "token-gerado-em-Configuracoes",
//     "siril":  "C:/Program Files/Siril/bin/siril-cli.exe",
//     "ssdArchiveDir": "E:/AstroArchive",            // opcional — arquivo canônico (move pra cá)
//     "driveSyncDir":  "G:/Meu Drive/Astro",         // opcional — pasta do Google Drive p/ Desktop (copia pra cá)
//     "archiveMasters": false,                        // arquivar também os master_*
//     "dflatMaxSeconds": 30                           // darks <= isso viram dark flats no organize
//   }
//
// Processar:
//   node siril-agent.mjs --project <id> --folder "D:/Astro/NGC3372" --script "D:/Astro/NGC3372/NGC3372.ssf"
// Organizar pasta de captura na estrutura lights/darks/flats/dflats:
//   node siril-agent.mjs --organize "D:/Captura/2024-03-01" --into "D:/Astro/NGC3372"

import {
  readFileSync, existsSync, readdirSync, statSync, mkdirSync, renameSync,
  copyFileSync, unlinkSync, openSync, readSync, closeSync,
} from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, basename } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

const RESULT       = /(stacked|result|final|starless|starmask|stars|_sho|_hoo|_soo)/i
const INTERMEDIATE = /^(pp_|r_|bkg_|conv|light_|Ha_pp|OIII_pp).*\.(fit|fits|fts|seq)$/i

// ── Config / args ─────────────────────────────────────────────────────────────
function loadConfig() {
  const file = join(HERE, 'siril-agent.config.json')
  let cfg = {}
  if (existsSync(file)) {
    try { cfg = JSON.parse(readFileSync(file, 'utf8')) } catch { fail('siril-agent.config.json inválido') }
  }
  return {
    appUrl:         process.env.ASTROLOG_URL   || cfg.appUrl,
    token:          process.env.ASTROLOG_TOKEN || cfg.token,
    siril:          process.env.SIRIL_CLI      || cfg.siril || 'siril-cli',
    ssdArchiveDir:  cfg.ssdArchiveDir,
    driveSyncDir:   cfg.driveSyncDir,
    archiveMasters: !!cfg.archiveMasters,
    dflatMaxSeconds: typeof cfg.dflatMaxSeconds === 'number' ? cfg.dflatMaxSeconds : 30,
  }
}

function parseArgs() {
  const args = {}
  const a = process.argv.slice(2)
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { args[a[i].slice(2)] = a[i + 1]; i++ }
  }
  return args
}

function fail(msg) { console.error('✖', msg); process.exit(1) }

// move entre volumes (rename falha com EXDEV em discos diferentes no Windows)
function moveFile(src, dst) {
  try { renameSync(src, dst) }
  catch { copyFileSync(src, dst); unlinkSync(src) }
}

// ── API ───────────────────────────────────────────────────────────────────────
async function report(cfg, body) {
  try {
    const res = await fetch(`${cfg.appUrl.replace(/\/$/, '')}/api/agent/report`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body:    JSON.stringify(body),
    })
    if (!res.ok) console.warn('  (aviso) AstroLog respondeu', res.status)
  } catch (e) {
    console.warn('  (aviso) não consegui falar com o AstroLog:', e.message)
  }
}

// ── Limpeza segura ──────────────────────────────────────────────────────────────
function cleanup(folder) {
  const entries = readdirSync(folder)
  const hasResult = entries.some(n => { try { return statSync(join(folder, n)).isFile() && RESULT.test(n) } catch { return false } })
  if (!hasResult) { console.warn('  (aviso) nenhum resultado final — pulei a limpeza'); return }

  const targets = []
  const processDir = join(folder, 'process')
  if (existsSync(processDir)) targets.push('process')
  for (const n of entries) {
    try { if (statSync(join(folder, n)).isFile() && INTERMEDIATE.test(n)) targets.push(n) } catch { /* ignore */ }
  }
  if (targets.length === 0) { console.log('  já estava limpo'); return }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const trash = join(folder, '_astrolog_trash', ts)
  mkdirSync(trash, { recursive: true })
  for (const t of targets) moveFile(join(folder, t), join(trash, t))
  console.log(`  movidos ${targets.length} item(s) de intermediários para ${trash}`)
}

// ── Arquivamento ─────────────────────────────────────────────────────────────────
// Move os keepers (resultados, e masters se configurado) para o SSD (canônico) e
// copia para a pasta do Drive sincronizado (backup). Retorna o manifesto p/ o app.
function archive(folder, target, cfg) {
  const manifest = []
  if (!cfg.ssdArchiveDir && !cfg.driveSyncDir) return manifest

  const keepers = readdirSync(folder).filter(n => {
    try { if (!statSync(join(folder, n)).isFile()) return false } catch { return false }
    return RESULT.test(n) || (cfg.archiveMasters && /^master_/i.test(n))
  })

  for (const name of keepers) {
    const src      = join(folder, name)
    const isMaster = /^master_/i.test(name)
    const isFinal  = /(sho|hoo|soo|final|result)/i.test(name)
    const fileType = isMaster ? (/flat/i.test(name) ? 'MASTER_FLAT' : 'MASTER_DARK')
                              : (/\.(tif|tiff)$/i.test(name) ? 'FINAL_TIFF' : 'STACK')

    // backup no Drive sincronizado (cópia)
    if (cfg.driveSyncDir) {
      const dDir = join(cfg.driveSyncDir, target); mkdirSync(dDir, { recursive: true })
      const dst = join(dDir, name); copyFileSync(src, dst)
      manifest.push({ label: `${name} (Drive)`, provider: 'LOCAL', storagePath: dst, fileType, isFinal })
      console.log(`  ↳ Drive: ${dst}`)
    }
    // arquivo canônico no SSD (move — libera o disco de trabalho)
    if (cfg.ssdArchiveDir) {
      const sDir = join(cfg.ssdArchiveDir, target); mkdirSync(sDir, { recursive: true })
      const dst = join(sDir, name); moveFile(src, dst)
      manifest.push({ label: name, provider: 'LOCAL', storagePath: dst, fileType, isFinal })
      console.log(`  ↳ SSD: ${dst}`)
    }
  }
  return manifest
}

// ── Organizar pasta de captura ──────────────────────────────────────────────────
function readFitsHeader(path) {
  const fd = openSync(path, 'r')
  const buf = Buffer.alloc(2880 * 6)
  readSync(fd, buf, 0, buf.length, 0)
  closeSync(fd)
  const txt = buf.toString('ascii')
  const get = (kw) => {
    const m = txt.match(new RegExp(kw.padEnd(8) + "=\\s*([^/\\n]+)"))
    return m ? m[1].replace(/'/g, '').trim() : undefined
  }
  return {
    imageType: get('IMAGETYP'),
    exposure:  parseFloat(get('EXPTIME') ?? get('EXPOSURE') ?? '') || undefined,
  }
}

function organize(captureDir, projectDir, cfg) {
  const files = readdirSync(captureDir).filter(n => /\.(fits?|fts)$/i.test(n))
  let moved = 0
  for (const name of files) {
    const src = join(captureDir, name)
    let h; try { h = readFitsHeader(src) } catch { continue }
    const t = (h.imageType || '').toLowerCase()
    let sub
    if (t.includes('light'))                      sub = 'lights'
    else if (t.includes('flat') && t.includes('dark')) sub = 'dflats'
    else if (t.includes('flat'))                  sub = 'flats'
    else if (t.includes('bias'))                  sub = 'biases'
    else if (t.includes('dark'))                  sub = (h.exposure != null && h.exposure <= cfg.dflatMaxSeconds) ? 'dflats' : 'darks'
    else continue
    const dDir = join(projectDir, sub); mkdirSync(dDir, { recursive: true })
    moveFile(src, join(dDir, name)); moved++
  }
  return moved
}

// ── Siril ─────────────────────────────────────────────────────────────────────
function runSiril(siril, scriptPath, cwd) {
  return new Promise((res) => {
    const child = spawn(siril, ['-s', scriptPath], { cwd })
    let log = ''
    child.stdout.on('data', d => { const s = d.toString(); process.stdout.write(s); log += s })
    child.stderr.on('data', d => { const s = d.toString(); process.stderr.write(s); log += s })
    child.on('error', e => res({ code: -1, log: log + '\n' + e.message }))
    child.on('close', code => res({ code, log }))
  })
}

function findResult(folder) {
  const files = readdirSync(folder)
    .filter(n => { try { return statSync(join(folder, n)).isFile() && RESULT.test(n) } catch { return false } })
    .map(n => ({ n, m: statSync(join(folder, n)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  return files[0]?.n
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  const cfg  = loadConfig()
  const args = parseArgs()

  // Modo organizar (não processa)
  if (args.organize) {
    const captureDir = resolve(args.organize)
    const projectDir = args.into ? resolve(args.into) : captureDir
    if (!existsSync(captureDir)) fail(`Pasta não encontrada: ${captureDir}`)
    const n = organize(captureDir, projectDir, cfg)
    console.log(`✓ Organizados ${n} arquivo(s) em ${projectDir} (lights/darks/flats/dflats/biases)`)
    return
  }

  if (!cfg.appUrl || !cfg.token) fail('Configure appUrl e token em siril-agent.config.json')
  const projectId = args.project; if (!projectId) fail('Falta --project <projectId>')
  const folder    = args.folder ? resolve(args.folder) : null; if (!folder) fail('Falta --folder <pasta>')
  const script    = args.script ? resolve(args.script) : null; if (!script) fail('Falta --script <arquivo.ssf>')
  if (!existsSync(folder)) fail(`Pasta não encontrada: ${folder}`)
  if (!existsSync(script)) fail(`Script não encontrado: ${script}`)

  const target = args.target || basename(folder)
  console.log(`▶ Processando ${projectId}\n  pasta: ${folder}\n  script: ${script}`)
  await report(cfg, { projectId, status: 'processing' })

  const { code, log } = await runSiril(cfg.siril, script, folder)
  if (code !== 0) {
    console.error(`\n✖ Siril terminou com código ${code}`)
    await report(cfg, { projectId, status: 'error', log: log.slice(-3500) })
    process.exit(1)
  }

  console.log('\n✓ Siril concluído. Limpando intermediários…')
  cleanup(folder)

  console.log('Arquivando resultados…')
  const manifest = archive(folder, target, cfg)

  if (manifest.length > 0) {
    await report(cfg, { projectId, status: 'done', files: manifest, log: log.slice(-3500) })
    console.log(`\n✓ Pronto. ${manifest.length} arquivo(s) arquivado(s) e registrado(s).`)
  } else {
    const result = findResult(folder)
    await report(cfg, {
      projectId, status: 'done',
      resultPath: result ? join(folder, result) : undefined,
      resultLabel: result ? `Resultado: ${result}` : undefined,
      log: log.slice(-3500),
    })
    console.log(`\n✓ Pronto.${result ? ' Resultado: ' + join(folder, result) : ''}`)
  }
}

main().catch(e => fail(e.message))
