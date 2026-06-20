#!/usr/bin/env node
// AstroLog — Agente local do Siril
// Roda o siril-cli num projeto, limpa os intermediários com segurança e
// reporta o status de volta para o AstroLog. Zero dependências (Node 18+).
//
// Configuração: crie um arquivo "siril-agent.config.json" ao lado deste script:
//   {
//     "appUrl": "https://seu-app.vercel.app",
//     "token":  "cole-o-token-gerado-em-Configuracoes",
//     "siril":  "C:/Program Files/Siril/bin/siril-cli.exe"
//   }
//
// Uso:
//   node siril-agent.mjs --project <projectId> --folder "D:/Astro/NGC3372" --script "D:/Astro/NGC3372/NGC3372.ssf"
//
// O <projectId> aparece na URL do projeto no AstroLog (/dashboard/projects/<id>).

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, renameSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────
function loadConfig() {
  const file = join(HERE, 'siril-agent.config.json')
  let cfg = {}
  if (existsSync(file)) {
    try { cfg = JSON.parse(readFileSync(file, 'utf8')) } catch { fail('siril-agent.config.json inválido') }
  }
  return {
    appUrl: process.env.ASTROLOG_URL   || cfg.appUrl,
    token:  process.env.ASTROLOG_TOKEN || cfg.token,
    siril:  process.env.SIRIL_CLI      || cfg.siril || 'siril-cli',
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
// Nunca toca em lights/darks/flats/biases, masters (master_*) nem nos resultados.
// Move a pasta process/ e intermediários soltos para _astrolog_trash/.
const INTERMEDIATE = /^(pp_|r_|bkg_|conv|light_|Ha_pp|OIII_pp).*\.(fit|fits|fts|seq)$/i
const RESULT       = /(stacked|result|final|starless|starmask|stars)/i

function cleanup(folder) {
  const entries = readdirSync(folder)
  const hasResult = entries.some(n => statSync(join(folder, n)).isFile() && RESULT.test(n))
  if (!hasResult) { console.warn('  (aviso) nenhum resultado final encontrado — pulei a limpeza'); return }

  const targets = []
  const processDir = join(folder, 'process')
  if (existsSync(processDir)) targets.push('process')
  for (const n of entries) {
    const p = join(folder, n)
    if (statSync(p).isFile() && INTERMEDIATE.test(n)) targets.push(n)
  }
  if (targets.length === 0) { console.log('  já estava limpo'); return }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const trash = join(folder, '_astrolog_trash', ts)
  mkdirSync(trash, { recursive: true })
  for (const t of targets) renameSync(join(folder, t), join(trash, t))
  console.log(`  movidos ${targets.length} item(s) para ${trash}`)
}

function findResult(folder) {
  const files = readdirSync(folder)
    .filter(n => { try { return statSync(join(folder, n)).isFile() && RESULT.test(n) } catch { return false } })
    .map(n => ({ n, m: statSync(join(folder, n)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  return files[0]?.n
}

// ── Run ─────────────────────────────────────────────────────────────────────────
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

async function main() {
  const cfg  = loadConfig()
  const args = parseArgs()

  if (!cfg.appUrl || !cfg.token) fail('Configure appUrl e token em siril-agent.config.json')
  const projectId = args.project; if (!projectId) fail('Falta --project <projectId>')
  const folder    = args.folder ? resolve(args.folder) : null; if (!folder) fail('Falta --folder <pasta>')
  const script    = args.script ? resolve(args.script) : null; if (!script) fail('Falta --script <arquivo.ssf>')
  if (!existsSync(folder)) fail(`Pasta não encontrada: ${folder}`)
  if (!existsSync(script)) fail(`Script não encontrado: ${script}`)

  console.log(`▶ Processando projeto ${projectId}`)
  console.log(`  pasta:  ${folder}`)
  console.log(`  script: ${script}`)
  await report(cfg, { projectId, status: 'processing' })

  const { code, log } = await runSiril(cfg.siril, script, folder)

  if (code !== 0) {
    console.error(`\n✖ Siril terminou com código ${code}`)
    await report(cfg, { projectId, status: 'error', log: log.slice(-3500) })
    process.exit(1)
  }

  console.log('\n✓ Siril concluído. Limpando intermediários…')
  cleanup(folder)

  const result = findResult(folder)
  const resultPath = result ? join(folder, result) : undefined
  await report(cfg, {
    projectId,
    status:      'done',
    resultPath,
    resultLabel: result ? `Resultado: ${result}` : undefined,
    log:         log.slice(-3500),
  })
  console.log(`\n✓ Pronto.${resultPath ? ' Resultado: ' + resultPath : ''}`)
}

main().catch(e => fail(e.message))
