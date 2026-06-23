# AstroLog — Roadmap / pendências

Anotações do que ficou de fora ou pra evoluir, pra não esquecer.

## Ordem sugerida de implementação

A ideia: introduzir uma **efeméride** cedo (ex.: `astronomy-engine`, MIT, offline) porque ela
destrava planejador, calendário, visibilidade de planetas e alertas calculados de uma vez.

1. [x] **Efeméride + Planejador de sessão** — FEITO. `astronomy-engine` em `src/lib/sky.ts`;
   `/dashboard/planner` com curva de altitude, trânsito, horas visíveis, Lua (iluminação/separação),
   ranking dos projetos e **catálogo DSO offline + sugestões "bons alvos pra esta noite"** (ranqueia o
   catálogo pela altitude/horas/distância da Lua) e **enquadramento** (FOV do setup desenhado sobre o
   alvo em escala, com veredito cabe/mosaico).
2. [x] **Calendário astronômico** — FEITO. `/dashboard/calendar`: grade do mês (fase da Lua +
   eventos), painel do dia (eventos + visibilidade dos planetas com janela de/até e altitude máx),
   lista de eventos do mês. `planetVisibility` em `sky.ts`.
3. [x] **Alertas calculados + APOD** — FEITO. Eclipses e oposições calculados via astronomy-engine
   (qualquer ano, sem tabela); card do APOD na página de alertas. (Falta: conjunções planeta-planeta,
   elongações de Mercúrio/Vênus, e visibilidade local de eclipse solar.)
4. [x] **Entrega de alertas (e-mail + cron)** — FEITO. Cron diário (`vercel.json` → `/api/cron/alerts`,
   12:00 UTC) monta um resumo por usuário dos eventos inscritos dentro da janela de antecedência
   (`advanceHours`), evita reenvio (`AlertNotification`) e envia via Resend. APOD opcional no resumo.
5. [x] **Suporte a planetária** — FEITO. `captureType` (DSO/Planetária) no projeto; sessão
   planetária com fps/exposição-ms/total de frames/% empilhado/ROI/software; form e card próprios.
6. **Polimento** — thumbnails por sessão / thumb próprio; score de céu v2 com Lua; catálogo DSO offline.
7. **Parte social** — páginas públicas + seguir (maior escopo, menor urgência pra uso pessoal).

---


## Alertas
- [x] Eclipses e oposições **calculados** (astronomy-engine) + **APOD** do dia na página.
- [x] **Elongações** de Mercúrio/Vênus (máxima elongação) — entram como evento.
- [x] **Conjunções** planeta-planeta — FEITO. Varredura diária da separação geocêntrica (GeoVector +
      AngleBetween) dos pares de planetas; mínimo local ≤3° vira evento `CONJUNCTION` com a separação.
- [x] **Visibilidade local** do eclipse solar — FEITO. Com a localização do usuário, usa
      `SearchLocalSolarEclipse` (% de cobertura daqui) em vez do eclipse global. `upcomingEvents` aceita
      `observer?`; alerts router e calendário passam lat/lon. (Digest de e-mail segue global — sem obs.)
- [x] **Entrega por e-mail + cron** — FEITO. `/api/cron/alerts` (Vercel Cron diário) → `processAlertDigests`
      compara eventos com as inscrições (e o `advanceHours`), deduplica em `AlertNotification` e envia um
      resumo por e-mail via Resend (`src/lib/email.ts`). APOD opcional no resumo se inscrito.
      Limitação do free tier do Resend: o remetente `onboarding@resend.dev` só entrega ao e-mail dono da
      conta — pra outros destinatários, verificar um domínio e trocar `EMAIL_FROM`.
- [ ] **ISS e cometas** — precisam de fonte externa (passes da ISS por localização via TLE/N2YO;
      cometas ativos via catálogo/efeméride). Conjunções já entraram (calculadas).
- [ ] **APOD** — feed da imagem astronômica do dia (NASA APOD API, `NASA_API_KEY` já no .env).
- [ ] Filtrar eclipses por **visibilidade na localização** do usuário (hoje só mostra a data + região geral).
- [ ] Manter a tabela curada de eclipses/oposições atualizada (`src/lib/astro-events.ts`).

## Planejador de sessão — FEITO (núcleo)
- [x] Curva de **altitude** na noite, **separação da Lua**, ranking, catálogo+sugestões, e **FOV do
      setup sobre o alvo** (diagrama em escala + veredito). Reusa `setups.list` (focal/pixel/sensor) e
      `sizeArcmin` do catálogo (casamento por nome pra projetos/custom).
- [ ] Evoluções: recomendação de **exposição/integração**; FOV com a **rotação** da câmera; reducer/barlow
      mudando a focal; eixo maior/menor do alvo (elipse, não círculo); cruzar com o **score de céu**.

## Calendário astronômico — FEITO
- [x] `/dashboard/calendar`: grade do mês (fase da Lua + eventos), painel do dia (eventos +
      visibilidade dos planetas, janela de/até e altitude máx) e lista de eventos do mês.
- [x] **Calendário × score de céu** — FEITO. A previsão (próx. ~7 noites) entra como barra de cor no
      rodapé das células (score DSO), as noites escuras (Lua < 25%) ganham destaque sutil, legenda e o
      score no painel do dia (com link pra Previsão). (Evolução: marcar a melhor janela de lua nova longa.)

## Imagem planetária — FEITO
- [x] `captureType` (DSO/Planetária); sessão planetária com software/formato/fps/exposição-ms/
      total de frames/% empilhado/ROI; form e card próprios; Siril e import de pasta ocultos.
- [x] **Import de metadados** — lê `.ser` (frames/ROI/data/instrumento) e log `.txt` do FireCapture
      (fps/exposição/gain/ROI) e preenche a sessão.
- [x] **Brilho máximo de Vênus** como evento (`SearchPeakMagnitude`).
- [x] **Gestão de arquivos planetários** — FEITO. Botão "Arquivos" no projeto planetário abre o
      `PlanetaryLab`, que gera um script PowerShell (`lib/planetary-files.ts`): inventaria os vídeos
      com tamanho, `-Clean` move intermediários (`_conv.ser/.avi`, `.tmp`) pra lixeira local,
      `-Archive` move os brutos pro SSD/externo (preserva, libera disco) e `-Publish` copia os finais
      pra pasta do Drive. Dry-run por padrão; NUNCA apaga brutos nem imagens finais. Guia keep/descartar
      e exemplos no modal. (Fluxo manual continua: AutoStakkert! → RegiStax/AstroSurface → WinJUPOS.)
- [ ] Evoluções: derotação (WinJUPOS), métricas agregadas planetárias no projeto, e seleção
      automática dos "melhores SERs" por qualidade (hoje a escolha de seeing é manual).

## Visual / portfólio
- [x] **Portfólio/galeria** — feito (`/dashboard/portfolio`), usa o thumbnail do Drive derivado do
      link da imagem final. LOCAL mostra placeholder.
- [x] **Thumbnail por sessão** — FEITO. `ImagingSession.thumbnailUrl` (link de imagem/Drive); campo
      "Resultado / capa" nos forms DSO e planetária; capa no topo do card via `imageThumbUrl` (reusa o
      thumbnail do Drive). Útil sobretudo na planetária (resultado é por sessão). **Migration
      `20260623120000_session_thumbnail` PENDENTE** (`npm run db:migrate:deploy`).
- [ ] Pendência: o thumbnail do Drive só carrega se o link estiver "qualquer pessoa com o link"
      (avisado na UI) — pra garantir, gerar/subir um thumb pequeno próprio (precisa de upload).

## Social (só modelos no schema)
- [ ] Página **pública** de projeto (usa o `Visibility` que já existe) + **seguir** observadores
      (modelos `Follow`/`ObservationLog` existem, sem router/UI). Diário de observação visual (EAA).

## Armazenamento / Drive
- [ ] **Upload real pro Drive** (escopo de escrita `drive.file`) pra não precisar pôr o arquivo
      no Drive manualmente — alternativa ao "Drive para Desktop".
- [ ] Opção de **escopo mais restrito** (`drive.file`) por privacidade.

## Agente do Siril
- [ ] Refinar o **mapa de filtros** (filterMap) e a detecção de filtro por noite (hoje lê 1 light/noite).
- [ ] Limpeza opcional dos **intermediários de pós-processamento** (PixInsight) — fora por variar muito.

## Diversos
- [x] Catálogo DSO **offline** embutido (`src/lib/dso-catalog.ts`, ~60 objetos com viés pro Sul) —
      alimenta o seletor do planejador e as sugestões; serve de fallback ao SIMBAD/Sésame.
- [x] **Score de céu v2 (DSO + Planetária + alta-res)** — FEITO. Dois scores por noite, com switch:
      **Céu profundo** = nuvem/vento/chuva + Lua (iluminação × fração da noite acima do horizonte,
      `astronomy-engine` + offset BRT); checkbox **"alta resolução"** liga um peso menor de seeing (~25)
      pra alvos de foco longo. **Planetária** = nuvem/vento/chuva + **seeing** (até 45) e **sem Lua**.
      Seeing = proxy por jet stream (250 hPa + 500 hPa do Open-Meteo). Validado (SC: jet 204 km/h →
      seeing ruim → planetária despenca vs DSO).
- [x] **Seeing via 7Timer!** — FEITO. `fetchSevenTimer` (paralelo ao Open-Meteo, timeout 6s) pega o
      índice de **seeing (1–8 → arcsec) + transparência** do 7Timer! ASTRO; a média por noite vira a
      penalidade de seeing (planetária e DSO alta-res), com o jet stream como **fallback** se o 7Timer
      cair. Cartão mostra "seeing X ~1,4″ (7Timer)" + transparência no tooltip. Validado (jet dava
      pessimista t=1; 7Timer deu ~1,4″ médio t=0,52). Segue sendo estimativa, não medição.
- [x] **Transparência no score DSO** — FEITO. A transparência do 7Timer (idx 1–8) entra como
      penalidade leve (até 20) nos scores DSO e DSO alta-res (planetária não usa — alvo brilhante fura
      haze). Só pontua quando o 7Timer responde; cartão DSO mostra uma linha de transparência.

## Dívida técnica (de code review / design — sem impacto imediato)
- [ ] **Camada semântica de cor:** unificar os dois verdes (`aurora` vs `green-400`) e os dois âmbares
      (`star` vs `amber-400`) em tokens de papel (sucesso/atenção), em vez de cor crua espalhada.
- [ ] **Fonte única da paleta:** hoje as cores vivem no `tailwind.config.ts` E nas CSS vars do
      `globals.css` (podem divergir). Derivar uma da outra ou documentar a relação.
- [ ] **Cores de filtro duplicadas:** `.filter-*` no `globals.css` e `FILTER_COLORS` no `utils.ts`
      mapeiam a mesma coisa — consolidar numa fonte só.
- [ ] **Escala de superfície:** padronizar os níveis ad-hoc (`bg-white/2../8`) em 2–3 tokens de surface.
- [ ] **Ranking das sugestões (perf, #6 do review):** `quickMax` varre a noite (~40 amostras) × ~60
      objetos = ~2,4k chamadas `Horizon` por troca de data. Ok hoje (memoizado, pequeno). Se o catálogo
      crescer, usar passo mais grosso no ranking ou a fórmula O(1) de altitude no trânsito
      (`90 − |lat − dec|`) em vez de amostrar.

## Feito recentemente (referência)
- Import de pasta FITS + sequência N.I.N.A.; equipamento via header; Siril Lab (script + limpeza + SHO/PixelMath);
  agente local (processa/limpa/arquiva, multi-noite dinâmico); armazenamento Local/Drive; auto-link da biblioteca;
  motor de alertas (eventos no app); autocomplete de alvo + AR/Dec via SIMBAD/Sésame;
  import de metadados planetários (SER/FireCapture) + brilho de Vênus; alertas por e-mail (Resend) + cron diário;
  gestão de arquivos planetários (script PowerShell: inventário/limpeza/arquivamento/publicação);
  **catálogo DSO offline + sugestões "bons alvos pra esta noite" no planejador**.
