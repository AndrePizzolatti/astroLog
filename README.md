# AstroLog

Gerenciador de astrofotografia: registra projetos, sessões, equipamento e calibração,
cruza com a previsão de céu, e automatiza a entrada de dados e o processamento (Siril)
a partir dos arquivos do N.I.N.A. — sem ficar preenchendo formulário à mão.

Stack: **Next.js 14 (App Router) · tRPC v11 · Prisma + Supabase (PostgreSQL) · NextAuth v4 ·
Tailwind**. Deploy pensado pra Vercel.

---

## Como funciona (visão geral)

O app é o **cérebro/índice** — guarda os *registros* (projetos, sessões, parâmetros, links).
Os **arquivos pesados** (lights, masters, finais) ficam no seu **disco** (pra processar) e no
**Google Drive** (backup) — o app guarda só o caminho/link. Um **agente local** opcional roda o
Siril na sua máquina e reporta de volta.

```
Captura (N.I.N.A.) ─▶ importa no app (cria sessão, lê headers)
                      ▼
            Siril Lab gera o script  ──ou──  agente gera sozinho
                      ▼
        processa (Siril) ─▶ limpa ─▶ arquiva (SSD + Drive) ─▶ app registra os caminhos
                      ▼
              pós no Siril/PixInsight (SHO, stretch, BGE…) ─▶ final
```

---

## Setup

### Pré-requisitos
- Node.js 18+
- Um projeto no [Supabase](https://supabase.com) (PostgreSQL + Storage)
- Credenciais OAuth do Google e/ou GitHub (login)

### 1. Instalar
```bash
npm install
```

### 2. Variáveis de ambiente
Copie `.env.example` para `.env` e preencha:

| Variável | Pra quê |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | conexão Postgres do Supabase (pooler / direta) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | upload de arquivos (lado servidor) |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | NextAuth (`openssl rand -base64 32` pro secret) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | login Google + Drive |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | login GitHub |
| `NASA_API_KEY` | opcional (futuro: APOD) |

**OAuth:** crie os apps no Google Cloud / GitHub e aponte o redirect para
`http://localhost:3000/api/auth/callback/google` (e `/github`). Para usar o **picker do
Google Drive**, habilite a *Google Drive API* e adicione o escopo
`drive.metadata.readonly` na tela de consentimento (modo Testing já basta pra uso pessoal).

### 3. Banco de dados
```bash
npm run db:migrate:deploy   # aplica as migrations
npm run db:generate         # gera o Prisma Client
```

### 4. Rodar
```bash
npm run dev      # desenvolvimento (localhost:3000)
npm run build    # build de produção
npm run start    # serve o build
```

---

## Funcionalidades

- **Equipamento** — telescópios, câmeras, montagens, acessórios e *setups*, com cálculos
  ópticos automáticos (razão focal, escala de placa, FOV, amostragem). Dá pra **criar a partir
  de um frame FITS** (lê foco/abertura/pixel/sensor do header).
- **Projetos & Sessões** — registro por noite, totais de integração, ficha técnica. **Importação
  de pasta de FITS** (lê headers, agrupa por noite/filtro, cria sessões) e de **sequência `.json`
  do N.I.N.A.** (cria o projeto com alvo/coordenadas).
- **Biblioteca de Calibração** — darks/biases reutilizáveis por câmera, com validade. **Auto-link**:
  na importação, vincula sozinho a calibração compatível e não vencida. Entradas por **link**
  (Drive/Local) — sem upload.
- **Previsão de céu** — pontua as próximas noites (nuvem/vento/chuva) via Open-Meteo, com mapa,
  GPS e busca de cidade.
- **Siril Lab** (no projeto) — gera o script `.ssf` sob medida (OSC/Mono/**SHO**), com dark flats,
  e um script de **limpeza segura**; no modo SHO, gera a **receita de PixelMath ponderada**.
- **Arquivos & Links** — vincula resultados/brutos por link do **Drive** ou caminho **Local**
  (ou upload Supabase). Picker do Drive integrado.
- **Agente local** (opcional) — roda o Siril, limpa, arquiva no SSD/Drive e reporta. Veja
  [`public/agent/README.md`](public/agent/README.md). Inclui geração **multi-noite automática**.

> Em construção: motor de alertas (hoje só as inscrições) e parte social (modelos no schema).

---

## Armazenamento — o que fica onde

- **Banco (Supabase Postgres):** todos os *registros* (pequeno).
- **Disco local / SSD:** cópias de trabalho dos pesados (pra processar) e arquivo.
- **Google Drive:** backup offsite dos *keepers* (brutos + masters + finais).
- **Bucket Supabase:** legado (uploads antigos) — evite, prefira Drive/Local.

O agente pode automatizar: mover resultados pro SSD + copiar pra uma pasta do **Google Drive
para Desktop** (sincroniza sozinho), e atualizar os caminhos no app.

---

## Fluxo de trabalho completo

1. **Captura** no N.I.N.A.
2. **Importa** no app (arrasta os FITS no projeto → cria as sessões, auto-vincula calibração).
3. **Gera o script** no **Siril Lab** (ou deixa o **agente** gerar lendo as pastas).
4. **Processa** com o Siril (Siril Lab → baixar `.ssf` e rodar à mão, **ou** o agente roda).
5. **Arquiva** os resultados (manual, ou o agente move pro SSD + Drive e registra).
6. **Pós** no Siril/PixInsight (SHO ponderado, stretch, extração de fundo, starless…) → final.
7. **Registra o final** em *Arquivos & Links* (ou o agente faz com `--archive`).

Dá pra fazer **tudo manual** (sem o agente) usando o app; o agente só tira o trabalho braçal.

---

## Scripts úteis

| Comando | Faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm run start` | build e serve produção |
| `npm run db:migrate:deploy` | aplica migrations no banco |
| `npm run db:studio` | abre o Prisma Studio |
| `npm run lint` | lint (Next) |

---

## Documentação relacionada
- [`public/agent/README.md`](public/agent/README.md) — agente local do Siril (instalar, config, multi-noite, dry-run).
- `NINA_INTEGRATION.md` — design da integração com o N.I.N.A. (implementado).
- `IMPROVEMENTS.md` — histórico de melhorias.
