/* Catálogo de sinalização — códigos do Manual Brasileiro de Sinalização de Trânsito
 * (MBST, consolidado pela Resolução CONTRAN nº 973/2022).
 * Códigos "IND-xx", "PEM", "MVE", "TAC" etc. são abreviaturas internas.
 *
 * forma: define o desenho do ícone (ver glifo() em app.js)
 * rot:   texto curto dentro do ícone; pic: pictograma desenhado
 */
"use strict";

const CATEGORIAS = [
  ["VERTICAL", "Placas"],
  ["HORIZONTAL", "Pintura no solo"],
  ["DISPOSITIVO_AUXILIAR", "Dispositivos"],
  ["SEMAFORICA", "Semáforos"],
  ["SUPORTE", "Suportes"],
  ["SERVICO", "Serviços"],
];

const CATALOGO = [
  // ------------------------------------------------------------ Placas ----
  { cod: "VRT-001", mbst: "R-1",   desc: "Parada obrigatória (PARE), lado 0,25 m", cat: "VERTICAL", un: "UN", forma: "pare" },
  { cod: "VRT-002", mbst: "R-2",   desc: "Dê a preferência, lado 0,75 m", cat: "VERTICAL", un: "UN", forma: "preferencia" },
  { cod: "VRT-003", mbst: "R-6a",  desc: "Proibido estacionar, Ø 0,50 m", cat: "VERTICAL", un: "UN", forma: "reg", rot: "E", barra: true },
  { cod: "VRT-004", mbst: "R-6c",  desc: "Proibido parar e estacionar, Ø 0,50 m", cat: "VERTICAL", un: "UN", forma: "reg", rot: "E", xis: true },
  { cod: "VRT-005", mbst: "R-19",  desc: "Velocidade máxima permitida, Ø 0,50 m", cat: "VERTICAL", un: "UN", forma: "reg", rot: "40" },
  { cod: "VRT-006", mbst: "R-24a", desc: "Sentido de circulação da via, Ø 0,50 m", cat: "VERTICAL", un: "UN", forma: "reg", rot: "→" },
  { cod: "VRT-007", mbst: "R-3",   desc: "Sentido proibido, Ø 0,50 m", cat: "VERTICAL", un: "UN", forma: "proibido" },
  { cod: "VRT-008", mbst: "R-4a",  desc: "Proibido virar à esquerda, Ø 0,50 m", cat: "VERTICAL", un: "UN", forma: "reg", rot: "↰", barra: true },
  { cod: "VRT-009", mbst: "A-32b", desc: "Passagem sinalizada de pedestres, 0,50 m", cat: "VERTICAL", un: "UN", forma: "adv", pic: "ped" },
  { cod: "VRT-010", mbst: "A-33b", desc: "Passagem sinalizada de escolares, 0,50 m", cat: "VERTICAL", un: "UN", forma: "adv", pic: "escolar", fluor: true },
  { cod: "VRT-011", mbst: "A-18",  desc: "Saliência ou lombada, 0,50 m", cat: "VERTICAL", un: "UN", forma: "adv", pic: "lombada" },
  { cod: "VRT-012", mbst: "A-14",  desc: "Semáforo à frente, 0,50 m", cat: "VERTICAL", un: "UN", forma: "adv", pic: "semaforo" },
  { cod: "VRT-013", mbst: "IND-01", desc: "Identificação de logradouro, 0,45 × 0,25 m", cat: "VERTICAL", un: "UN", forma: "ind", rot: "RUA" },
  { cod: "VRT-014", mbst: "IND-02", desc: "Orientação de destino (por m²)", cat: "VERTICAL", un: "M2", forma: "ind", rot: "CENTRO", verde: true },
  // ---------------------------------------------------- Pintura no solo ----
  { cod: "HRZ-001", mbst: "LFO-1", desc: "Linha simples contínua amarela", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "am", tipo: "continua" },
  { cod: "HRZ-002", mbst: "LFO-2", desc: "Linha simples seccionada amarela", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "am", tipo: "tracejada" },
  { cod: "HRZ-003", mbst: "LFO-3", desc: "Linha dupla contínua amarela", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "am", tipo: "dupla" },
  { cod: "HRZ-004", mbst: "LMS-1", desc: "Linha simples contínua branca", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "br", tipo: "continua" },
  { cod: "HRZ-005", mbst: "LBO",   desc: "Linha de bordo branca", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "br", tipo: "bordo" },
  { cod: "HRZ-006", mbst: "LRE",   desc: "Linha de retenção branca, 0,40 m", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "br", tipo: "retencao" },
  { cod: "HRZ-007", mbst: "FTP-1", desc: "Faixa de travessia de pedestres (zebrada)", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "br", tipo: "zebra" },
  { cod: "HRZ-008", mbst: "PEM",   desc: "Seta direcional ou legenda (PARE, ESCOLA)", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "br", tipo: "seta" },
  { cod: "HRZ-009", mbst: "MVE",   desc: "Marcação de vaga de estacionamento", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "br", tipo: "vaga" },
  { cod: "HRZ-010", mbst: "ZPA",   desc: "Zebrado de área não utilizável", cat: "HORIZONTAL", un: "M2", forma: "linha", cor: "am", tipo: "zebrado" },
  // -------------------------------------------------------- Dispositivos ----
  { cod: "AUX-001", mbst: "TAC", desc: "Tacha refletiva bidirecional", cat: "DISPOSITIVO_AUXILIAR", un: "UN", forma: "tacha" },
  { cod: "AUX-002", mbst: "TCH", desc: "Tachão refletivo bidirecional", cat: "DISPOSITIVO_AUXILIAR", un: "UN", forma: "tachao" },
  { cod: "AUX-003", mbst: "BAL", desc: "Balizador / delineador flexível", cat: "DISPOSITIVO_AUXILIAR", un: "UN", forma: "baliza" },
  { cod: "AUX-004", mbst: "OND", desc: "Ondulação transversal (lombada) tipo A", cat: "DISPOSITIVO_AUXILIAR", un: "UN", forma: "lombada" },
  { cod: "AUX-005", mbst: "PRT", desc: "Gradil / defensa de proteção de pedestres", cat: "DISPOSITIVO_AUXILIAR", un: "M", forma: "gradil" },
  // ----------------------------------------------------------- Semáforos ----
  { cod: "SEM-001", mbst: "", desc: "Grupo focal veicular 3 × 200 mm em LED", cat: "SEMAFORICA", un: "UN", forma: "semaforo" },
  { cod: "SEM-002", mbst: "", desc: "Grupo focal de pedestre com contador", cat: "SEMAFORICA", un: "UN", forma: "semaforo-ped" },
  // ------------------------------------------------------------ Suportes ----
  { cod: "SUP-001", mbst: "", desc: "Poste de aço galvanizado Ø 2\" × 3,00 m", cat: "SUPORTE", un: "UN", forma: "poste" },
  { cod: "SUP-002", mbst: "", desc: "Braçadeira para fixação de placa", cat: "SUPORTE", un: "UN", forma: "bracadeira" },
  { cod: "SUP-003", mbst: "", desc: "Semipórtico / braço projetado", cat: "SUPORTE", un: "UN", forma: "portico" },
  // ------------------------------------------------------------ Serviços ----
  { cod: "SRV-001", mbst: "", desc: "Remoção de placa com recolhimento do suporte", cat: "SERVICO", un: "UN", forma: "servico", rot: "−" },
  { cod: "SRV-002", mbst: "", desc: "Reposicionamento / realinhamento de placa", cat: "SERVICO", un: "UN", forma: "servico", rot: "↔" },
  { cod: "SRV-003", mbst: "", desc: "Remoção de pintura por fresagem/jateamento", cat: "SERVICO", un: "M2", forma: "servico", rot: "▭" },
  { cod: "OUT-001", mbst: "", desc: "Outro item (descrever na observação)", cat: "SERVICO", un: "UN", forma: "outro", rot: "?" },
];

const POR_CODIGO = Object.fromEntries(CATALOGO.map((m) => [m.cod, m]));

const ESTADOS = [
  ["BOM", "Bom"],
  ["REGULAR", "Regular"],
  ["RUIM", "Ruim"],
  ["INEXISTENTE", "Inexistente"],
];

// Mesmas cores do relatório e do painel do sistema anterior
const ACOES = [
  ["MANTER", "Manter", "#2e7d32"],
  ["IMPLANTAR", "Implantar", "#1565c0"],
  ["SUBSTITUIR", "Substituir", "#c62828"],
  ["REVITALIZAR", "Revitalizar", "#e65100"],
  ["REPOSICIONAR", "Reposicionar", "#00838f"],
  ["REMOVER", "Remover", "#6a1b9a"],
];

const LADOS = [
  ["DIREITO", "Direito"],
  ["ESQUERDO", "Esquerdo"],
  ["CENTRO", "Centro"],
  ["AMBOS", "Ambos"],
];

const UNIDADE = { UN: "un", M: "m", M2: "m²" };

const VOLUME_MBST = {
  I: "Vol. I — Sinalização Vertical de Regulamentação",
  II: "Vol. II — Sinalização Vertical de Advertência",
  III: "Vol. III — Sinalização Vertical de Indicação",
  IV: "Vol. IV — Sinalização Horizontal",
  V: "Vol. V — Sinalização Semafórica",
  VI: "Vol. VI — Dispositivos Auxiliares",
};

function volumeMbst(m) {
  if (!m) return null;
  if (m.cat === "VERTICAL") {
    if (m.mbst.startsWith("R-")) return "I";
    if (m.mbst.startsWith("A-")) return "II";
    return "III";
  }
  return { HORIZONTAL: "IV", SEMAFORICA: "V", DISPOSITIVO_AUXILIAR: "VI" }[m.cat] || null;
}
