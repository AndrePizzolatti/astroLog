# AstroLog — Roadmap / pendências

Anotações do que ficou de fora ou pra evoluir, pra não esquecer.

## Ordem sugerida de implementação

A ideia: introduzir uma **efeméride** cedo (ex.: `astronomy-engine`, MIT, offline) porque ela
destrava planejador, calendário, visibilidade de planetas e alertas calculados de uma vez.

1. [x] **Efeméride + Planejador de sessão** — FEITO. `astronomy-engine` em `src/lib/sky.ts`;
   `/dashboard/planner` com curva de altitude, trânsito, horas visíveis, Lua (iluminação/separação)
   e ranking de "melhores alvos da noite". (Falta: FOV do setup sobre o alvo.)
2. **Calendário astronômico** — reaproveita a efeméride + o motor de eventos: grade do mês,
   eventos do dia/mês e visibilidade dos planetas por dia (de que hora até que hora).
3. **Alertas calculados + APOD** — com a efeméride, calcular oposições/conjunções/posição dos
   planetas de verdade (substitui parte da tabela curada); APOD via NASA API.
4. **Entrega de alertas (e-mail + cron)** — fecha o ciclo "não perder evento" (escolher provedor,
   ex.: Resend; Vercel Cron). Pode ser puxado pra antes se quiser notificação logo.
5. **Suporte a planetária** — `captureType` + formulário próprio (trilha paralela ao DSO).
6. **Polimento** — thumbnails por sessão / thumb próprio; score de céu v2 com Lua; catálogo DSO offline.
7. **Parte social** — páginas públicas + seguir (maior escopo, menor urgência pra uso pessoal).

---


## Alertas
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

## Calendário astronômico (ideia — não construído)
- [ ] Vista de **calendário** (grade do mês) que mostra:
      - os **eventos do dia** (reusa o motor `src/lib/astro-events.ts`);
      - a **lista de eventos do mês**;
      - a **visibilidade dos planetas por dia** — quais estão visíveis e **de que hora até que hora**
        (nascer/pôr e a janela acima do horizonte), pra localização do usuário.
- Abordagem: usar uma efeméride pra nascer/pôr/altitude dos planetas — ex.: lib `astronomy-engine`
  (MIT, sem API externa) — e cruzar com a localização do perfil e com o motor de eventos.
- Sobrepõe com o "Planejador de sessão" (mesma base de altitude/visibilidade) — dá pra fazer juntos.

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
