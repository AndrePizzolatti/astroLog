# AstroLog × N.I.N.A. — Projeto de Integração

Documento de design para implementação futura.  
Stack de referência: Next.js 14 App Router · tRPC v11 · Prisma + Supabase PostgreSQL · NextAuth v4.

---

## Visão geral

Duas features independentes que juntas eliminam a entrada manual de dados durante e após uma noite de captura:

| ID   | Feature                              | Esforço estimado |
|------|--------------------------------------|------------------|
| N1   | Import de sequência N.I.N.A. (`.json`) | Médio (~1 sessão) |
| N2   | Watcher em tempo real (FITS → webhook) | Médio-alto (~2 sessões) |

---

## N1 — Import de sequência N.I.N.A.

### Problema

O N.I.N.A. Advanced Sequencer salva planos de captura em arquivos `.json`. Um plano típico
contém um ou mais alvos, cada um com instruções de exposição por filtro (quantidade +
duração). Hoje o usuário precisa criar o projeto manualmente no AstroLog depois de já ter
planejado no N.I.N.A.

### Comportamento esperado

1. Usuário arrasta (ou clica para abrir) o arquivo `.json` da sequência na tela de projetos.
2. O app lê o arquivo **client-side** (zero upload para servidor externo).
3. É exibida uma prévia: nome do alvo, coordenadas, filtros planejados e totais de exposição.
4. Usuário confirma → o app cria o `ImagingProject` via tRPC com os dados extraídos.

### Estrutura do JSON do N.I.N.A. Advanced Sequencer

O N.I.N.A. salva versões serializadas do sequenciador. Os campos relevantes estão aninhados
em `$type` e `Items`. A estrutura varia por versão mas o padrão desde a v2 é:

```jsonc
{
  "Items": [
    {
      "$type": "NINA.Sequencer.Container.SequenceRootContainer, ...",
      "Items": [
        {
          "$type": "NINA.Sequencer.Container.TargetAreaContainer, ...",
          "Items": [
            {
              "$type": "NINA.Sequencer.Container.DeepSkyObjectContainer, ...",
              "Target": {
                "TargetName": "M 42",
                "Coordinates": {
                  "RA": 5.5884,   // horas decimais
                  "Dec": -5.3911  // graus decimais
                }
              },
              "Items": [
                {
                  "$type": "NINA.Sequencer.SequenceItem.Imaging.TakeExposure, ...",
                  "ExposureTime": 300,
                  "TotalExposureCount": 60,
                  "Filter": { "Name": "Ha" },
                  "Gain": 100,
                  "Offset": 10,
                  "Binning": { "X": 1, "Y": 1 }
                }
                // ... outros filtros
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

> **Atenção:** O campo `$type` é diferente por versão do N.I.N.A. O parser deve ser
> defensivo, percorrendo a árvore recursivamente em vez de depender de caminhos fixos.

### Parser sugerido — `src/lib/nina-sequence-parser.ts`

```ts
export interface NINATarget {
  name:        string
  ra?:         number   // horas decimais
  dec?:        number   // graus decimais
  exposures:   NINAExposure[]
}

export interface NINAExposure {
  filter?:          string
  exposureSeconds:  number
  count:            number
  gain?:            number
  offset?:          number
  binning?:         string  // "1×1"
}

export function parseNINASequence(json: unknown): NINATarget[]
```

A função percorre `Items` recursivamente procurando nós cujo `$type` contém
`"DeepSkyObjectContainer"`. Dentro deles, procura nós com `"TakeExposure"` ou
`"TakeManyExposures"`.

### Campos mapeados para o schema do app

| Campo N.I.N.A.           | Campo AstroLog                        |
|--------------------------|---------------------------------------|
| `Target.TargetName`      | `ImagingProject.targetName`           |
| `Target.Coordinates.RA`  | `ImagingProject.targetRA` (futuro)    |
| `Target.Coordinates.Dec` | `ImagingProject.targetDec` (futuro)   |
| `Filter.Name`            | `ImagingSession.filterUsed`           |
| `ExposureTime`           | `ImagingSession.exposureSeconds`      |
| `TotalExposureCount`     | `ImagingSession.lightsCount` (planejado) |
| `Gain`                   | `ImagingSession.gain`                 |
| `Binning.X`              | `ImagingSession.binning` → "1×1"      |

> **Decisão de design:** Cada `TakeExposure` com filtro diferente vira uma `ImagingSession`
> separada dentro do mesmo projeto — reflete como o usuário realmente captura (uma sessão
> por filtro por noite).

### UI necessária

- Componente `NINASequenceDrop` em `src/components/projects/nina-sequence-drop.tsx`
  (análogo ao `FITSDropZone` para sessões).
- Modal de confirmação mostrando a prévia antes de criar.
- Novo botão "Importar sequência N.I.N.A." na página de projetos
  (`src/app/dashboard/projects/page.tsx`).

### Schema changes

Se quisermos guardar RA/Dec no projeto (útil para futuro planejamento):

```prisma
model ImagingProject {
  // campos existentes ...
  targetRA   Float?
  targetDec  Float?
}
```

Migration necessária (não breaking — campos opcionais).

---

## N2 — Watcher em tempo real (FITS → webhook)

### Problema

Durante uma noite de captura, o N.I.N.A. salva um FITS a cada exposição concluída.
O usuário precisa esperar a noite acabar para registrar os dados no AstroLog.
Com um watcher, o dashboard mostraria o contador de lights e a integração total
crescendo em tempo real, sem nenhuma interação.

### Arquitetura

```
[ PC do observatório ]              [ AstroLog ]
  N.I.N.A. → salva FITS
       ↓
  watcher script
  (Node/Python)
       ↓ POST /api/webhooks/nina
       → { token, projectId, filter,
           exposureSeconds, gain,
           sensorTempC, observedAt }
                                    → valida token
                                    → busca sessão do dia OU cria nova
                                    → incrementa lightsCount
                                    → recalcula integração do projeto
                                    → dashboard atualiza (polling ou SSE)
```

### N2.1 — Endpoint webhook no AstroLog

**Arquivo:** `src/app/api/webhooks/nina/route.ts`

```ts
// POST — não usa tRPC (precisa aceitar chamada externa sem cookie de sessão)
// Auth: Bearer token gerado pelo usuário nas configurações

export async function POST(req: Request) {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '')

  // 1. Valida token contra tabela WebhookToken no banco
  const record = await db.webhookToken.findUnique({ where: { token } })
  if (!record) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse do body
  const body = WebhookPayloadSchema.parse(await req.json())

  // 3. Busca ou cria sessão de hoje para o projeto
  const today = startOfDay(new Date())
  let session = await db.imagingSession.findFirst({
    where: { projectId: body.projectId, observedAt: { gte: today } },
    orderBy: { observedAt: 'desc' },
  })

  if (!session) {
    session = await db.imagingSession.create({ data: { ...body, lightsCount: 1 } })
  } else {
    session = await db.imagingSession.update({
      where: { id: session.id },
      data: { lightsCount: { increment: 1 } },
    })
  }

  // 4. Recalcula totalIntegrationMinutes no projeto (lógica existente)
  await recalcProject(body.projectId)

  return Response.json({ ok: true, lightsCount: session.lightsCount })
}
```

**Schema Zod do payload:**

```ts
const WebhookPayloadSchema = z.object({
  projectId:       z.string().cuid(),
  filter:          z.string().optional(),
  exposureSeconds: z.number().positive(),
  gain:            z.number().int().optional(),
  sensorTempC:     z.number().optional(),
  observedAt:      z.string().datetime().optional(),  // se omitido, usa now()
})
```

### N2.2 — Tabela de tokens no banco

```prisma
model WebhookToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  label     String   // "PC do observatório"
  token     String   @unique @default(cuid())
  createdAt DateTime @default(now())
  lastUsedAt DateTime?
}
```

UI de gestão em `src/app/dashboard/settings/page.tsx` — seção "Tokens de API":
- Gerar novo token (exibe uma única vez, como o GitHub faz)
- Listar tokens existentes com label + data de último uso
- Revogar

### N2.3 — Watcher script (opção Node.js)

**Arquivo a distribuir:** `nina-watcher/watcher.mjs`

```js
import chokidar from 'chokidar'
import { readFileSync } from 'fs'

const CONFIG = {
  watchDir:  'C:/Users/Astro/Pictures/N.I.N.A',  // ajustar
  astrologUrl: 'https://seu-app.vercel.app/api/webhooks/nina',
  token:     'SEU_TOKEN_AQUI',
  projectId: 'SEU_PROJECT_ID_AQUI',
  // opcional: sobrescrever por arquivo de config .json
}

// Lê extensão → só reage a arquivos FITS novos
chokidar.watch(CONFIG.watchDir, {
  ignored:    /^(?!.*\.(fits|fit|fts)$)/i,
  persistent: true,
  ignoreInitial: true,   // não dispara para arquivos já existentes
  awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
}).on('add', async (filePath) => {
  try {
    // Extrai metadados do header FITS (primeiros 2880 bytes)
    const buf    = readFileSync(filePath)
    const header = buf.slice(0, 2880).toString('ascii')
    const get    = (kw) => {
      const match = header.match(new RegExp(`${kw}\\s*=\\s*([^/\\n]{1,70})`))
      return match ? match[1].trim().replace(/'/g, '').trim() : undefined
    }

    const payload = {
      projectId:       CONFIG.projectId,
      exposureSeconds: parseFloat(get('EXPTIME') ?? get('EXPOSURE') ?? '0') || undefined,
      gain:            parseInt(get('GAIN') ?? '')   || undefined,
      sensorTempC:     parseFloat(get('CCD-TEMP') ?? '') || undefined,
      filter:          get('FILTER'),
      observedAt:      get('DATE-OBS') ? new Date(get('DATE-OBS')).toISOString() : undefined,
    }

    if (!payload.exposureSeconds) {
      console.warn('[watcher] Ignorando frame sem EXPTIME:', filePath)
      return
    }

    const res = await fetch(CONFIG.astrologUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.token}` },
      body:    JSON.stringify(payload),
    })

    const data = await res.json()
    if (res.ok) {
      console.log(`[watcher] ✓ Light #${data.lightsCount} registrado — ${payload.filter ?? 'sem filtro'} ${payload.exposureSeconds}s`)
    } else {
      console.error('[watcher] Erro da API:', data)
    }
  } catch (err) {
    console.error('[watcher] Falha ao processar frame:', err.message)
  }
})

console.log('[watcher] Monitorando', CONFIG.watchDir)
```

**`package.json` mínimo:**

```json
{
  "type": "module",
  "dependencies": { "chokidar": "^3.6.0" }
}
```

**Executar:** `node watcher.mjs`  
**Executar como serviço Windows:** usar `pm2` ou criar uma task no Task Scheduler do Windows apontando para `node watcher.mjs`.

### N2.4 — Watcher script (opção Python)

Para quem prefere Python (já instalado em muitos setups de astrofotografia):

```python
# nina_watcher.py
import time, struct, requests
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

CONFIG = {
    "watch_dir":    r"C:\Users\Astro\Pictures\N.I.N.A",
    "astrolog_url": "https://seu-app.vercel.app/api/webhooks/nina",
    "token":        "SEU_TOKEN_AQUI",
    "project_id":   "SEU_PROJECT_ID_AQUI",
}

def parse_fits_header(path):
    fields = {}
    with open(path, "rb") as f:
        block = f.read(2880).decode("ascii", errors="replace")
    for i in range(36):
        rec = block[i*80:(i+1)*80]
        kw  = rec[:8].rstrip()
        if kw == "END": break
        if rec[8] != "=": continue
        raw = rec[10:].split("/")[0].strip().strip("'").strip()
        fields[kw] = raw
    return fields

class FITSHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory: return
        p = Path(event.src_path)
        if p.suffix.lower() not in (".fits", ".fit", ".fts"): return
        time.sleep(2)  # aguarda escrita terminar
        try:
            h = parse_fits_header(p)
            payload = {
                "projectId":       CONFIG["project_id"],
                "exposureSeconds": float(h.get("EXPTIME") or h.get("EXPOSURE") or 0) or None,
                "gain":            int(h["GAIN"])    if "GAIN"    in h else None,
                "sensorTempC":     float(h["CCD-TEMP"]) if "CCD-TEMP" in h else None,
                "filter":          h.get("FILTER"),
            }
            if not payload["exposureSeconds"]:
                print(f"[watcher] Sem EXPTIME em {p.name}, ignorando")
                return
            payload = {k: v for k, v in payload.items() if v is not None}
            r = requests.post(
                CONFIG["astrolog_url"],
                json=payload,
                headers={"Authorization": f"Bearer {CONFIG['token']}"},
                timeout=10,
            )
            data = r.json()
            print(f"[watcher] Light #{data.get('lightsCount')} — {payload.get('filter','?')} {payload['exposureSeconds']}s")
        except Exception as e:
            print(f"[watcher] Erro: {e}")

if __name__ == "__main__":
    observer = Observer()
    observer.schedule(FITSHandler(), CONFIG["watch_dir"], recursive=True)
    observer.start()
    print(f"[watcher] Monitorando {CONFIG['watch_dir']}")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
```

**Instalar:** `pip install watchdog requests`  
**Executar:** `python nina_watcher.py`

### N2.5 — Dashboard em tempo real

O dashboard já usa TanStack Query. A forma mais simples de atualizar sem WebSocket é
**polling automático durante uma sessão ativa**:

```ts
// src/app/dashboard/projects/[id]/page.tsx
const { data: project } = api.projects.byId.useQuery(
  { id },
  {
    // Aumenta polling para 15s quando há captura ativa (detectada por updatedAt recente)
    refetchInterval: isCapturing ? 15_000 : false,
  }
)
```

`isCapturing` pode ser derivado de um campo `captureMode: Boolean` no projeto (ativado
pelo usuário antes de começar a noite) ou simplesmente verificando se o projeto foi
atualizado nos últimos 30 minutos.

Para uma solução mais sofisticada no futuro: **Server-Sent Events** via uma route handler
`/api/projects/[id]/stream` usando `ReadableStream` — zero dependências além do Next.js.

---

## Ordem de implementação sugerida

```
N1 (sequência JSON)  →  N2.2 (tokens no banco)  →  N2.1 (endpoint webhook)
→  N2.3/N2.4 (watcher)  →  N2.5 (polling/SSE no dashboard)
```

N1 é completamente independente e de menor risco. N2 tem uma dependência sequencial
natural (precisa do token antes do endpoint, do endpoint antes do watcher).

---

## Riscos e decisões em aberto

| Tema | Decisão pendente |
|------|-----------------|
| Schema N.I.N.A. | O formato `.json` pode mudar entre versões. Parser deve ser defensivo com `try/catch` em cada campo e log de campos não reconhecidos. |
| Multi-sessão por noite | O webhook cria/encontra sessão pelo dia. Se o usuário capturar dois alvos na mesma noite, precisará de um campo `filter` no payload para separar sessões — ou um campo `sessionId` explícito configurado no watcher. |
| Segurança do token | O token trafega em plain text no header HTTP. Obrigatório usar HTTPS (Vercel já garante). Considerar expiração e rotação automática. |
| RA/Dec no schema | Campos opcionais — a migration é não-breaking. Mas precisam ser adicionados antes de implementar N1. |
| Polling vs SSE | Polling a cada 15s é suficiente para o caso de uso (uma exposição raramente dura menos que isso). SSE pode ser implementado depois se a demanda surgir. |
