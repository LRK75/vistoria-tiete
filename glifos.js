/* Ícones dos sinais (SVG, 64 × 64). Desenhos simplificados, para reconhecimento
 * rápido no catálogo; não substituem os desenhos oficiais do MBST. */
"use strict";

const _escG = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Pontas de seta reutilizadas (mesma definição em todos os ícones)
const _DEFS = '<defs><marker id="sp" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#111"/></marker>' +
  '<marker id="sb" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#fff"/></marker></defs>';

/* Pictogramas: desenhados em torno do centro (32,32) numa área de ~26 × 26.
 * c = cor do traço/preenchimento. */
const _L = (d, c = "#111", w = 3.6, seta = false) =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${seta ? ` marker-end="url(#${c === "#fff" ? "sb" : "sp"})"` : ""}/>`;

const PIC = {
  // ---- setas e movimentos
  setaCima: (c) => _L("M32 46V20", c, 4.5, true),
  setaDir: (c) => _L("M18 32H44", c, 4.5, true),
  setaDiag: (c) => _L("M22 22L40 40", c, 4.5, true),
  virar: (c) => _L("M38 46V32Q38 26 32 26H23", c, 4.2, true),
  retorno: (c) => _L("M38 46V28Q38 19 30.5 19Q23 19 23 28V36", c, 4.2, true),
  frenteOuVirar: (c) => _L("M36 46V20", c, 4, true) + _L("M36 36Q36 30 30 30H22", c, 4, true),
  duploSentido: (c) => _L("M26 44V20", c, 4, true) + _L("M38 20V44", c, 4, true),
  duploHorizontal: (c) => _L("M30 26H18", c, 4, true) + _L("M34 38H46", c, 4, true),
  conservar: (c) => `<rect x="18" y="20" width="10" height="10" fill="${c}"/>` + _L("M24 34L40 44", c, 4, true),
  mudarFaixa: (c) => _L("M24 46V38L38 26V18", c, 4, true) + _L("M32 46V40M32 34V30M32 24V20", c, 2.4),
  ultrapassar: () => `${PIC.carro("#c62828", -7)}${PIC.carro("#111", 7)}`,
  rotatoria: (c) => `<circle cx="32" cy="32" r="11" fill="none" stroke="${c}" stroke-width="3.6" stroke-dasharray="15 8"/>` +
    _L("M43 30.5L43 33", c, 3.6, true) + _L("M21 33.5L21 31", c, 3.6, true),
  pedestreLado: (c) => PIC.pedestre(c, 4) + _L("M24 44H16", c, 3.4, true),
  bicicletaLado: (c) => PIC.bicicleta(c, 0, -3) + _L("M28 46H16", c, 3.4, true),
  cicloPedestre: (c) => `<g transform="translate(-8 0) scale(.75) translate(10 10)">${PIC.bicicleta(c)}</g><line x1="32" y1="18" x2="32" y2="46" stroke="${c}" stroke-width="2"/><g transform="translate(9 0) scale(.75) translate(10 10)">${PIC.pedestre(c)}</g>`,
  caminhaoDireita: (c) => `<g transform="translate(0 -5)">${PIC.caminhao(c)}</g>` + _L("M24 44H40", c, 3.4, true),
  setasV: () => "",
  setasH: () => "",
  eixo: (c) => `<circle cx="26" cy="47" r="2.6" fill="${c}"/><circle cx="38" cy="47" r="2.6" fill="${c}"/>`,

  // ---- veículos e pessoas
  carro: (c = "#111", dx = 0) => `<g transform="translate(${dx} 0)"><path d="M20 36v-5l3-6h18l3 6v5z" fill="${c}"/><circle cx="25" cy="37" r="3" fill="${c}"/><circle cx="39" cy="37" r="3" fill="${c}"/><path d="M24.5 30l2-3.6h11l2 3.6z" fill="#fff"/></g>`,
  caminhao: (c) => `<rect x="17" y="22" width="19" height="15" fill="${c}"/><path d="M37 26h6l4 5v6H37z" fill="${c}"/><circle cx="23" cy="39" r="3.2" fill="${c}"/><circle cx="42" cy="39" r="3.2" fill="${c}"/><rect x="39" y="27.5" width="4" height="3.5" fill="#fff"/>`,
  onibus: (c) => `<rect x="17" y="21" width="30" height="17" rx="3" fill="${c}"/><rect x="20" y="24" width="24" height="6" fill="#fff"/><circle cx="23" cy="39" r="3" fill="${c}"/><circle cx="41" cy="39" r="3" fill="${c}"/>`,
  moto: (c) => `<circle cx="22" cy="38" r="5" fill="none" stroke="${c}" stroke-width="2.6"/><circle cx="42" cy="38" r="5" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M22 38l8-8h8l4 8M34 30l2-6h4" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/>`,
  bicicleta: (c, dx = 0, dy = 0) => `<g transform="translate(${dx} ${dy})"><circle cx="22" cy="38" r="6" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="42" cy="38" r="6" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M22 38l6-10h10l4 10M28 28l4 10h6M36 24h4" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/></g>`,
  trator: (c) => `<circle cx="24" cy="37" r="7" fill="none" stroke="${c}" stroke-width="3"/><circle cx="42" cy="40" r="4" fill="${c}"/><path d="M26 30V20h8l3 10h8v6" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  pedestre: (c, dx = 0) => `<g transform="translate(${dx} 0)"><circle cx="33" cy="18" r="3.4" fill="${c}"/><path d="M32 23l-4 11 5 3-2 10M32 23l5 8 5 2M28 34l-6 3M33 37l6 9" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`,
  pedestreFaixa: (c) => `<g transform="translate(0 -3)">${PIC.pedestre(c)}</g>` + [22, 28, 34, 40].map((x) => `<rect x="${x}" y="45" width="3.5" height="5" fill="${c}"/>`).join(""),
  bicicletaFaixa: (c) => PIC.bicicleta(c, 0, -5) + [22, 28, 34, 40].map((x) => `<rect x="${x}" y="45" width="3.5" height="5" fill="${c}"/>`).join(""),
  escolar: (c) => `<circle cx="27" cy="20" r="3" fill="${c}"/><circle cx="39" cy="22" r="2.6" fill="${c}"/><path d="M27 24l-3 10 4 3-2 9M39 26l-2 8 3 3-1 8M27 26l6 5M24 34l-4 3" stroke="${c}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
  escolarFaixa: (c) => `<g transform="translate(0 -3)">${PIC.escolar(c)}</g>` + [22, 28, 34, 40].map((x) => `<rect x="${x}" y="45" width="3.5" height="5" fill="${c}"/>`).join(""),
  criancas: (c) => `<circle cx="28" cy="22" r="3" fill="${c}"/><path d="M28 26v10l-3 9M28 36l3 9M28 29l-5 4M28 29l6 2" stroke="${c}" stroke-width="2.8" fill="none" stroke-linecap="round"/><circle cx="40" cy="40" r="3.6" fill="${c}"/>`,
  carroca: (c) => `<rect x="26" y="26" width="16" height="8" fill="${c}"/><circle cx="34" cy="38" r="5" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M26 30H16M16 30l-2 6" stroke="${c}" stroke-width="2.6" fill="none"/>`,
  carroMao: (c) => `<circle cx="22" cy="40" r="4" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M24 36l4-8h14l-4 8zM42 28l4-6" fill="${c}" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/><path d="M38 36l2 8" stroke="${c}" stroke-width="2.4"/>`,
  animal: (c) => `<path d="M18 28h22l4-4h4v7h-4v4H22l-2 10M38 35l2 10M24 35v10M18 28l-2 6" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="28" width="20" height="7" fill="${c}"/>`,
  cervo: (c) => `${PIC.animal(c)}<path d="M44 24l-2-6M46 24l3-6M42 19l-2-2M49 19l2-2" stroke="${c}" stroke-width="2" fill="none"/>`,
  buzina: (c) => `<path d="M18 28h6l12-7v22l-12-7h-6z" fill="${c}"/><path d="M40 26q4 6 0 12M44 23q6 9 0 18" stroke="${c}" stroke-width="2.4" fill="none"/>`,
  corrente: (c) => `<circle cx="32" cy="32" r="13" fill="none" stroke="${c}" stroke-width="5"/>` + [0, 45, 90, 135].map((a) => `<rect x="30" y="16" width="4" height="32" fill="#fff" transform="rotate(${a} 32 32)" opacity=".9"/>`).join("") + `<circle cx="32" cy="32" r="5" fill="${c}"/>`,
  trem: (c) => `<rect x="18" y="24" width="18" height="12" fill="${c}"/><rect x="36" y="18" width="10" height="18" fill="${c}"/><rect x="22" y="18" width="4" height="6" fill="${c}"/><circle cx="23" cy="39" r="3" fill="${c}"/><circle cx="31" cy="39" r="3" fill="${c}"/><circle cx="41" cy="39" r="3" fill="${c}"/>`,
  bonde: (c) => `<rect x="18" y="24" width="28" height="14" rx="2" fill="${c}"/><rect x="21" y="27" width="22" height="5" fill="#fff"/><path d="M32 24l-4-6M28 18h10" stroke="${c}" stroke-width="2.2"/><circle cx="24" cy="40" r="2.6" fill="${c}"/><circle cx="40" cy="40" r="2.6" fill="${c}"/>`,
  aviao: (c) => `<path d="M32 15l3 3v9l12 7v3l-12-3v7l4 3v2l-7-2-7 2v-2l4-3v-7l-12 3v-3l12-7v-9z" fill="${c}"/>`,
  vento: (c) => `<path d="M20 46V18" stroke="${c}" stroke-width="2.6"/><path d="M20 20l22 3v8l-22 3z" fill="${c}"/><path d="M27 21v12M34 22v10" stroke="#fff" stroke-width="2"/>`,
  barreira: (c) => `<rect x="18" y="38" width="4" height="10" fill="${c}"/><path d="M20 38L46 30" stroke="${c}" stroke-width="5"/><path d="M26 36.2l4-1.2M34 33.8l4-1.2" stroke="#fff" stroke-width="5"/>`,
  semaforo: () => '<rect x="26" y="15" width="12" height="32" rx="3" fill="#111"/><circle cx="32" cy="21" r="3.2" fill="#e53935"/><circle cx="32" cy="31" r="3.2" fill="#fdd835"/><circle cx="32" cy="41" r="3.2" fill="#43a047"/>',
  pareFrente: (c) => '<polygon points="27,16 37,16 44,23 44,33 37,40 27,40 20,33 20,23" fill="#c62828"/>' + _L("M32 44V50", c, 3),
  obras: (c) => `<circle cx="36" cy="18" r="3.2" fill="${c}"/><path d="M35 22l-6 10 6 4-2 10M29 32l-8 4M35 26l6 4" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M20 38l-4 8M14 46h8" stroke="${c}" stroke-width="2.4"/><path d="M38 46l6-6 6 6z" fill="${c}"/>`,
  escorregadia: (c) => PIC.carro(c, 0).replace('translate(0 0)', 'translate(0 -5) rotate(-12 32 32)') + _L("M20 44q3-4 6 0t6 0M34 46q3-4 6 0t6 0", c, 2.2),
  cascalho: (c) => PIC.carro(c, -4).replace('translate(-4 0)', 'translate(-4 -4)') + [[40, 26], [44, 22], [46, 30], [42, 32], [48, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${c}"/>`).join(""),
  desmoronamento: (c) => `<path d="M16 46L30 18L34 28L46 46z" fill="${c}"/><circle cx="40" cy="22" r="3" fill="${c}"/><circle cx="45" cy="30" r="2.4" fill="${c}"/><circle cx="38" cy="32" r="2" fill="#fff"/>`,
  irregular: (c) => _L("M15 38q4-8 8 0t8 0 8 0 8 0", c, 3.4) + _L("M15 45H49", c, 2),
  lombada: (c) => _L("M14 42h8c4-10 16-10 20 0h8", c, 3.5),
  depressao: (c) => _L("M14 30h9c4 10 14 10 18 0h9", c, 3.5),
  declive: (c) => `<path d="M16 44L48 26V44z" fill="${c}"/><text x="38" y="23" font-family="Arial" font-weight="700" font-size="8" fill="${c}">10%</text>`,

  // ---- geometria da via (advertência)
  curvaAcentuada: (c) => _L("M38 48V30L26 22", c, 4.5, true),
  curva: (c) => _L("M37 48V34Q37 22 25 20", c, 4.5, true),
  sinuosa: (c) => _L("M33 49Q24 43 31 37Q38 31 30 26Q24 22 28 16", c, 4.2, true),
  sAcentuado: (c) => _L("M36 49V41L26 35V27L36 21V16", c, 4.2, true),
  curvaS: (c) => _L("M36 49Q36 39 30 35Q24 31 26 23Q27 18 31 16", c, 4.2, true),
  cruzamento: (c) => _L("M32 48V16M17 32H47", c, 4.5),
  viaLateral: (c) => _L("M35 48V16M35 32H19", c, 4.5),
  interT: (c) => _L("M32 48V30M17 30H47", c, 4.5),
  bifurcacao: (c) => _L("M32 48V35L22 18M32 35L42 18", c, 4.5),
  obliquo: (c) => _L("M35 48V16M35 36L21 24", c, 4.5),
  juncoes: (c) => _L("M32 48V16M32 40H19M32 25H45", c, 4.2),
  circulo: (c) => `<circle cx="32" cy="32" r="9" fill="none" stroke="${c}" stroke-width="3.6"/>` + _L("M32 41V48M32 23V16M41 32H47M23 32H17", c, 3.6),
  confluencia: (c) => _L("M37 48V16M22 47Q24 33 37 29", c, 4.2),
  estreitaCentro: (c) => _L("M23 48V38L28 29V16M41 48V38L36 29V16", c, 3.6),
  estreitaLado: (c) => _L("M23 48V38L30 29V16M40 48V16", c, 3.6),
  alargaLado: (c) => _L("M30 48V38L23 29V16M40 48V16", c, 3.6),
  ponteEstreita: (c) => _L("M27 48V16M37 48V16M21 42L27 36M43 42L37 36M21 22L27 28M43 22L37 28", c, 3.2),
  ponteMovel: (c) => `<path d="M14 40h14l14-14" stroke="${c}" stroke-width="4" fill="none"/><path d="M14 46h36" stroke="${c}" stroke-width="2" stroke-dasharray="3 3"/>`,
  inicioDupla: (c) => _L("M29 48V34L23 16M35 48V34L41 16M32 28V16", c, 3.4),
  fimDupla: (c) => _L("M23 48L29 30V16M41 48L35 30V16M32 48V36", c, 3.4),
  pistaDividida: (c) => `<rect x="29" y="18" width="6" height="24" rx="3" fill="${c}"/>` + _L("M24 46V22", c, 3, true) + _L("M40 46V22", c, 3, true),
  semSaida: (c) => _L("M32 48V24", c, 5) + `<rect x="20" y="17" width="24" height="7" fill="#c62828"/>`,
};

function glifo(m) {
  const s = (c) => `<svg viewBox="0 0 64 64" aria-hidden="true">${_DEFS}${c}</svg>`;
  const txt = (t, tam, cor, y = 37, peso = 700) =>
    `<text x="32" y="${y}" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif" font-weight="${peso}" font-size="${tam}" fill="${cor}">${_escG(t)}</text>`;
  const espelhar = (c) => (m.esp ? `<g transform="translate(64 0) scale(-1 1)">${c}</g>` : c);
  // Conteúdo interno de placas circulares/losangos: pictograma e/ou texto
  const miolo = (cor) => {
    let c = m.pic && PIC[m.pic] ? espelhar(PIC[m.pic](cor)) : "";
    if (m.rot) {
      const linhas = String(m.rot).split("-").length > 1 && m.rot.length > 6 ? m.rot.split("-") : [m.rot];
      if (linhas.length > 1) c += txt(linhas[0], 11, cor, 31) + txt(linhas[1], 11, cor, 42);
      else {
        const tam = m.rot.length <= 2 ? 24 : m.rot.length <= 3 ? 19 : 15;
        c += txt(m.rot, tam, cor, m.pic === "setasV" || m.pic === "setasH" || m.pic === "eixo" ? 36 : 39);
      }
      if (m.pic === "setasV") c += _L("M32 22V15", cor, 2.4, true) + _L("M32 44V49", cor, 2.4, true);
      if (m.pic === "setasH") c += _L("M22 46H17", cor, 2.2, true) + _L("M42 46H47", cor, 2.2, true);
    }
    return c;
  };
  const asfalto = '<rect x="4" y="4" width="56" height="56" rx="6" fill="#3a3f45"/>';

  switch (m.forma) {
    case "pare":
      return s('<polygon points="22,4 42,4 60,22 60,42 42,60 22,60 4,42 4,22" fill="#c62828"/>' +
        '<polygon points="23.5,8 40.5,8 56,23.5 56,40.5 40.5,56 23.5,56 8,40.5 8,23.5" fill="none" stroke="#fff" stroke-width="2"/>' +
        txt("PARE", 16, "#fff", 38));
    case "preferencia":
      return s('<polygon points="4,8 60,8 32,58" fill="#c62828"/><polygon points="15,14 49,14 32,45" fill="#fff"/>');
    case "proibido":
      return s('<circle cx="32" cy="32" r="28" fill="#c62828"/><rect x="13" y="27" width="38" height="10" fill="#fff"/>');
    case "reg": {
      let c = '<circle cx="32" cy="32" r="27" fill="#fff" stroke="#c62828" stroke-width="5.5"/>' + miolo("#111");
      if (m.barra) c += '<line x1="14.5" y1="14.5" x2="49.5" y2="49.5" stroke="#c62828" stroke-width="5"/>';
      if (m.xis) c += '<line x1="14.5" y1="14.5" x2="49.5" y2="49.5" stroke="#c62828" stroke-width="5"/><line x1="49.5" y1="14.5" x2="14.5" y2="49.5" stroke="#c62828" stroke-width="5"/>';
      return s(c);
    }
    case "adv":
      return s(`<rect x="11" y="11" width="42" height="42" rx="3" transform="rotate(45 32 32)" fill="${m.fluor ? "#c6e000" : "#f2b705"}" stroke="#111" stroke-width="2.5"/>` + miolo("#111"));
    case "cruz":
      return s('<g transform="rotate(45 32 32)"><rect x="6" y="26" width="52" height="12" fill="#fff" stroke="#c62828" stroke-width="3"/><rect x="26" y="6" width="12" height="52" fill="#fff" stroke="#c62828" stroke-width="3"/><rect x="27.5" y="27.5" width="9" height="9" fill="#fff"/></g>');
    case "ind": {
      const cor = m.cor || (m.verde ? "#2e7d32" : "#1565c0");
      const texto = m.texto || "#fff";
      const r = String(m.rot || "");
      const tam = r.length > 8 ? 9 : r.length > 5 ? 11 : 15;
      return s(`<rect x="3" y="16" width="58" height="32" rx="4" fill="${cor}" stroke="#6c757d" stroke-width="1"/><rect x="5.5" y="18.5" width="53" height="27" rx="2.5" fill="none" stroke="${texto}" stroke-width="1.4"/>` +
        txt(r, tam, texto, 36.5));
    }
    case "escudo":
      return s('<path d="M14 10h36v26c0 10-9 16-18 20-9-4-18-10-18-20z" fill="#fff" stroke="#111" stroke-width="2.5"/>' + txt("BR", 13, "#111", 27) + txt("373", 13, "#111", 41));
    case "marco":
      return s('<rect x="20" y="8" width="24" height="48" rx="3" fill="#fff" stroke="#111" stroke-width="2"/><rect x="20" y="8" width="24" height="12" rx="3" fill="#1565c0"/>' + txt("km", 11, "#fff", 18) + txt("152", 13, "#111", 38));
    case "servicoAux":
      return s('<rect x="10" y="10" width="44" height="44" rx="4" fill="#1565c0"/><rect x="16" y="16" width="32" height="32" rx="2" fill="#fff"/><path d="M28 22h8v8h8v8h-8v8h-8v-8h-8v-8h8z" fill="#c62828"/>');
    case "adicional":
      return s('<rect x="6" y="20" width="52" height="24" rx="3" fill="#fff" stroke="#c62828" stroke-width="2.5"/>' + txt("2ª a 6ª", 12, "#111", 30) + txt("8h-18h", 12, "#111", 41));
    case "linha": {
      const c = m.cor === "am" ? "#f2b705" : "#ffffff";
      const faixas = (y0, n, h, gap, x = 22, w = 20) => Array.from({ length: n }, (_, k) => `<rect x="${x}" y="${y0 + k * (h + gap)}" width="${w}" height="${h}" fill="${c}"/>`).join("");
      const t = {
        continua: `<rect x="29" y="4" width="6" height="56" fill="${c}"/>`,
        tracejada: `<rect x="29" y="6" width="6" height="14" fill="${c}"/><rect x="29" y="27" width="6" height="12" fill="${c}"/><rect x="29" y="46" width="6" height="12" fill="${c}"/>`,
        dupla: `<rect x="24" y="4" width="5" height="56" fill="${c}"/><rect x="35" y="4" width="5" height="56" fill="${c}"/>`,
        contSecc: `<rect x="24" y="4" width="5" height="56" fill="${c}"/><rect x="35" y="6" width="5" height="13" fill="${c}"/><rect x="35" y="27" width="5" height="12" fill="${c}"/><rect x="35" y="46" width="5" height="12" fill="${c}"/>`,
        duplaSecc: [6, 27, 46].map((y) => `<rect x="24" y="${y}" width="5" height="12" fill="${c}"/><rect x="35" y="${y}" width="5" height="12" fill="${c}"/>`).join(""),
        bordo: `<rect x="48" y="4" width="5" height="56" fill="${c}"/><rect x="29" y="10" width="4" height="12" fill="#f2b705"/><rect x="29" y="40" width="4" height="12" fill="#f2b705"/>`,
        continuidade: [6, 17, 28, 39, 50].map((y) => `<rect x="29" y="${y}" width="6" height="6" fill="${c}"/>`).join(""),
        exclusiva: `<rect x="20" y="4" width="8" height="56" fill="${c}"/><text x="44" y="36" text-anchor="middle" font-family="Arial" font-weight="700" font-size="9" fill="#fff" transform="rotate(-90 44 32)">ÔNIBUS</text>`,
        preferencial: [6, 27, 46].map((y) => `<rect x="20" y="${y}" width="8" height="12" fill="${c}"/>`).join("") + `<text x="44" y="36" text-anchor="middle" font-family="Arial" font-weight="700" font-size="9" fill="#fff" transform="rotate(-90 44 32)">ÔNIBUS</text>`,
        ciclofaixa: `<rect x="16" y="4" width="32" height="56" fill="#c62828"/><rect x="16" y="4" width="4" height="56" fill="#fff"/><rect x="44" y="4" width="4" height="56" fill="#fff"/>` + PIC.bicicleta("#fff").replace("<g transform=\"translate(0 0)\">", "<g transform=\"translate(8 8) scale(.75)\">"),
        retencao: `<rect x="8" y="27" width="48" height="10" fill="${c}"/>`,
        reducao: faixas(12, 5, 4, 5, 8, 48),
        dePreferencia: [8, 20, 32, 44].map((x) => `<path d="M${x} 26h10l-5 12z" fill="${c}"/>`).join(""),
        zebra: [10, 20, 30, 40, 50].map((x) => `<rect x="${x - 3}" y="10" width="6" height="44" fill="${c}"/>`).join(""),
        paralela: `<rect x="6" y="18" width="52" height="5" fill="${c}"/><rect x="6" y="41" width="52" height="5" fill="${c}"/>`,
        rodociclo: [8, 18, 28, 38, 48].map((x) => `<rect x="${x}" y="18" width="7" height="7" fill="${c}"/><rect x="${x}" y="39" width="7" height="7" fill="${c}"/>`).join(""),
        conflito: `<rect x="10" y="10" width="44" height="44" fill="none" stroke="${c}" stroke-width="3"/><path d="M10 10L54 54M54 10L10 54M10 32L32 10M32 54L54 32M10 32L32 54M32 10L54 32" stroke="${c}" stroke-width="2"/>`,
        cruzExclusiva: `<rect x="10" y="10" width="44" height="44" fill="none" stroke="${c}" stroke-width="3"/><path d="M10 10L54 54M54 10L10 54" stroke="${c}" stroke-width="2.4"/>`,
        ferroviario: `<path d="M12 12L52 52M52 12L12 52" stroke="${c}" stroke-width="5"/><rect x="6" y="56" width="52" height="3" fill="${c}"/><rect x="6" y="5" width="52" height="3" fill="${c}"/>`,
        canalizacao: `<path d="M24 58L24 30L40 6" stroke="${c}" stroke-width="4" fill="none"/><path d="M40 58V30" stroke="${c}" stroke-width="4"/>`,
        zebrado: `<path d="M10 54L32 8 54 54z" fill="none" stroke="${c}" stroke-width="3"/><path d="M20 46l14-14M26 50l16-16M18 38l10-10" stroke="${c}" stroke-width="3"/>`,
        proibicao: `<rect x="8" y="48" width="48" height="8" fill="#9aa4ad"/><rect x="8" y="42" width="48" height="4" fill="${c}"/>`,
        parada: `<rect x="12" y="14" width="40" height="36" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="8 4"/><text x="32" y="37" text-anchor="middle" font-family="Arial" font-weight="700" font-size="11" fill="${c}">ÔNIBUS</text>`,
        vaga: `<rect x="14" y="10" width="36" height="44" fill="none" stroke="${c}" stroke-width="4"/>`,
        seta: `<path d="M32 10l12 14h-7v28h-10V24h-7z" fill="${c}"/>`,
        setaMudanca: `<path d="M24 54V36l12-14h-6l10-12 6 16h-6L30 38v16z" fill="${c}"/>`,
        setaCurva: `<path d="M26 54V30q0-12 12-12h4v-6l10 10-10 10v-6h-4q-4 0-4 4v24z" fill="${c}"/>`,
        simbPreferencia: `<path d="M12 14h40L32 52z" fill="none" stroke="${c}" stroke-width="5"/>`,
        simbCruz: `<path d="M14 14L50 50M50 14L14 50" stroke="${c}" stroke-width="6"/><text x="32" y="58" text-anchor="middle" font-family="Arial" font-weight="700" font-size="8" fill="${c}">R</text>`,
        simbBike: PIC.bicicleta(c),
        simbCiclorrota: PIC.bicicleta(c, 0, 4) + _L("M22 22l10-8 10 8M22 28l10-8 10 8", c, 2.6),
        simbBolsao: `<rect x="10" y="10" width="44" height="44" fill="none" stroke="${c}" stroke-width="3"/>` + `<g transform="translate(6 2) scale(.8)">${PIC.moto(c)}</g>`,
        simbSaude: `<path d="M27 14h10v13h13v10H37v13H27V37H14V27h13z" fill="${c}"/>`,
        simbDef: `<rect x="10" y="10" width="44" height="44" fill="#1565c0"/><circle cx="31" cy="20" r="3.4" fill="#fff"/><path d="M31 25v10h9l4 9M31 30h7" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M26 32a9 9 0 1 0 12 10" stroke="#fff" stroke-width="3" fill="none"/>`,
        simbIdoso: `<text x="32" y="40" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="${c}">60+</text>`,
        simbEletrico: `<path d="M36 8L18 36h12l-4 20 20-30H34z" fill="${c}"/>`,
        legenda: `<text x="32" y="40" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-size="18" fill="${c}">PARE</text>`,
      }[m.tipo] || "";
      return s(asfalto + t);
    }
    case "tacha":
      return s(asfalto + '<rect x="22" y="24" width="20" height="16" rx="3" fill="#eceff1"/><path d="M24 26h7v12h-7z" fill="#e53935"/><path d="M33 26h7v12h-7z" fill="#fafafa" stroke="#b0bec5"/>');
    case "tachao":
      return s(asfalto + '<rect x="14" y="20" width="36" height="24" rx="5" fill="#f2b705"/><path d="M17 24h8v16h-8z" fill="#fff"/><path d="M39 24h8v16h-8z" fill="#fff"/>');
    case "baliza":
      return s('<rect x="27" y="6" width="10" height="52" rx="3" fill="#212121"/><rect x="27" y="12" width="10" height="7" fill="#fff"/><rect x="27" y="24" width="10" height="7" fill="#fff"/><rect x="20" y="56" width="24" height="4" rx="2" fill="#555"/>');
    case "lombada":
      return s(asfalto + '<path d="M6 46c8-22 44-22 52 0z" fill="#5d646b"/><path d="M14 40l6-8 6 8M28 37l4-7 4 7M38 40l6-8 6 8" stroke="#f2b705" stroke-width="3" fill="none"/>');
    case "gradil":
      return s('<rect x="6" y="18" width="52" height="4" fill="#607d8b"/><rect x="6" y="44" width="52" height="4" fill="#607d8b"/>' +
        [8, 18, 28, 38, 48].map((x) => `<rect x="${x}" y="14" width="4" height="40" fill="#78909c"/>`).join(""));
    case "semaforo":
      return s('<rect x="21" y="4" width="22" height="50" rx="5" fill="#212121"/><circle cx="32" cy="15" r="6" fill="#e53935"/><circle cx="32" cy="29" r="6" fill="#fdd835"/><circle cx="32" cy="43" r="6" fill="#43a047"/><rect x="30" y="54" width="4" height="8" fill="#555"/>');
    case "semaforo-ped":
      return s('<rect x="19" y="6" width="26" height="46" rx="5" fill="#212121"/><circle cx="32" cy="19" r="7" fill="#e53935"/><circle cx="32" cy="39" r="7" fill="#43a047"/><rect x="30" y="52" width="4" height="10" fill="#555"/>');
    case "poste":
      return s('<rect x="29" y="4" width="6" height="54" fill="#90a4ae"/><rect x="20" y="58" width="24" height="3" rx="1.5" fill="#607d8b"/><rect x="22" y="10" width="20" height="14" rx="2" fill="none" stroke="#90a4ae" stroke-width="2" stroke-dasharray="3 3"/>');
    case "bracadeira":
      return s('<rect x="29" y="4" width="6" height="56" fill="#90a4ae"/><rect x="22" y="22" width="20" height="8" rx="2" fill="none" stroke="#455a64" stroke-width="3"/><circle cx="20" cy="26" r="2.5" fill="#455a64"/><circle cx="44" cy="26" r="2.5" fill="#455a64"/>');
    case "portico":
      return s('<rect x="10" y="8" width="6" height="52" fill="#90a4ae"/><rect x="10" y="8" width="46" height="6" fill="#90a4ae"/><rect x="34" y="16" width="20" height="14" rx="2" fill="#1565c0"/>');
    case "servico":
      return s('<circle cx="32" cy="32" r="26" fill="#eceff1" stroke="#607d8b" stroke-width="3"/>' + txt(m.rot || "", 24, "#37474f", 41));
    default:
      return s('<rect x="8" y="8" width="48" height="48" rx="6" fill="none" stroke="#78909c" stroke-width="3" stroke-dasharray="6 4"/>' + txt(m.rot || "?", 26, "#546e7a", 42));
  }
}
