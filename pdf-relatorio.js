/* Geração do Relatório Técnico em arquivo PDF, no próprio tablet (sem internet).
 * Usa a biblioteca pdf-lib (licença MIT, em lib/), carregada só quando necessária.
 * O arquivo gerado pode ser enviado pelo menu de compartilhamento do sistema
 * (WhatsApp, e-mail, Google Drive, Salvar em Arquivos etc.) ou salvo no tablet.
 */
"use strict";

let _pdfLibCarregando = null;
function carregarPdfLib() {
  if (window.PDFLib) return Promise.resolve();
  _pdfLibCarregando ??= new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "lib/pdf-lib.min.js";
    s.onload = ok;
    s.onerror = () => { _pdfLibCarregando = null; falha(new Error("Não foi possível carregar o gerador de PDF.")); };
    document.head.appendChild(s);
  });
  return _pdfLibCarregando;
}

// As fontes padrão do PDF (Helvetica) usam a codificação WinAnsi: acentos do português
// funcionam; alguns símbolos precisam ser trocados.
const _WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const _TROCAS = { "→": "->", "←": "<-", "↔": "<->", "−": "-", "≤": "<=", "≥": ">=", "▭": "", " ": " ", " ": " " };
function pdfTexto(t) {
  let r = "";
  for (const c of String(t ?? "")) {
    if (_TROCAS[c] !== undefined) { r += _TROCAS[c]; continue; }
    const k = c.codePointAt(0);
    if (k === 10) r += c;
    else if (k < 32 || (k >= 127 && k < 160)) r += " ";
    else if (k <= 255 || _WINANSI_EXTRA.includes(c)) r += c;
    else r += "?";
  }
  return r;
}

async function gerarPdfRelatorio(v, itens, fotosPorItem, comFotos) {
  await carregarPdfLib();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const cor = (h) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  const C = {
    azul: cor("#1f3864"), azulClaro: cor("#d9e2f3"), cinza: cor("#f2f2f2"), borda: cor("#a6a6a6"),
    tinta: cor("#1a1a1a"), tinta2: cor("#555555"), branco: rgb(1, 1, 1), fundoCroqui: cor("#fafafa"),
  };

  const doc = await PDFDocument.create();
  const geradoEm = new Date();
  doc.setTitle(`Relatório Técnico de Vistoria nº ${v.protocolo} - ${v.logradouro}`);
  doc.setAuthor(config.orgaoUnidade);
  doc.setSubject("Vistoria de sinalização viária");
  doc.setCreator("Vistoria de Campo");
  doc.setProducer("Vistoria de Campo (pdf-lib)");
  doc.setLanguage("pt-BR");
  doc.setCreationDate(geradoEm);
  const F = await doc.embedFont(StandardFonts.Helvetica);
  const FB = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, ML = 42, MR = 42, MT = 82, MB = 52, LW = W - ML - MR;
  let pg, y;
  const paginas = [];

  const larg = (t, f, s) => f.widthOfTextAtSize(t, s);
  const escrever = (t, x, yb, f, s, c = C.tinta) => pg.drawText(t, { x, y: yb, size: s, font: f, color: c });

  function cabecalho() {
    escrever(pdfTexto(config.orgaoEnte), ML, H - 36, FB, 11.5, C.azul);
    escrever(pdfTexto(config.orgaoUf), ML, H - 48, F, 8.5, C.tinta2);
    escrever(pdfTexto(config.orgaoUnidade), ML, H - 59, F, 8.5, C.tinta2);
    const p = pdfTexto(`Nº ${v.protocolo}`);
    escrever(p, W - MR - larg(p, FB, 10.5), H - 36, FB, 10.5, C.azul);
    const t = "Relatório Técnico de Vistoria";
    escrever(t, W - MR - larg(t, F, 8.5), H - 48, F, 8.5, C.tinta2);
    pg.drawLine({ start: { x: ML, y: H - 66 }, end: { x: W - MR, y: H - 66 }, thickness: 1.6, color: C.azul });
  }
  function novaPagina() { pg = doc.addPage([W, H]); paginas.push(pg); cabecalho(); y = H - MT; }
  /** Garante espaço vertical; abre nova página se faltar. Devolve true se abriu. */
  function caber(h) { if (y - h < MB) { novaPagina(); return true; } return false; }

  function quebrar(texto, f, s, w) {
    const saida = [];
    for (const par of pdfTexto(texto).split("\n")) {
      let atual = "";
      for (let p of par.split(/ +/).filter(Boolean)) {
        while (larg(p, f, s) > w) { // palavra maior que a coluna
          let k = p.length;
          while (k > 1 && larg(p.slice(0, k), f, s) > w) k--;
          if (atual) { saida.push(atual); atual = ""; }
          saida.push(p.slice(0, k));
          p = p.slice(k);
        }
        const teste = atual ? `${atual} ${p}` : p;
        if (larg(teste, f, s) <= w) atual = teste;
        else { if (atual) saida.push(atual); atual = p; }
      }
      saida.push(atual);
    }
    return saida;
  }

  function paragrafo(texto, { s = 9.5, f = F, c = C.tinta, alinhar = "justificar", depois = 6 } = {}) {
    const lh = s * 1.4;
    const ls = quebrar(texto, f, s, LW);
    ls.forEach((l, k) => {
      caber(lh);
      y -= lh;
      const ultima = k === ls.length - 1;
      if (alinhar === "justificar" && !ultima && l.includes(" ")) {
        const pal = l.split(" ");
        const esp = (LW - pal.reduce((a, w) => a + larg(w, f, s), 0)) / (pal.length - 1);
        let x = ML;
        for (const w of pal) { escrever(w, x, y, f, s, c); x += larg(w, f, s) + esp; }
      } else {
        const w = larg(l, f, s);
        escrever(l, alinhar === "centro" ? ML + (LW - w) / 2 : ML, y, f, s, c);
      }
    });
    y -= depois;
  }

  function secao(titulo) {
    caber(70); // não deixa título sozinho no pé da página
    y -= 8;
    pg.drawRectangle({ x: ML, y: y - 17, width: LW, height: 17, color: C.azul });
    escrever(pdfTexto(titulo), ML + 6, y - 12.2, FB, 10, C.branco);
    y -= 25;
  }

  /** Tabela com quebra automática de página e repetição do cabeçalho.
   *  colunas: [{t, w, a: "c"|"l"}]; linha: array de células (texto ou {t, sub, b, cor, fill, a}) ou {grupo}. */
  function tabela(colunas, linhas, { s = 7.6, zebra = true, x0 = ML, lw = LW, cabecalhoTab = true, chave = false } = {}) {
    const tot = colunas.reduce((a, c) => a + c.w, 0);
    const ws = colunas.map((c) => (c.w / tot) * lw);
    const pad = 3.2, lh = s * 1.28;
    const base = (topo, j) => topo - j * lh - s * 0.98;
    const desenharCab = () => {
      if (!cabecalhoTab) return;
      const ls = colunas.map((c, i) => quebrar(c.t, FB, s, ws[i] - 2 * pad));
      const alt = Math.max(...ls.map((l) => l.length)) * lh + 2 * pad;
      caber(alt + lh + 2 * pad);
      let x = x0;
      ls.forEach((linhasCab, i) => {
        pg.drawRectangle({ x, y: y - alt, width: ws[i], height: alt, color: C.azul, borderColor: C.borda, borderWidth: 0.5 });
        const topo = y - (alt - linhasCab.length * lh) / 2;
        linhasCab.forEach((l, j) => escrever(l, x + (ws[i] - larg(l, FB, s)) / 2, base(topo, j), FB, s, C.branco));
        x += ws[i];
      });
      y -= alt;
    };
    desenharCab();
    linhas.forEach((ln, idx) => {
      if (ln && ln.grupo) {
        const alt = lh + 2 * pad;
        if (caber(alt)) desenharCab();
        pg.drawRectangle({ x: x0, y: y - alt, width: lw, height: alt, color: C.azulClaro, borderColor: C.borda, borderWidth: 0.5 });
        escrever(pdfTexto(ln.grupo), x0 + pad, base(y - pad, 0), FB, s);
        y -= alt;
        return;
      }
      const cels = ln.map((c, i) => {
        const o = c && typeof c === "object" ? c : { t: c };
        const f = o.b || (chave && i === 0) ? FB : F;
        const w = ws[i] - 2 * pad;
        const linhasTxt = quebrar(o.t ?? "", f, s, w).map((l) => ({ l, f, c: o.cor ? cor(o.cor) : C.tinta }));
        const sub = o.sub ? quebrar(o.sub, F, s, w).map((l) => ({ l, f: F, c: C.tinta2 })) : [];
        return { o, todas: [...linhasTxt, ...sub] };
      });
      const alt = Math.max(...cels.map((c) => c.todas.length)) * lh + 2 * pad;
      if (caber(alt)) desenharCab();
      let x = x0;
      cels.forEach((cel, i) => {
        const fill = cel.o.fill ? cor(cel.o.fill) : chave && i === 0 ? C.azulClaro : zebra && idx % 2 ? C.cinza : null;
        pg.drawRectangle({ x, y: y - alt, width: ws[i], height: alt, ...(fill ? { color: fill } : {}), borderColor: C.borda, borderWidth: 0.5 });
        const topo = y - (alt - cel.todas.length * lh) / 2;
        const a = cel.o.a ?? colunas[i].a;
        cel.todas.forEach((t, j) => {
          const tx = a === "c" ? x + (ws[i] - larg(t.l, t.f, s)) / 2 : x + pad;
          escrever(t.l, tx, base(topo, j), t.f, s, t.c);
        });
        x += ws[i];
      });
      y -= alt;
    });
    y -= 6;
  }

  function nota(texto) { paragrafo(texto, { s: 7.6, c: C.tinta2, alinhar: "esquerda", depois: 4 }); }

  // ------------------------------------------------------------ dados ----
  const mat = (i) => POR_CODIGO[i.materialCodigo] || { cod: i.materialCodigo, mbst: "", desc: "Item", cat: "SERVICO", un: "UN" };
  const total = Math.max(itens.length, 1);
  const pct = (n) => `${nf((100 * n) / total, 1)}%`;
  const cEst = Object.fromEntries(ESTADOS.map((e) => [e[0], 0]));
  itens.forEach((i) => cEst[i.estado]++);
  const cAc = contarAcoes(itens);
  const prec = itens.map((i) => i.precisao).filter((p) => p != null);
  const semGps = itens.filter((i) => i.lat == null).length;

  // ============================================================ conteúdo ==
  novaPagina();
  y -= 4;
  paragrafo("RELATÓRIO TÉCNICO DE VISTORIA DE SINALIZAÇÃO VIÁRIA", { s: 13.5, f: FB, c: C.azul, alinhar: "centro", depois: 0 });
  paragrafo("Levantamento de campo georreferenciado", { s: 9.5, c: C.tinta2, alinhar: "centro", depois: 2 });

  secao("1. IDENTIFICAÇÃO");
  const resp = `${v.vistoriador?.nome || "—"}${v.vistoriador?.matricula ? `, matrícula ${v.vistoriador.matricula}` : ""}${v.vistoriador?.cargo ? ` (${v.vistoriador.cargo})` : ""}`;
  tabela([{ t: "", w: 34 }, { t: "", w: 66 }], [
    ["Logradouro", v.logradouro], ["Bairro", v.bairro || "—"], ["Trecho de referência", v.trecho || "—"],
    ["Município", config.municipio], ["Data da vistoria", dataBr(v.data)], ["Responsável pela coleta", resp],
    ["Situação", v.status === "CONCLUIDA" ? "Concluída" : "Em andamento"], ["Itens levantados", String(itens.length)],
  ], { s: 8.6, zebra: false, cabecalhoTab: false, chave: true });

  secao("2. FUNDAMENTAÇÃO LEGAL E OBJETIVO");
  paragrafo("O presente levantamento é realizado com fundamento na Lei Federal nº 9.503/1997 (Código de Trânsito Brasileiro), em especial no art. 24, inciso III, que atribui aos órgãos e entidades executivos de trânsito dos Municípios a competência para implantar, manter e operar o sistema de sinalização; no art. 80, segundo o qual a sinalização deve observar os padrões estabelecidos pelo CONTRAN; e no art. 90, § 1º, que imputa ao órgão com circunscrição sobre a via a responsabilidade pela sua implantação e conservação. Os padrões técnicos de referência são os do Manual Brasileiro de Sinalização de Trânsito (MBST), consolidado pela Resolução CONTRAN nº 973/2022.");
  paragrafo("O objetivo é registrar o inventário georreferenciado da sinalização existente, seu estado de conservação e as intervenções recomendadas, subsidiando o planejamento da contratação nos termos da Lei Federal nº 14.133/2021, notadamente a elaboração do Estudo Técnico Preliminar (art. 6º, inciso XX, e art. 18, § 1º), do Termo de Referência (art. 6º, inciso XXIII) e da estimativa do valor da contratação (art. 23).");

  secao("3. SÍNTESE DO LEVANTAMENTO");
  caber(110);
  const yIni = y, meia = (LW - 12) / 2;
  tabela([{ t: "Estado de conservação", w: 56 }, { t: "Itens", w: 20, a: "c" }, { t: "%", w: 24, a: "c" }],
    ESTADOS.map(([c, r]) => [r, String(cEst[c]), pct(cEst[c])]), { s: 8, x0: ML, lw: meia });
  const yEsq = y;
  y = yIni;
  tabela([{ t: "Ação recomendada", w: 56 }, { t: "Itens", w: 20, a: "c" }, { t: "%", w: 24, a: "c" }],
    ACOES.map(([c, r]) => [r, String(cAc[c]), pct(cAc[c])]), { s: 8, x0: ML + meia + 12, lw: meia });
  y = Math.min(y, yEsq);
  nota(prec.length
    ? `Precisão horizontal do GPS informada pelo aparelho: média de ${nf(prec.reduce((a, b) => a + b, 0) / prec.length, 1)} m (mínima ${nf(Math.min(...prec), 1)} m; máxima ${nf(Math.max(...prec), 1)} m). Sistema de referência: WGS 84 (EPSG:4326).${semGps ? ` ${semGps} item(ns) sem coordenada.` : ""}`
    : "Nenhum item com coordenada GPS.");

  // ------------------------------------------------------------ croqui ----
  const altC = 200;
  caber(altC + 60); // título e croqui na mesma página
  secao("4. CROQUI DE LOCALIZAÇÃO DOS ITENS");
  const bx = ML, by = y - altC;
  pg.drawRectangle({ x: bx, y: by, width: LW, height: altC, color: C.fundoCroqui, borderColor: C.borda, borderWidth: 0.5 });
  const comGps = itens.map((i, k) => ({ ...i, n: k + 1 })).filter((i) => i.lat != null);
  if (comGps.length) {
    const lat0 = comGps.reduce((s, i) => s + i.lat, 0) / comGps.length;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
    const xs = comGps.map((i) => i.lon * kx), ys = comGps.map((i) => i.lat * ky);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const pad = 22, rodape = 16;
    const esc_ = Math.min((LW - 2 * pad) / Math.max(maxx - minx, 20), (altC - 2 * pad - rodape) / Math.max(maxy - miny, 20));
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const P = (x, yy) => [bx + LW / 2 + (x - cx) * esc_, by + rodape + (altC - rodape) / 2 + (yy - cy) * esc_];
    const pts = comGps.map((i, k) => [...P(xs[k], ys[k]), i]);
    const ocupados = pts.map(([x, yy]) => [x - 6, yy - 6, x + 6, yy + 6]);
    const livre = (a) => ocupados.every((b) => a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
    for (const [x, yy, i] of pts) pg.drawCircle({ x, y: yy, size: 5.2, color: cor(COR_ACAO[i.acao]), borderColor: C.branco, borderWidth: 1.2 });
    for (const [x, yy, i] of pts) {
      const t = String(i.n), tw = larg(t, FB, 8);
      const cand = [[7, 2], [7, -9], [-7 - tw, 2], [-7 - tw, -9], [-tw / 2, 8], [-tw / 2, -15]];
      let [dx, dy] = cand[0];
      for (const [a, b] of cand) { if (livre([x + a, yy + b, x + a + tw, yy + b + 8])) { dx = a; dy = b; break; } }
      ocupados.push([x + dx, yy + dy, x + dx + tw, yy + dy + 8]);
      pg.drawRectangle({ x: x + dx - 1, y: yy + dy - 1.5, width: tw + 2, height: 9, color: C.branco, opacity: 0.8 });
      escrever(t, x + dx, yy + dy, FB, 8);
    }
    // Norte e escala
    pg.drawSvgPath("M0 0 L6 15 L-6 15 Z", { x: bx + LW - 18, y: by + altC - 10, color: C.tinta });
    escrever("N", bx + LW - 21, by + altC - 36, FB, 8.5);
    const alvo = (LW * 0.22) / esc_;
    const pot = 10 ** Math.floor(Math.log10(alvo));
    const metros = [5, 2, 1].map((b) => b * pot).find((m) => m <= alvo) || pot;
    const comp = metros * esc_;
    const ex = bx + pad, ey = by + 9;
    pg.drawLine({ start: { x: ex, y: ey }, end: { x: ex + comp, y: ey }, thickness: 1.2, color: C.tinta });
    pg.drawLine({ start: { x: ex, y: ey - 3 }, end: { x: ex, y: ey + 3 }, thickness: 1.2, color: C.tinta });
    pg.drawLine({ start: { x: ex + comp, y: ey - 3 }, end: { x: ex + comp, y: ey + 3 }, thickness: 1.2, color: C.tinta });
    escrever(`${nf(metros, 0)} m`, ex + comp + 5, ey - 3, F, 8);
  } else {
    const t = "Itens sem coordenadas GPS.";
    escrever(t, bx + (LW - larg(t, F, 9)) / 2, by + altC / 2, F, 9, C.tinta2);
  }
  y = by - 4;
  // Legenda de cores
  caber(14);
  let lx = ML;
  y -= 10;
  escrever("Cores:", lx, y, F, 7.6, C.tinta2);
  lx += larg("Cores:", F, 7.6) + 6;
  for (const [c, r, hx] of ACOES) {
    if (!cAc[c]) continue;
    pg.drawCircle({ x: lx + 3.5, y: y + 2.6, size: 3.5, color: cor(hx) });
    escrever(r, lx + 10, y, F, 7.6, C.tinta2);
    lx += 10 + larg(r, F, 7.6) + 10;
  }
  y -= 4;
  nota("Croqui esquemático, sem base cartográfica, gerado a partir das coordenadas coletadas. A numeração corresponde à coluna \"Nº\" do inventário.");

  // --------------------------------------------------------- inventário ----
  secao("5. INVENTÁRIO GEORREFERENCIADO");
  tabela([
    { t: "Nº", w: 4, a: "c" }, { t: "Código", w: 7.5, a: "c" }, { t: "Descrição / observação", w: 30 },
    { t: "Estado", w: 9, a: "c" }, { t: "Ação", w: 10.5, a: "c" }, { t: "Qtd.", w: 6, a: "c" },
    { t: "Un.", w: 4.5, a: "c" }, { t: "Latitude / Longitude", w: 13, a: "c" }, { t: "Prec. (m)", w: 6, a: "c" },
  ], itens.map((i, k) => {
    const m = mat(i);
    const extras = [i.lado ? `Lado: ${ROT_LADO[i.lado].toLowerCase()}` : "", i.observacao || ""].filter(Boolean).join(". ");
    return [String(k + 1), { t: m.mbst || m.cod, b: true }, { t: m.desc, b: true, sub: extras || null },
      ROT_ESTADO[i.estado], { t: ROT_ACAO[i.acao], b: true, cor: COR_ACAO[i.acao] }, qtd(i.quantidade), UNIDADE[m.un],
      i.lat == null ? "sem GPS" : `${coord(i.lat)}\n${coord(i.lon)}`, i.precisao == null ? "—" : nf(i.precisao, 1)];
  }));

  // -------------------------------------------------------- quantitativo ----
  secao("6. QUANTITATIVO ESTIMADO DE INTERVENÇÕES");
  const agreg = new Map();
  for (const i of itens) {
    if (!["IMPLANTAR", "SUBSTITUIR", "REVITALIZAR", "REPOSICIONAR"].includes(i.acao)) continue;
    const chave = `${i.materialCodigo}|${i.acao}`;
    const a = agreg.get(chave) || { m: mat(i), acao: i.acao, q: 0 };
    a.q += Number(i.quantidade);
    agreg.set(chave, a);
  }
  const ordemCat = CATEGORIAS.map((c) => c[0]);
  const quant = [...agreg.values()].sort((a, b) => ordemCat.indexOf(a.m.cat) - ordemCat.indexOf(b.m.cat) ||
    (ORDEM_CATALOGO[a.m.cod] ?? 9999) - (ORDEM_CATALOGO[b.m.cod] ?? 9999) || a.acao.localeCompare(b.acao));
  if (quant.length) {
    const linhasQ = [];
    let catAtual = null;
    for (const q of quant) {
      if (q.m.cat !== catAtual) { catAtual = q.m.cat; linhasQ.push({ grupo: GRUPO_RELATORIO[catAtual] || catAtual }); }
      linhasQ.push([volumeMbst(q.m) || "—", q.m.mbst || q.m.cod, q.m.desc, ROT_ACAO[q.acao], UNIDADE[q.m.un], qtd(Math.round(q.q * 100) / 100)]);
    }
    tabela([{ t: "MBST", w: 7, a: "c" }, { t: "Código", w: 9, a: "c" }, { t: "Descrição", w: 47 },
      { t: "Ação", w: 13, a: "c" }, { t: "Un.", w: 7, a: "c" }, { t: "Quantidade", w: 12, a: "c" }], linhasQ, { zebra: false });
    const vols = [...new Set(quant.map((q) => volumeMbst(q.m)).filter(Boolean))].sort((a, b) => Object.keys(VOLUME_MBST).indexOf(a) - Object.keys(VOLUME_MBST).indexOf(b));
    nota(`Quantitativo restrito às ações Implantar, Substituir, Revitalizar e Reposicionar. A estimativa de valor da contratação deverá ser obtida mediante pesquisa de preços (art. 23 da Lei nº 14.133/2021).${vols.length ? ` Coluna MBST: volume do Manual Brasileiro de Sinalização de Trânsito (Res. CONTRAN nº 973/2022): ${vols.map((x) => VOLUME_MBST[x]).join("; ")}.` : ""}`);
  } else {
    paragrafo("Não foram identificados itens que demandem intervenção.");
  }

  // ------------------------------------------------ registro fotográfico ----
  let sec = 6, nFotos = 0;
  if (comFotos) {
    const lista = [];
    for (const f of fotosPorItem[GERAIS] || []) {
      lista.push({ f, legenda: `Foto ${lista.length + 1}, vista geral${f.legenda ? `: ${f.legenda}` : "."}`,
        sub: `${dataHoraBr(f.capturadaEm)}${f.lat != null ? `, ${coord(f.lat)}; ${coord(f.lon)}` : ""}` });
    }
    itens.forEach((i, k) => {
      for (const f of fotosPorItem[i.id] || []) {
        const m = mat(i);
        lista.push({ f, legenda: `Foto ${lista.length + 1}, item nº ${k + 1} (${m.mbst || m.cod}), ${ROT_ACAO[i.acao].toLowerCase()}.`,
          sub: `${dataHoraBr(f.capturadaEm)}${i.lat != null ? `, ${coord(i.lat)}; ${coord(i.lon)}` : ""}` });
      }
    });
    if (lista.length) {
      secao(`${++sec}. REGISTRO FOTOGRÁFICO`);
      const gap = 12, cw = (LW - gap) / 2, ih = 168, s = 7.6, lh = s * 1.3;
      for (let k = 0; k < lista.length; k += 2) {
        const par = lista.slice(k, k + 2);
        const caps = par.map((p) => [...quebrar(p.legenda, FB, s, cw - 8), ...quebrar(p.sub, F, s, cw - 8)]);
        const rowH = 4 + ih + 4 + Math.max(...caps.map((c) => c.length)) * lh + 4;
        caber(rowH + 8);
        for (let j = 0; j < par.length; j++) {
          const x = ML + j * (cw + gap);
          pg.drawRectangle({ x, y: y - rowH, width: cw, height: rowH, borderColor: C.borda, borderWidth: 0.5 });
          pg.drawRectangle({ x: x + 4, y: y - 4 - ih, width: cw - 8, height: ih, color: cor("#f4f4f4") });
          try {
            const bytes = new Uint8Array(await par[j].f.blob.arrayBuffer());
            const img = par[j].f.blob.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
            const esc = Math.min((cw - 8) / img.width, ih / img.height);
            const iw = img.width * esc, ihh = img.height * esc;
            pg.drawImage(img, { x: x + 4 + (cw - 8 - iw) / 2, y: y - 4 - ih + (ih - ihh) / 2, width: iw, height: ihh });
          } catch {
            escrever("Foto indisponível", x + 10, y - 20, F, 8, C.tinta2);
          }
          let yc = y - 4 - ih - 4;
          caps[j].forEach((l, n) => {
            const f = n < quebrar(par[j].legenda, FB, s, cw - 8).length ? FB : F;
            yc -= lh;
            escrever(l, x + (cw - larg(l, f, s)) / 2, yc + 2, f, s, f === FB ? C.tinta : C.tinta2);
          });
          nFotos++;
        }
        y -= rowH + 10;
      }
    }
  }

  // ---------------------------------------------- observações e fecho ----
  secao(`${++sec}. OBSERVAÇÕES GERAIS`);
  paragrafo(v.observacoes || "Sem observações adicionais.");
  secao(`${++sec}. ENCERRAMENTO`);
  paragrafo(`Nada mais havendo a registrar, encerra-se o presente relatório, composto de ${itens.length} item(ns) inventariado(s) e ${nFotos} registro(s) fotográfico(s), que segue assinado pela Chefia do Departamento.`);
  paragrafo(`${config.municipio}, ${geradoEm.toLocaleDateString("pt-BR")}.`, { alinhar: "esquerda" });
  caber(96);
  y -= 52;
  pg.drawLine({ start: { x: ML + LW * 0.2, y }, end: { x: ML + LW * 0.8, y }, thickness: 0.8, color: C.tinta });
  y -= 2;
  if (config.chefeNome) paragrafo(config.chefeNome, { s: 9.5, f: FB, alinhar: "centro", depois: 0 });
  paragrafo(config.chefeCargo || "Chefe do Departamento", { s: 8.8, alinhar: "centro", depois: 0 });
  if (!String(config.chefeCargo || "").includes(config.orgaoUnidade)) paragrafo(config.orgaoUnidade, { s: 8.8, alinhar: "centro", depois: 0 });

  // ------------------------------------------------- rodapé paginado ----
  const rod = pdfTexto(`Relatório Técnico de Vistoria nº ${v.protocolo} — gerado pelo aplicativo Vistoria de Campo em ${geradoEm.toLocaleString("pt-BR")}`);
  paginas.forEach((p, k) => {
    p.drawLine({ start: { x: ML, y: 36 }, end: { x: W - MR, y: 36 }, thickness: 0.5, color: C.borda });
    p.drawText(rod, { x: ML, y: 25, size: 7, font: F, color: C.tinta2 });
    const t = `Página ${k + 1} de ${paginas.length}`;
    p.drawText(t, { x: W - MR - larg(t, F, 7), y: 25, size: 7, font: F, color: C.tinta2 });
  });

  return new Blob([await doc.save()], { type: "application/pdf" });
}
