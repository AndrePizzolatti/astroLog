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
4. **Entrega de alertas (e-mail + cron)** — fecha o ciclo "não perder evento" (escolher provedor,
   ex.: Resend; Vercel Cron). Pode ser puxado pra antes se quiser notificação logo.
5. **Suporte a planetária** — `captureType` + formulário próprio (trilha paralela ao DSO).
6. **Polimento** — thumbnails por sessão / thumb próprio; score de céu v2 com Lua; catálogo DSO offline.
7. **Parte social** — páginas públicas + seguir (maior escopo, menor urgência pra uso pessoal).

---


## Alertas
- [x] Eclipses e oposições **calculados** (astronomy-engine) + **APOD** do dia na página.
- [ ] **Conjunções** planeta-planeta (amostragem de aproximação) e **elongações** de Mercúrio/Vênus.
- [ ] **Visibilidade local** do eclipse solar (SearchLocalSolarEclipse com a localização).
- [ ] **Entrega por e-mail + cron** — hoje os eventos só aparecem no app. Falta um provedor
      de e-mail (ex.: Resend) e uma Vercel Cron que rode diariamente, compare os eventos com
      as inscrições (e o `advanceHours`) e dispare o aviso. (fecha o ciclo do alerta)
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

## Imagem planetária (não construído)
- [ ] Suportar captura **planetária** (lucky imaging, vídeo alto-FPS, fora do N.I.N.A.). Modelo
      diferente do DSO: `captureType` (DSO | PLANETARY); sessão planetária com campos próprios
      (software FireCapture/SharpCap, formato SER/AVI, fps, exposição em ms, total de frames,
      % empilhado, ROI, seeing, derotação/WinJUPOS). Processamento é AutoStakkert/RegiStax
      (o fluxo Siril/agente não se aplica). Provavelmente uma aba/variante de formulário.

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
  motor de alertas (eventos no app); **autocomplete de alvo + AR/Dec via SIMBAD/Sésame**.
