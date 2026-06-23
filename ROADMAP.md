# AstroLog — Roadmap / pendências

Anotações do que ficou de fora ou pra evoluir, pra não esquecer.

## Ordem sugerida de implementação

A ideia: introduzir uma **efeméride** cedo (ex.: `astronomy-engine`, MIT, offline) porque ela
destrava planejador, calendário, visibilidade de planetas e alertas calculados de uma vez.

1. [x] **Efeméride + Planejador de sessão** — FEITO. `astronomy-engine` em `src/lib/sky.ts`;
   `/dashboard/planner` com curva de altitude, trânsito, horas visíveis, Lua (iluminação/separação)
   e ranking de "melhores alvos da noite". (Falta: FOV do setup sobre o alvo.)
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
- [ ] **Conjunções** planeta-planeta (amostragem de aproximação).
- [ ] **Visibilidade local** do eclipse solar (SearchLocalSolarEclipse com a localização).
- [x] **Entrega por e-mail + cron** — FEITO. `/api/cron/alerts` (Vercel Cron diário) → `processAlertDigests`
      compara eventos com as inscrições (e o `advanceHours`), deduplica em `AlertNotification` e envia um
      resumo por e-mail via Resend (`src/lib/email.ts`). APOD opcional no resumo se inscrito.
      Limitação do free tier do Resend: o remetente `onboarding@resend.dev` só entrega ao e-mail dono da
      conta — pra outros destinatários, verificar um domínio e trocar `EMAIL_FROM`.
- [ ] **ISS, cometas, conjunções** — ficaram de fora do motor v1 (precisam de API/efeméride
      externa: passes da ISS por localização, cometas ativos, conjunções calculadas).
- [ ] **APOD** — feed da imagem astronômica do dia (NASA APOD API, `NASA_API_KEY` já no .env).
- [ ] Filtrar eclipses por **visibilidade na localização** do usuário (hoje só mostra a data + região geral).
- [ ] Manter a tabela curada de eclipses/oposições atualizada (`src/lib/astro-events.ts`).

## Planejador de sessão (não construído)
- [ ] Cruzar previsão + equipamento + alvos: curva de **altitude** na noite, **separação da Lua**,
      **FOV** do setup sobre o alvo, e recomendação de exposição/integração.

## Calendário astronômico — FEITO
- [x] `/dashboard/calendar`: grade do mês (fase da Lua + eventos), painel do dia (eventos +
      visibilidade dos planetas, janela de/até e altitude máx) e lista de eventos do mês.
- [ ] Evoluções possíveis: marcar no calendário as noites de melhor "score" de céu (cruzar com a
      previsão), e destacar dias com janela de lua nova longa.

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
- [ ] Pendências: thumbnail por **sessão** (não só projeto); o thumbnail do Drive só carrega se o
      arquivo estiver compartilhado ("qualquer pessoa com link") ou logado na conta — talvez gerar/subir
      um thumb pequeno próprio pra garantir exibição.

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
- [ ] Catálogo DSO **offline** embutido (fallback quando o SIMBAD/Sésame estiver fora).
- [ ] Score de céu v2 incluindo **Lua** (fase/iluminação) e seeing.

## Feito recentemente (referência)
- Import de pasta FITS + sequência N.I.N.A.; equipamento via header; Siril Lab (script + limpeza + SHO/PixelMath);
  agente local (processa/limpa/arquiva, multi-noite dinâmico); armazenamento Local/Drive; auto-link da biblioteca;
  motor de alertas (eventos no app); autocomplete de alvo + AR/Dec via SIMBAD/Sésame;
  import de metadados planetários (SER/FireCapture) + brilho de Vênus; alertas por e-mail (Resend) + cron diário;
  **gestão de arquivos planetários (script PowerShell: inventário/limpeza/arquivamento/publicação)**.
