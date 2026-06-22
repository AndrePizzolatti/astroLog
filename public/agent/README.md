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
  "dflatMaxSeconds": 30
}
```

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
