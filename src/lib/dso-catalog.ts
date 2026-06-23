// Catálogo DSO offline embutido — objetos populares para escolher/planejar sem precisar
// lembrar códigos, e como fallback quando o SIMBAD/Sésame estiver fora. Viés para o céu
// do Sul (lat. do André ~-26°). RA em horas, Dec em graus (J2000). Coordenadas com
// precisão de planejamento (~0,1h / ~1°) — para AR/Dec exatos no projeto, use o Resolver.

export type DSOType =
  | 'Nebulosa' | 'Nebulosa planetária' | 'Galáxia'
  | 'Aglomerado globular' | 'Aglomerado aberto' | 'Remanescente SN'

export interface DSOObject {
  id:      string     // slug curto
  name:    string     // designação (M42, NGC 7000…)
  common:  string     // nome comum (PT)
  type:    DSOType
  raHours: number
  decDeg:  number
  mag?:    number
  note?:   string     // dica curta (estação, alvo de banda estreita…)
}

export const DSO_CATALOG: DSOObject[] = [
  // ── Messier mais fotografados ──────────────────────────────────────────────
  { id: 'm42',  name: 'M42',  common: 'Nebulosa de Órion',        type: 'Nebulosa',            raHours: 5.588,  decDeg: -5.39,  mag: 4.0, note: 'Alvo de verão; brilhante, ótima pra começar' },
  { id: 'm45',  name: 'M45',  common: 'Plêiades',                 type: 'Aglomerado aberto',   raHours: 3.79,   decDeg: 24.10,  mag: 1.6, note: 'Reflexão azul; campo largo' },
  { id: 'm31',  name: 'M31',  common: 'Galáxia de Andrômeda',     type: 'Galáxia',             raHours: 0.712, decDeg: 41.27,  mag: 3.4, note: 'Baixa no Sul; melhor na primavera' },
  { id: 'm33',  name: 'M33',  common: 'Galáxia do Triângulo',     type: 'Galáxia',             raHours: 1.564, decDeg: 30.66,  mag: 5.7 },
  { id: 'm1',   name: 'M1',   common: 'Nebulosa do Caranguejo',   type: 'Remanescente SN',     raHours: 5.575, decDeg: 22.01,  mag: 8.4 },
  { id: 'm8',   name: 'M8',   common: 'Nebulosa da Lagoa',        type: 'Nebulosa',            raHours: 18.06, decDeg: -24.38, mag: 6.0, note: 'Inverno; região rica de Sagitário' },
  { id: 'm20',  name: 'M20',  common: 'Nebulosa Trífida',         type: 'Nebulosa',            raHours: 18.04, decDeg: -23.03, mag: 6.3 },
  { id: 'm16',  name: 'M16',  common: 'Nebulosa da Águia',        type: 'Nebulosa',            raHours: 18.31, decDeg: -13.79, mag: 6.0, note: 'Pilares; bom em Ha' },
  { id: 'm17',  name: 'M17',  common: 'Nebulosa Ômega',           type: 'Nebulosa',            raHours: 18.34, decDeg: -16.17, mag: 6.0 },
  { id: 'm27',  name: 'M27',  common: 'Nebulosa do Haltere',      type: 'Nebulosa planetária', raHours: 19.99, decDeg: 22.72,  mag: 7.4 },
  { id: 'm57',  name: 'M57',  common: 'Nebulosa do Anel',         type: 'Nebulosa planetária', raHours: 18.89, decDeg: 33.03,  mag: 8.8, note: 'Pequena; pede foco longo' },
  { id: 'm51',  name: 'M51',  common: 'Galáxia do Rodamoinho',    type: 'Galáxia',             raHours: 13.50, decDeg: 47.20,  mag: 8.4, note: 'Baixa no Sul' },
  { id: 'm63',  name: 'M63',  common: 'Galáxia do Girassol',      type: 'Galáxia',             raHours: 13.26, decDeg: 42.03,  mag: 8.6 },
  { id: 'm64',  name: 'M64',  common: 'Galáxia do Olho Negro',    type: 'Galáxia',             raHours: 12.94, decDeg: 21.68,  mag: 8.5 },
  { id: 'm81',  name: 'M81',  common: 'Galáxia de Bode',          type: 'Galáxia',             raHours: 9.93,  decDeg: 69.07,  mag: 6.9, note: 'Muito ao Norte; difícil no Sul' },
  { id: 'm82',  name: 'M82',  common: 'Galáxia do Charuto',       type: 'Galáxia',             raHours: 9.93,  decDeg: 69.68,  mag: 8.4 },
  { id: 'm101', name: 'M101', common: 'Galáxia do Cata-vento',    type: 'Galáxia',             raHours: 14.05, decDeg: 54.35,  mag: 7.9 },
  { id: 'm104', name: 'M104', common: 'Galáxia do Sombrero',      type: 'Galáxia',             raHours: 12.67, decDeg: -11.62, mag: 8.0, note: 'Outono; bem posicionada no Sul' },
  { id: 'm83',  name: 'M83',  common: 'Cata-vento do Sul',        type: 'Galáxia',             raHours: 13.62, decDeg: -29.87, mag: 7.5, note: 'Face-on; alta no Sul' },
  { id: 'm106', name: 'M106', common: 'Galáxia M106',             type: 'Galáxia',             raHours: 12.32, decDeg: 47.30,  mag: 8.4 },
  { id: 'm13',  name: 'M13',  common: 'Grande Aglomerado de Hércules', type: 'Aglomerado globular', raHours: 16.69, decDeg: 36.46, mag: 5.8 },
  { id: 'm22',  name: 'M22',  common: 'Aglomerado de Sagitário',  type: 'Aglomerado globular', raHours: 18.61, decDeg: -23.90, mag: 5.1, note: 'Alto e brilhante no inverno' },
  { id: 'm4',   name: 'M4',   common: 'Globular em Escorpião',    type: 'Aglomerado globular', raHours: 16.39, decDeg: -26.53, mag: 5.6 },
  { id: 'm6',   name: 'M6',   common: 'Aglomerado da Borboleta',  type: 'Aglomerado aberto',   raHours: 17.67, decDeg: -32.22, mag: 4.2 },
  { id: 'm7',   name: 'M7',   common: 'Aglomerado de Ptolomeu',   type: 'Aglomerado aberto',   raHours: 17.90, decDeg: -34.79, mag: 3.3, note: 'Alto no Sul; campo largo' },
  { id: 'm44',  name: 'M44',  common: 'Presépio (Colmeia)',       type: 'Aglomerado aberto',   raHours: 8.67,  decDeg: 19.67,  mag: 3.7 },
  { id: 'm3',   name: 'M3',   common: 'Globular M3',              type: 'Aglomerado globular', raHours: 13.70, decDeg: 28.38,  mag: 6.2 },

  // ── NGC/IC populares (banda estreita / campo largo) ────────────────────────
  { id: 'ngc7000', name: 'NGC 7000', common: 'Nebulosa Norte-América', type: 'Nebulosa', raHours: 20.98, decDeg: 44.53, note: 'Grande; bom em Ha' },
  { id: 'ic5070',  name: 'IC 5070',  common: 'Nebulosa do Pelicano',   type: 'Nebulosa', raHours: 20.79, decDeg: 44.36 },
  { id: 'ngc6992', name: 'NGC 6960/92', common: 'Nebulosa Véu',        type: 'Remanescente SN', raHours: 20.85, decDeg: 31.00, note: 'OIII espetacular' },
  { id: 'ngc2237', name: 'NGC 2237', common: 'Nebulosa da Roseta',     type: 'Nebulosa', raHours: 6.52,  decDeg: 4.95,  note: 'Verão; alvo clássico SHO' },
  { id: 'ngc7635', name: 'NGC 7635', common: 'Nebulosa da Bolha',      type: 'Nebulosa', raHours: 23.34, decDeg: 61.20 },
  { id: 'ngc7293', name: 'NGC 7293', common: 'Nebulosa Hélice',        type: 'Nebulosa planetária', raHours: 22.49, decDeg: -20.84, mag: 7.6, note: 'Bem posicionada no Sul' },
  { id: 'ngc281',  name: 'NGC 281',  common: 'Nebulosa Pac-Man',       type: 'Nebulosa', raHours: 0.88,  decDeg: 56.62 },
  { id: 'ngc253',  name: 'NGC 253',  common: 'Galáxia do Escultor',    type: 'Galáxia', raHours: 0.79,  decDeg: -25.29, mag: 7.1, note: 'Brilhante; alta no Sul na primavera' },
  { id: 'ngc1365', name: 'NGC 1365', common: 'Galáxia da Fornalha',    type: 'Galáxia', raHours: 3.56,  decDeg: -36.14, mag: 9.5, note: 'Espiral barrada clássica' },
  { id: 'ngc1499', name: 'NGC 1499', common: 'Nebulosa da Califórnia', type: 'Nebulosa', raHours: 4.03, decDeg: 36.42 },
  { id: 'ic434',   name: 'IC 434',   common: 'Nebulosa Cabeça de Cavalo', type: 'Nebulosa', raHours: 5.68, decDeg: -2.46, note: 'Com a Flama; verão' },
  { id: 'ngc2024', name: 'NGC 2024', common: 'Nebulosa da Flama',      type: 'Nebulosa', raHours: 5.68,  decDeg: -1.90 },
  { id: 'ic1805',  name: 'IC 1805',  common: 'Nebulosa do Coração',    type: 'Nebulosa', raHours: 2.55,  decDeg: 61.45, note: 'Ao Norte; baixa no Sul' },
  { id: 'ic1848',  name: 'IC 1848',  common: 'Nebulosa da Alma',       type: 'Nebulosa', raHours: 2.85,  decDeg: 60.43 },
  { id: 'ic2118',  name: 'IC 2118',  common: 'Nebulosa Cabeça de Bruxa', type: 'Nebulosa', raHours: 5.10, decDeg: -7.20, note: 'Reflexão tênue; céu escuro' },
  { id: 'ic405',   name: 'IC 405',   common: 'Nebulosa da Estrela Flamejante', type: 'Nebulosa', raHours: 5.27, decDeg: 34.27 },
  { id: 'ic1396',  name: 'IC 1396',  common: 'Tromba do Elefante',     type: 'Nebulosa', raHours: 21.65, decDeg: 57.50 },
  { id: 'ngc7380', name: 'NGC 7380', common: 'Nebulosa do Mago',       type: 'Nebulosa', raHours: 22.79, decDeg: 58.13 },
  { id: 'ngc891',  name: 'NGC 891',  common: 'Galáxia de Perfil NGC 891', type: 'Galáxia', raHours: 2.38, decDeg: 42.35, mag: 9.9 },
  { id: 'rho',     name: 'Rho Oph',  common: 'Complexo de Rho Ophiuchi', type: 'Nebulosa', raHours: 16.45, decDeg: -23.45, note: 'Campo colorido; perto de Antares' },

  // ── Showpieces do Sul ──────────────────────────────────────────────────────
  { id: 'ngc3372', name: 'NGC 3372', common: 'Nebulosa da Carina',     type: 'Nebulosa', raHours: 10.75, decDeg: -59.87, mag: 1.0, note: 'Gigante; alta o ano todo no Sul' },
  { id: 'ngc5139', name: 'NGC 5139', common: 'Ômega Centauri',         type: 'Aglomerado globular', raHours: 13.45, decDeg: -47.48, mag: 3.7, note: 'Maior globular do céu' },
  { id: 'ngc104',  name: 'NGC 104',  common: '47 Tucanae',             type: 'Aglomerado globular', raHours: 0.40, decDeg: -72.08, mag: 4.0, note: 'Circumpolar no Sul' },
  { id: 'ngc5128', name: 'NGC 5128', common: 'Centaurus A',            type: 'Galáxia', raHours: 13.42, decDeg: -43.02, mag: 6.8, note: 'Faixa de poeira marcante' },
  { id: 'ngc4945', name: 'NGC 4945', common: 'Galáxia NGC 4945',       type: 'Galáxia', raHours: 13.09, decDeg: -49.47, mag: 8.7 },
  { id: 'ngc6744', name: 'NGC 6744', common: 'Galáxia NGC 6744',       type: 'Galáxia', raHours: 19.16, decDeg: -63.86, mag: 8.9, note: 'Espiral face-on, tipo Via Láctea' },
  { id: 'ngc300',  name: 'NGC 300',  common: 'Galáxia NGC 300',        type: 'Galáxia', raHours: 0.92,  decDeg: -37.68, mag: 8.1 },
  { id: 'ngc55',   name: 'NGC 55',   common: 'Galáxia NGC 55',         type: 'Galáxia', raHours: 0.25,  decDeg: -39.20, mag: 7.9 },
  { id: 'lmc',     name: 'LMC',      common: 'Grande Nuvem de Magalhães', type: 'Galáxia', raHours: 5.39, decDeg: -69.76, note: 'Circumpolar; campo enorme' },
  { id: 'smc',     name: 'SMC',      common: 'Pequena Nuvem de Magalhães', type: 'Galáxia', raHours: 0.88, decDeg: -72.83 },
  { id: 'ngc2070', name: 'NGC 2070', common: 'Nebulosa da Tarântula',  type: 'Nebulosa', raHours: 5.64, decDeg: -69.10, note: 'Na LMC; brilhante em Ha' },
  { id: 'ngc6334', name: 'NGC 6334', common: 'Nebulosa Pata de Gato',  type: 'Nebulosa', raHours: 17.35, decDeg: -36.07 },
  { id: 'ngc6357', name: 'NGC 6357', common: 'Nebulosa da Lagosta',    type: 'Nebulosa', raHours: 17.42, decDeg: -34.20 },
  { id: 'ngc3532', name: 'NGC 3532', common: 'Aglomerado do Poço dos Desejos', type: 'Aglomerado aberto', raHours: 11.10, decDeg: -58.73, mag: 3.0 },
  { id: 'ngc4755', name: 'NGC 4755', common: 'Caixa de Joias',         type: 'Aglomerado aberto', raHours: 12.89, decDeg: -60.35, mag: 4.2 },
  { id: 'ngc6231', name: 'NGC 6231', common: 'Aglomerado NGC 6231',    type: 'Aglomerado aberto', raHours: 16.90, decDeg: -41.83, mag: 2.6 },
  { id: 'ic2602',  name: 'IC 2602',  common: 'Plêiades do Sul',        type: 'Aglomerado aberto', raHours: 10.72, decDeg: -64.40, mag: 1.9 },
  { id: 'ic2944',  name: 'IC 2944',  common: 'Nebulosa da Galinha Correndo', type: 'Nebulosa', raHours: 11.60, decDeg: -63.40 },
  { id: 'ngc2997', name: 'NGC 2997', common: 'Galáxia NGC 2997',       type: 'Galáxia', raHours: 9.76, decDeg: -31.19, mag: 9.5 },
  { id: 'ngc1097', name: 'NGC 1097', common: 'Galáxia NGC 1097',       type: 'Galáxia', raHours: 2.77, decDeg: -30.27, mag: 9.5 },
]

// Busca simples por designação, nome comum ou tipo.
export function searchCatalog(q: string): DSOObject[] {
  const s = q.trim().toLowerCase()
  if (!s) return DSO_CATALOG
  return DSO_CATALOG.filter(o =>
    o.name.toLowerCase().includes(s) ||
    o.common.toLowerCase().includes(s) ||
    o.type.toLowerCase().includes(s),
  )
}
