# AstroLog — Melhorias em andamento

Documento de rastreamento para não perder contexto entre sessões de conversa.

---

## Stack de referência

Next.js 14 App Router · tRPC v11 · Prisma + Supabase PostgreSQL · NextAuth v4 ·
Tailwind CSS · TanStack Query · Zod · react-hook-form · lucide-react · date-fns

---

## Status geral

| Grupo | Item | Status |
|---|---|---|
| A | Setup padrão pré-selecionado | ✅ Feito |
| A | Sticky values (valores residuais) | ✅ Feito |
| A | Clonagem de sessão ("Continuar") | ✅ Feito |
| A | Auto-fill de clima ao criar sessão | ✅ Feito |
| A | Fase da lua automática | ✅ Feito |
| A | Leitura de header FITS/XISF (drag & drop) | ✅ Feito |
| A | Barra de progresso de integração por projeto | ✅ Feito |
| B | Dashboard visual (galeria, horas no ano) | ✅ Feito |
| C | Botão "usar localização atual" (Geolocation API) | ✅ Feito (settings + previsão) |
| C | Autocomplete de cidades (Nominatim) | ✅ Feito (settings + previsão) |
| C | Mapa interativo (react-leaflet) | ✅ Feito |
| C | Campos reativos (cidade ↔ coord ↔ mapa ↔ GPS) | ✅ Feito |

---

## O que foi feito (Grupo A — sessões)

### Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/server/routers/weather.ts` | +procedimento `getForDate`: busca clima histórico (Open-Meteo archive) ou previsão (forecast) para data/hora específica. Retorna `temperatureC`, `humidityPct`, `cloudCoverPct` |
| `src/components/sessions/session-form.tsx` | Reescrito com 4 novas features (ver abaixo) |
| `src/components/sessions/session-card.tsx` | +prop `onClone`, +botão ícone `Copy` que dispara a clonagem |
| `src/app/dashboard/projects/[id]/page.tsx` | +estado `cloningSession`, +`SessionForm` para clone, +`onClone` passado ao `SessionCard` |

### Detalhes do session-form

**Modo clone** — `SessionInitial.id` passou a ser opcional. Ausência de `id` = modo clone (cria, não edita). O form herda `setupId`, `filterUsed`, `gain`, `offset`, `binning`, `sensorTempC`, `exposureSeconds` da sessão-fonte e zera `observedAt` (hoje), `lightsCount`, condições atmosféricas, notas.

**Sticky values** — chave `astrolog_session_sticky` no `localStorage`. Salvos após cada create: `setupId`, `filterUsed`, `gain`, `offset`, `binning`, `sensorTempC`, `exposureSeconds`. Carregados na abertura de nova sessão. Setup sticky > setup padrão (o último usado tem prioridade).

**Setup padrão** — `setups?.find(s => s.isDefault)?.id` usado como fallback quando não há sticky. O campo `isDefault` já existia no schema/router. No dropdown o setup padrão aparece com `★`.

**Auto-fill de clima** — `useEffect` com debounce de 1200ms no campo `observedAt`. Chama `api.weather.getForDate` com lat/lon do perfil do usuário. Preenche campos atmosféricos **apenas se estiverem vazios**. Badge "Preenchido via Open-Meteo" aparece quando funciona. Não ativa em modo edit.

---

## Próximas implementações — sessão atual

### C2 — Autocomplete de cidades (Nominatim)

**Onde:** Página `src/app/dashboard/settings/page.tsx` — campos de latitude/longitude do perfil do usuário. Também será útil futuramente na aba de previsão.

**Abordagem:**
- Componente `CitySearch` com input + dropdown
- `useEffect` com debounce de 400ms chama `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=5`
- Sem API key, sem cartão de crédito (OpenStreetMap)
- Ao selecionar cidade: preenche `latitude` e `longitude` nos campos
- User-Agent obrigatório no header da requisição (regra da Nominatim)
- Manter os campos manuais de lat/lon funcionando em paralelo

**Campos a criar:** `CitySearch` em `src/components/ui/city-search.tsx`

---

### A7 — Barra de progresso de integração por projeto

**Onde:** `src/components/projects/project-card.tsx` e `src/app/dashboard/projects/[id]/page.tsx`

**Abordagem:**
- `ImagingProject` já tem `totalLights` e `totalIntegrationMinutes` (recalculados pelo sessions router em cada save/delete)
- No `ProjectCard` adicionar uma linha visual: `X h Y min` + barra proporcional ao total acumulado
- Na página de detalhe do projeto, mostrar progresso mais rico: horas por filtro (agrupar sessions por `filterUsed` e somar integração)
- Não há campo "meta de horas" no schema — o progresso é relativo (sem barra de %) ou pode ser exibido como número absoluto de forma proeminente

---

### B1 — Dashboard visual (galeria + horas no ano)

**Onde:** `src/app/dashboard/page.tsx`

**Abordagem:**
- Header do dashboard: cards de stats já existem (`totalLights`, etc.). Adicionar "Horas capturadas em 2025" calculado somando `totalIntegrationMinutes` de todos os projetos do usuário / 60
- Seção de projetos: transformar os cards em estilo galeria quando há imagem de capa (campo `ProjectFile` com `isFinal=true` e tipo `FINAL_JPEG`). Se não há imagem, usar placeholder com nome do alvo + ícone
- Filtros de status existentes mantidos
- Highlight visual para projetos `IN_PROGRESS` (borda aurora) vs `COMPLETED` (borda verde sutil)

---

## Pendentes para sessões futuras

### A5 — Fase da lua

**Abordagem sugerida:** cálculo puramente matemático (sem API) usando a fórmula de Julian Day Number. Criar `src/lib/moon.ts` com função `getMoonPhase(date: Date): { phase: number; label: string; emoji: string }`. Mostrar na sessão form e no session card.

### A6 — Leitura de header FITS/XISF

**Abordagem sugerida:**
- Para FITS: lib `fitsjs` (npm) ou parsing manual do header ASCII (bloco de 2880 bytes)
- Para XISF: XML header no início do arquivo
- Componente de drop zone em cima do session-form: ao soltar arquivo, extrai `EXPTIME`, `GAIN`, `XBINNING`, `CCD-TEMP`, `FILTER` do header e chama `setValue()` nos campos correspondentes
- Tudo client-side, zero upload

### C1 — Geolocation API

**Simples:** botão "Usar localização atual" na página de settings (e futuramente no mapa). `navigator.geolocation.getCurrentPosition()` → preenche lat/lon + move mapa.

### C3 + C4 — Mapa interativo + campos reativos

**Deps a instalar:** `react-leaflet`, `leaflet`, `@types/leaflet`
**Onde:** componente `LocationPicker` usado na página de settings e na aba de previsão
**Comportamento reativo:**
- Digita cidade → autocomplete → seleciona → preenche coordenada + move mapa
- Clica no mapa → preenche coordenada + atualiza inputs
- Cola coordenada manual → move mapa
- Clica "GPS" → preenche tudo

---

## Regras do projeto (não esquecer)

- Todo novo diretório/arquivo vai dentro de `astroLog/` — nunca como irmão da pasta
- Sempre verificar ownership em mutations tRPC (`userId: ctx.session.user.id`)
- Sessions recalculam `totalLights` + `totalIntegrationMinutes` do projeto em todo save/delete
- Localização padrão fallback: `-27.6, -48.5` (costa catarinense)
