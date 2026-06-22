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
  readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, renameSync,
  copyFileSync, unlinkSync, openSync, readSync, closeSync, rmdirSync,
} from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, basename, parse } from 'node:path'

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
    if (a[i].startsWith('--')) {
      const key = a[i].slice(2)
      const next = a[i + 1]
      if (next && !next.startsWith('--')) { args[key] = next; i++ }
      else { args[key] = true }   // flag sem valor (ex.: --archive)
    }
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

// O volume do destino está montado/acessível? (ex.: E:\ conectado)
function destAvailable(dir) {
  try { return existsSync(parse(dir).root || dir) } catch { return false }
}

// ── Arquivamento (opcional e à prova de falha) ────────────────────────────────────
// Cada destino é opcional: se não estiver no config, é pulado. Se estiver no config
// mas o disco/pasta não estiver acessível (SSD desconectado, Drive sem sync), avisa
// e pula — NUNCA apaga a única cópia nem trava. Retorna o manifesto p/ o app.
function archive(folder, target, cfg) {
  const manifest = []
  const ssdOk   = !!cfg.ssdArchiveDir && destAvailable(cfg.ssdArchiveDir)
  const driveOk = !!cfg.driveSyncDir  && destAvailable(cfg.driveSyncDir)

  if (cfg.ssdArchiveDir && !ssdOk)
    console.warn(`  (aviso) SSD indisponível (${cfg.ssdArchiveDir}) — pulei. Resultados seguem na pasta de trabalho.`)
  if (cfg.driveSyncDir && !driveOk)
    console.warn(`  (aviso) pasta do Drive indisponível (${cfg.driveSyncDir}) — pulei.`)
  if (!ssdOk && !driveOk) return manifest

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

    // Backup no Drive sincronizado primeiro (cópia) — se falhar, o original fica intacto
    if (driveOk) {
      try {
        const dDir = join(cfg.driveSyncDir, target); mkdirSync(dDir, { recursive: true })
        const dst = join(dDir, name); copyFileSync(src, dst)
        manifest.push({ label: `${name} (Drive)`, provider: 'LOCAL', storagePath: dst, fileType, isFinal })
        console.log(`  ↳ Drive: ${dst}`)
      } catch (e) { console.warn(`  (aviso) falha ao copiar ${name} p/ o Drive: ${e.message}`) }
    }
    // Arquivo canônico no SSD (move — libera o disco de trabalho). Se falhar, fica na pasta.
    if (ssdOk) {
      try {
        const sDir = join(cfg.ssdArchiveDir, target); mkdirSync(sDir, { recursive: true })
        const dst = join(sDir, name); moveFile(src, dst)
        manifest.push({ label: name, provider: 'LOCAL', storagePath: dst, fileType, isFinal })
        console.log(`  ↳ SSD: ${dst}`)
      } catch (e) { console.warn(`  (aviso) falha ao mover ${name} p/ o SSD: ${e.message}`) }
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
    filter:    get('FILTER'),
  }
}

// Coleta FITS recursivamente (pega arquivos dentro de LIGHT/ FLAT/ DARKFLAT/ do N.I.N.A.),
// pulando as pastas de destino já organizadas e a lixeira/process.
function walkFits(dir, acc) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    let st; try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) {
      if (/^(lights|darks|flats|dflats|biases|_astrolog_trash|process)$/i.test(n)) continue
      walkFits(p, acc)
    } else if (/\.(fits?|fts)$/i.test(n)) acc.push(p)
  }
}

// Remove pastas vazias (bottom-up), nunca a própria raiz.
function removeEmptyDirs(dir) {
  let entries; try { entries = readdirSync(dir) } catch { return }
  for (const n of entries) {
    const p = join(dir, n)
    let st; try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) {
      removeEmptyDirs(p)
      try { if (readdirSync(p).length === 0) rmdirSync(p) } catch { /* não vazia / em uso */ }
    }
  }
}

function organize(captureDir, projectDir, cfg) {
  const files = []
  walkFits(captureDir, files)
  let moved = 0
  for (const src of files) {
    let h; try { h = readFitsHeader(src) } catch { continue }
    const t = (h.imageType || '').toLowerCase()
    let sub
    if (t.includes('light'))                      sub = 'lights'
    else if (t.includes('flat') && t.includes('dark')) sub = 'dflats'
    else if (t.includes('flat'))                  sub = 'flats'
    else if (t.includes('bias'))                  sub = 'biases'
    // N.I.N.A. grava dark flats como DARK também → separa pelo tempo de exposição
    else if (t.includes('dark'))                  sub = (h.exposure != null && h.exposure <= cfg.dflatMaxSeconds) ? 'dflats' : 'darks'
    else continue
    const dDir = join(projectDir, sub); mkdirSync(dDir, { recursive: true })
    moveFile(src, join(dDir, basename(src))); moved++
  }
  // Apaga as pastas de origem que ficaram vazias (LIGHT/ FLAT/ DARK/ do N.I.N.A.)
  removeEmptyDirs(captureDir)
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

// ── Geração dinâmica do script (noite única ou multi-noite, lendo os headers) ─────
const REJ = 'rej 3 3'

function hasFits(dir) {
  try { return !!dir && existsSync(dir) && readdirSync(dir).some(n => /\.(fits?|fts)$/i.test(n)) } catch { return false }
}
function findSub(dir, names) { for (const c of names) { const p = join(dir, c); if (hasFits(p)) return p } return null }

function readFilterOf(lightsDir) {
  const f = readdirSync(lightsDir).filter(n => /\.(fits?|fts)$/i.test(n))[0]
  if (!f) return undefined
  try { return readFitsHeader(join(lightsDir, f)).filter } catch { return undefined }
}

// Classifica o filtro de uma noite: usa cfg.filterMap (nome → grupo) e, na falta, heurística.
function classifyFilter(name, cfg) {
  if (!name) return 'broadband'
  const map = cfg.filterMap || {}
  for (const k of Object.keys(map)) if (String(name).toLowerCase() === k.toLowerCase()) return map[k]
  const n = String(name).toLowerCase()
  if (/sii|s2/.test(n)) return 'SIIOIII'
  if (/ha|extreme|ultimate|duo|enhance|nbz|alp-?t|l-?en/.test(n)) return 'HaOIII'
  return 'broadband'
}

// Noite única (a pasta tem lights/) → null. Senão, lista as subpastas que têm lights/.
function detectNights(target) {
  if (findSub(target, ['lights', 'LIGHT', 'Light'])) return null
  const nights = []
  for (const n of readdirSync(target)) {
    const p = join(target, n); let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory() && findSub(p, ['lights', 'LIGHT', 'Light'])) nights.push(p)
  }
  return nights.length ? nights : null
}

function genScript(target, nightDirs, cfg) {
  const proc = join(target, 'process')
  const slug = basename(target).replace(/[^\w.-]+/g, '_') || 'resultado'
  const q = p => `"${String(p).replace(/\\/g, '/')}"`
  const L = ['requires 1.2.0', '', `# Gerado pelo agente AstroLog — ${nightDirs.length} noite(s)`, '']

  const sharedDarks  = findSub(target, ['darks'])
  const sharedDflats = findSub(target, ['dflats'])
  const sharedFlats  = findSub(target, ['flats'])
  const sharedBias   = findSub(target, ['biases'])

  let biasMaster = null
  if (sharedBias) {
    biasMaster = join(proc, 'master_bias')
    L.push('# Master Bias (geral)', `cd ${q(sharedBias)}`, `convert bs -out=${q(proc)}`, `cd ${q(proc)}`,
      `stack bs ${REJ} -nonorm -out=${q(biasMaster)}`, '')
  }

  // memo p/ não reconstruir masters compartilhados a cada noite
  const darkMemo = {}, dflatMemo = {}
  function masterDark(dir) {
    if (!dir) return null
    if (darkMemo[dir]) return darkMemo[dir]
    const out = join(proc, `master_dark_${Object.keys(darkMemo).length + 1}`)
    L.push(`# Master Dark: ${dir}`, `cd ${q(dir)}`, `convert dk -out=${q(proc)}`, `cd ${q(proc)}`,
      `stack dk ${REJ} -nonorm -out=${q(out)}`, '')
    darkMemo[dir] = out; return out
  }
  function masterDflat(dir) {
    if (!dir) return null
    if (dflatMemo[dir]) return dflatMemo[dir]
    const out = join(proc, `master_dflat_${Object.keys(dflatMemo).length + 1}`)
    L.push(`# Master Dark Flat: ${dir}`, `cd ${q(dir)}`, `convert dkf -out=${q(proc)}`, `cd ${q(proc)}`,
      `stack dkf ${REJ} -nonorm -out=${q(out)}`, '')
    dflatMemo[dir] = out; return out
  }

  const ha = [], sii = [], oiii = [], color = []

  nightDirs.forEach((nd, idx) => {
    const i = idx + 1
    const lightsDir = findSub(nd, ['lights', 'LIGHT', 'Light']); if (!lightsDir) return
    const flatsDir  = findSub(nd, ['flats', 'FLAT', 'Flat'])   || sharedFlats
    const dflatsDir = findSub(nd, ['dflats', 'DARKFLAT'])      || sharedDflats
    const darksDir  = findSub(nd, ['darks', 'DARK', 'Dark'])   || sharedDarks
    const group     = classifyFilter(readFilterOf(lightsDir), cfg)

    L.push(`# ===== Noite ${i}: ${basename(nd)} — ${group} =====`)

    // Master flat DESTA noite (calibrado pelo dflat da noite/geral, ou bias)
    let flatMaster = null
    if (flatsDir) {
      flatMaster = join(proc, `master_flat_n${i}`)
      const dfm = masterDflat(dflatsDir)
      L.push(`cd ${q(flatsDir)}`, `convert f${i} -out=${q(proc)}`, `cd ${q(proc)}`)
      if (dfm)             L.push(`calibrate f${i} -dark=${q(dfm)}`,        `stack pp_f${i} ${REJ} -norm=mul -out=${q(flatMaster)}`)
      else if (biasMaster) L.push(`calibrate f${i} -bias=${q(biasMaster)}`, `stack pp_f${i} ${REJ} -norm=mul -out=${q(flatMaster)}`)
      else                 L.push(`stack f${i} ${REJ} -norm=mul -out=${q(flatMaster)}`)
    }
    const darkMaster = masterDark(darksDir)

    // Lights da noite
    L.push(`cd ${q(lightsDir)}`, `convert n${i} -out=${q(proc)}`, `cd ${q(proc)}`)
    const cal = [darkMaster ? `-dark=${q(darkMaster)} -cc=dark` : '', flatMaster ? `-flat=${q(flatMaster)}` : '',
      '-cfa', '-equalize_cfa', '-debayer'].filter(Boolean).join(' ')
    L.push(`calibrate n${i} ${cal}`)
    if (group === 'HaOIII' || group === 'SIIOIII') {
      L.push(`seqextract_HaOIII pp_n${i}`)
      if (group === 'HaOIII') { ha.push(`Ha_pp_n${i}`); oiii.push(`OIII_pp_n${i}`) }
      else                    { sii.push(`Ha_pp_n${i}`); oiii.push(`OIII_pp_n${i}`) } // vermelho do SII+OIII = SII
    } else {
      color.push(`pp_n${i}`)
    }
    L.push('')
  })

  // Empilha cada canal (merge se houver mais de uma noite)
  function channel(list, name) {
    if (!list.length) return false
    const outAbs = join(target, `${slug}_${name}_stacked`)
    let seq = list[0]
    if (list.length > 1) { L.push(`merge ${list.join(' ')} ${name}_all`); seq = `${name}_all` }
    L.push(`register ${seq}`, `stack r_${seq} ${REJ} -norm=addscale -output_norm -out=${q(outAbs)}`, '')
    return true
  }
  L.push('# ===== Empilhamento por canal =====', `cd ${q(proc)}`)
  const hasHa = channel(ha, 'Ha'), hasSii = channel(sii, 'SII'), hasOiii = channel(oiii, 'OIII')
  channel(color, 'color')

  // Composições rápidas (ponto de partida — afine no PixelMath)
  L.push(`cd ${q(target)}`)
  if (hasSii && hasHa && hasOiii) L.push(`rgbcomp ${slug}_SII_stacked ${slug}_Ha_stacked ${slug}_OIII_stacked -out=${q(join(target, slug + '_SHO'))}`)
  if (hasHa && hasOiii)           L.push(`rgbcomp ${slug}_Ha_stacked ${slug}_OIII_stacked ${slug}_OIII_stacked -out=${q(join(target, slug + '_HOO'))}`)
  if (hasSii && hasOiii)          L.push(`rgbcomp ${slug}_SII_stacked ${slug}_OIII_stacked ${slug}_OIII_stacked -out=${q(join(target, slug + '_SOO'))}`)
  L.push('', 'close', '')
  return L.join('\n')
}

// Organiza as pastas e gera o script conforme a estrutura encontrada.
function buildSmartScript(folder, cfg) {
  const nights = detectNights(folder)
  if (!nights) {
    organize(folder, folder, cfg)
    return { mode: 'noite única', script: genScript(folder, [folder], cfg) }
  }
  for (const nd of nights) organize(nd, nd, cfg)
  return { mode: `multi-noite (${nights.length})`, script: genScript(folder, nights, cfg) }
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  const cfg  = loadConfig()
  const args = parseArgs()

  // Modo organizar (não processa)
  if (args.organize) {
    if (typeof args.organize !== 'string') fail('Uso: --organize "<pasta de captura>" [--into "<pasta do projeto>"]')
    const captureDir = resolve(args.organize)
    const projectDir = typeof args.into === 'string' ? resolve(args.into) : captureDir
    if (!existsSync(captureDir)) fail(`Pasta não encontrada: ${captureDir}`)
    const n = organize(captureDir, projectDir, cfg)
    console.log(`✓ Organizados ${n} arquivo(s) em ${projectDir} (lights/darks/flats/dflats/biases)`)
    return
  }

  if (!cfg.appUrl || !cfg.token) fail('Configure appUrl e token em siril-agent.config.json')
  const projectId = args.project; if (!projectId || projectId === true) fail('Falta --project <projectId>')

  // --folder padrão = a pasta onde você está rodando o comando
  const folder = typeof args.folder === 'string' ? resolve(args.folder) : process.cwd()
  if (!existsSync(folder)) fail(`Pasta não encontrada: ${folder}`)
  const target = typeof args.target === 'string' ? args.target : basename(folder)

  // Modo arquivar-apenas (sem reprocessar): node ... --project <id> --archive
  if (args.archive) {
    console.log(`▶ Arquivando ${folder}`)
    const manifest = archive(folder, target, cfg)
    await report(cfg, { projectId, status: 'done', files: manifest.length ? manifest : undefined })
    console.log(manifest.length ? `\n✓ ${manifest.length} arquivo(s) arquivado(s) e registrado(s).` : '\n(nada arquivado — confira a config e a conexão dos discos)')
    return
  }

  // Script: --script explícito → um .ssf na pasta → senão GERA automaticamente
  let script = typeof args.script === 'string' ? resolve(args.script) : null
  if (!script) {
    const ssf = readdirSync(folder).filter(n => /\.ssf$/i.test(n) && n !== '_astrolog.ssf')
    if (ssf.length === 1) script = join(folder, ssf[0])
  }
  if (!script) {
    console.log('  nenhum .ssf informado — gerando automaticamente (lendo headers e pastas)…')
    const gen = buildSmartScript(folder, cfg)
    console.log(`  modo detectado: ${gen.mode}`)
    if (args['dry-run']) {
      console.log('\n----- SCRIPT GERADO (dry-run, nada foi processado) -----\n')
      console.log(gen.script)
      return
    }
    script = join(folder, '_astrolog.ssf')
    writeFileSync(script, gen.script)
    console.log(`  script salvo em ${script}`)
  }
  if (!existsSync(script)) fail(`Script não encontrado: ${script}`)

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
