# AstroLog — Agente local do Siril

Roda o processamento do Siril na sua máquina e reporta o resultado de volta pro AstroLog,
sem entrada manual. O app web não consegue rodar o Siril (binário nativo) — por isso esse
agentezinho roda local.

## O que ele faz

1. Avisa o AstroLog que começou (o projeto vai para **Processando**).
2. Roda `siril-cli -s <script.ssf>` na pasta do projeto.
3. Faz a **limpeza segura** dos intermediários (move `process/` e arquivos temporários para
   `_astrolog_trash/` — nunca apaga lights, darks, flats, biases, masters nem resultados).
4. Reporta **concluído**, registrando o resultado final como um link **Local** no projeto
   (o projeto vai para **Pronto p/ processar**).

## Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- [Siril](https://siril.org) instalado (precisamos do `siril-cli`).
  No Windows costuma ficar em `C:/Program Files/Siril/bin/siril-cli.exe`.

## Configuração (uma vez)

1. No AstroLog, vá em **Configurações → Agente local** e gere um **token** (copie — só aparece uma vez).
2. Crie um arquivo `siril-agent.config.json` na mesma pasta deste script:

```json
{
  "appUrl": "https://seu-app.vercel.app",
  "token":  "cole-o-token-aqui",
  "siril":  "C:/Program Files/Siril/bin/siril-cli.exe",
  "ssdArchiveDir": "E:/AstroArchive",
  "driveSyncDir":  "G:/Meu Drive/Astro",
  "archiveMasters": false,
  "dflatMaxSeconds": 30,
  "filterMap": { "L-eXtreme": "HaOIII", "L-Ultimate": "HaOIII", "SII-OIII": "SIIOIII" }
}
```

- `filterMap` (opcional): mapeia o **nome do seu filtro** (header `FILTER`) para o grupo `HaOIII`, `SIIOIII` ou `broadband`. Usado na geração automática do script pra saber o que extrair. Sem o mapa, o agente tenta adivinhar pelo nome.

- `ssdArchiveDir` (opcional): para onde os resultados são **movidos** ao terminar (arquivo canônico no SSD, libera o disco de trabalho).
- `driveSyncDir` (opcional): pasta do **Google Drive para Desktop** — os resultados são **copiados** para cá e o Google sincroniza sozinho (backup offsite, sem API de escrita).
- Os caminhos finais são reportados ao AstroLog automaticamente (aparecem em **Arquivos & Links** do projeto).

## Uso

1. Gere o script `.ssf` no AstroLog (botão **Siril** no projeto) e salve na pasta do projeto.
2. Organize a pasta como o script espera: `lights/` e, se tiver, `darks/ flats/ dflats/ biases/`.
   (ou deixe o agente organizar — veja abaixo)
3. Rode:

```bash
node siril-agent.mjs --project <projectId> --folder "D:/Astro/NGC3372" --script "D:/Astro/NGC3372/NGC3372.ssf"
```

O `<projectId>` é o trecho final da URL do projeto: `/dashboard/projects/<projectId>`.

### Geração automática do script (sem precisar baixar o .ssf)

Se você **não passar** `--script` (e não houver um `.ssf` na pasta), o agente **gera o script sozinho**, lendo os headers e a estrutura de pastas:

- A pasta tem `lights/` (ou `LIGHT/`) → **noite única**: organiza e processa.
- A pasta tem **subpastas de noite** (cada uma com lights) → **multi-noite**: organiza cada noite, calibra cada uma com **os flats/dflats da própria noite** (e se a noite não tiver, usa os gerais que estiverem na raiz do alvo — idem darks), agrupa por **filtro** (`HaOIII`/`SII OIII`/broadband), junta as noites por canal, empilha (o **OIII vai combinado de todas as noites**) e compõe SHO/HOO/SOO.

Veja o script **antes de rodar** com `--dry-run` (não processa, só mostra):

```bash
node siril-agent.mjs --project <id> --folder "D:/Astro/NGC3372" --dry-run
```

Calibração geral compartilhada (opcional): coloque `darks/ dflats/ flats/ biases/` (minúsculo) na **raiz do alvo** — valem pras noites que não têm a sua própria.

### Organizar a pasta de captura

Sorteia os FITS por tipo (lê o header `IMAGETYP`) em `lights/ darks/ flats/ dflats/ biases/`.
Darks com exposição ≤ `dflatMaxSeconds` viram dark flats.

```bash
node siril-agent.mjs --organize "D:/Captura/2024-03-01" --into "D:/Astro/NGC3372"
```

## Fluxo automático completo

`captura (N.I.N.A.)` → `--organize` (arruma as pastas) → importa no app (cria a sessão) →
`processar` (Siril + limpeza) → **arquivamento** (move pro SSD + copia pro Drive) →
o app registra os caminhos finais sozinho.

## Segurança

- O token autentica o agente. Trafega só por HTTPS. Pode revogar a qualquer momento em Configurações.
- A limpeza só move (nunca apaga de vez) e só intermediários conhecidos. Confira o
  `_astrolog_trash/` e apague quando tiver certeza.
