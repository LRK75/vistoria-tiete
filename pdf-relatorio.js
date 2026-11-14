/* Geração de documentos em PDF no próprio tablet (sem internet).
 * Usa a biblioteca pdf-lib (licença MIT, em lib/), carregada só quando necessária.
 * - motorPdf: paginação, cabeçalho, rodapé, parágrafos, tabelas, fotos e assinatura;
 * - gerarPdfRelatorio: Relatório Técnico de Vistoria (com croqui);
 * - renderModeloPdf: documentos descritos como lista de blocos (relatório ao Secretário).
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
const _TROCAS = { "☐": "[\u00a0\u00a0\u00a0\u00a0]", "→": "->", "←": "<-", "↔": "<->", "−": "-", "≤": "<=", "≥": ">=", "▭": "", " ": " ", " ": " " };
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

/** Cria um documento A4 com cabeçalho institucional e devolve as ferramentas de diagramação. */
async function motorPdf({ titulo, assunto, numero, rotulo, rodape }) {
  await carregarPdfLib();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const cor = (h) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  const C = {
    azul: cor("#1f3864"), azulClaro: cor("#d9e2f3"), cinza: cor("#f2f2f2"), borda: cor("#a6a6a6"),
    tinta: cor("#1a1a1a"), tinta2: cor("#555555"), branco: rgb(1, 1, 1), fundoCroqui: cor("#fafafa"),
  };
  const doc = await PDFDocument.create();
  const geradoEm = new Date();
  doc.setTitle(pdfTexto(titulo));
  doc.setAuthor(pdfTexto(config.orgaoUnidade));
  doc.setSubject(pdfTexto(assunto));
  doc.setCreator("Vistoria de Campo");
  doc.setProducer("Vistoria de Campo (pdf-lib)");
  doc.setLanguage("pt-BR");
  doc.setCreationDate(geradoEm);
  const F = await doc.embedFont(StandardFonts.Helvetica);
  const FB = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, ML = 50, MR = 42, MT = 82, MB = 52, LW = W - ML - MR;
  const paginas = [];
  const E = { doc, F, FB, C, cor, W, H, ML, MR, LW, geradoEm, pg: null, y: 0 };

  const larg = (t, f, s) => f.widthOfTextAtSize(t, s);
  const escrever = (t, x, yb, f, s, c = C.tinta) => E.pg.drawText(t, { x, y: yb, size: s, font: f, color: c });

  function cabecalho() {
    escrever(pdfTexto(config.orgaoEnte), ML, H - 36, FB, 11.5, C.azul);
    escrever(pdfTexto(config.orgaoUf), ML, H - 48, F, 8.5, C.tinta2);
    escrever(pdfTexto(config.orgaoUnidade), ML, H - 59, F, 8.5, C.tinta2);
    const p = pdfTexto(numero);
    escrever(p, W - MR - larg(p, FB, 10.5), H - 36, FB, 10.5, C.azul);
    const t = pdfTexto(rotulo);
    escrever(t, W - MR - larg(t, F, 8.5), H - 48, F, 8.5, C.tinta2);
    E.pg.drawLine({ start: { x: ML, y: H - 66 }, end: { x: W - MR, y: H - 66 }, thickness: 1.6, color: C.azul });
  }
  function novaPagina() { E.pg = doc.addPage([W, H]); paginas.push(E.pg); cabecalho(); E.y = H - MT; }
  /** Garante espaço vertical; abre nova página se faltar. Devolve true se abriu. */
  function caber(h) { if (E.y - h < MB) { novaPagina(); return true; } return false; }

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

  function paragrafo(texto, { s = 9.5, f = F, c = C.tinta, alinhar = "justificar", depois = 6, recuo = 0, x0 = ML, lw = LW } = {}) {
    const lh = s * 1.4;
    const ls = quebrar(texto, f, s, lw - recuo);
    ls.forEach((l, k) => {
      caber(lh);
      E.y -= lh;
      const ultima = k === ls.length - 1;
      const xi = x0 + recuo, wl = lw - recuo;
      if (alinhar === "justificar" && !ultima && l.includes(" ")) {
        const pal = l.split(" ");
        const esp = (wl - pal.reduce((a, w) => a + larg(w, f, s), 0)) / (pal.length - 1);
        let x = xi;
        for (const w of pal) { escrever(w, x, E.y, f, s, c); x += larg(w, f, s) + esp; }
      } else {
        const w = larg(l, f, s);
        escrever(l, alinhar === "centro" ? xi + (wl - w) / 2 : xi, E.y, f, s, c);
      }
    });
    E.y -= depois;
  }

  function secao(titulo, minimo = 70) {
    caber(minimo); // não deixa título sozinho no pé da página
    E.y -= 8;
    E.pg.drawRectangle({ x: ML, y: E.y - 17, width: LW, height: 17, color: C.azul });
    escrever(pdfTexto(titulo), ML + 6, E.y - 12.2, FB, 10, C.branco);
    E.y -= 25;
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
        E.pg.drawRectangle({ x, y: E.y - alt, width: ws[i], height: alt, color: C.azul, borderColor: C.borda, borderWidth: 0.5 });
        const topo = E.y - (alt - linhasCab.length * lh) / 2;
        linhasCab.forEach((l, j) => escrever(l, x + (ws[i] - larg(l, FB, s)) / 2, base(topo, j), FB, s, C.branco));
        x += ws[i];
      });
      E.y -= alt;
    };
    desenharCab();
    linhas.forEach((ln, idx) => {
      if (ln && ln.grupo) {
        const alt = lh + 2 * pad;
        if (caber(alt)) desenharCab();
        E.pg.drawRectangle({ x: x0, y: E.y - alt, width: lw, height: alt, color: C.azulClaro, borderColor: C.borda, borderWidth: 0.5 });
        escrever(pdfTexto(ln.grupo), x0 + pad, base(E.y - pad, 0), FB, s);
        E.y -= alt;
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
        E.pg.drawRectangle({ x, y: E.y - alt, width: ws[i], height: alt, ...(fill ? { color: fill } : {}), borderColor: C.borda, borderWidth: 0.5 });
        const topo = E.y - (alt - cel.todas.length * lh) / 2;
        const a = cel.o.a ?? colunas[i].a;
        cel.todas.forEach((t, j) => {
          const tx = a === "c" ? x + (ws[i] - larg(t.l, t.f, s)) / 2 : x + pad;
          escrever(t.l, tx, base(topo, j), t.f, s, t.c);
        });
        x += ws[i];
      });
      E.y -= alt;
    });
    E.y -= 6;
  }

  function nota(texto) { paragrafo(texto, { s: 7.6, c: C.tinta2, alinhar: "esquerda", depois: 4 }); }

  /** Grade de fotos em duas colunas. lista: [{blob, legenda, sub}]. Devolve quantas entraram. */
  async function fotos(lista) {
    const gap = 12, cw = (LW - gap) / 2, ih = 168, s = 7.6, lh = s * 1.3;
    let n = 0;
    for (let k = 0; k < lista.length; k += 2) {
      const par = lista.slice(k, k + 2);
      const caps = par.map((p) => {
        const leg = quebrar(p.legenda, FB, s, cw - 8);
        return { leg: leg.length, linhas: [...leg, ...(p.sub ? quebrar(p.sub, F, s, cw - 8) : [])] };
      });
      const rowH = 4 + ih + 4 + Math.max(...caps.map((c) => c.linhas.length)) * lh + 4;
      caber(rowH + 8);
      for (let j = 0; j < par.length; j++) {
        const x = ML + j * (cw + gap);
        E.pg.drawRectangle({ x, y: E.y - rowH, width: cw, height: rowH, borderColor: C.borda, borderWidth: 0.5 });
        E.pg.drawRectangle({ x: x + 4, y: E.y - 4 - ih, width: cw - 8, height: ih, color: cor("#f4f4f4") });
        try {
          const bytes = new Uint8Array(await par[j].blob.arrayBuffer());
          const img = par[j].blob.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const esc = Math.min((cw - 8) / img.width, ih / img.height);
          const iw = img.width * esc, ihh = img.height * esc;
          E.pg.drawImage(img, { x: x + 4 + (cw - 8 - iw) / 2, y: E.y - 4 - ih + (ih - ihh) / 2, width: iw, height: ihh });
        } catch {
          escrever("Foto indisponível", x + 10, E.y - 20, F, 8, C.tinta2);
        }
        let yc = E.y - 4 - ih - 4;
        caps[j].linhas.forEach((l, q) => {
          const f = q < caps[j].leg ? FB : F;
          yc -= lh;
          escrever(l, x + (cw - larg(l, f, s)) / 2, yc + 2, f, s, f === FB ? C.tinta : C.tinta2);
        });
        n++;
      }
      E.y -= rowH + 10;
    }
    return n;
  }

  /** Assinatura única, centralizada. */
  function assinatura(nome, cargo, unidade) {
    caber(96);
    E.y -= 52;
    E.pg.drawLine({ start: { x: ML + LW * 0.2, y: E.y }, end: { x: ML + LW * 0.8, y: E.y }, thickness: 0.8, color: C.tinta });
    E.y -= 2;
    if (nome) paragrafo(nome, { s: 9.5, f: FB, alinhar: "centro", depois: 0 });
    paragrafo(cargo, { s: 8.8, alinhar: "centro", depois: 0 });
    if (unidade && !String(cargo || "").includes(unidade)) paragrafo(unidade, { s: 8.8, alinhar: "centro", depois: 0 });
  }

  /** Várias assinaturas em duas colunas. lista: [{rotulo, nome, cargo}]. */
  function assinaturas(lista) {
    const cw = (LW - 30) / 2;
    for (let k = 0; k < lista.length; k += 2) {
      caber(80);
      E.y -= 40;
      const yLinha = E.y;
      let menor = yLinha;
      lista.slice(k, k + 2).forEach((a, j) => {
        const x0 = ML + j * (cw + 30);
        E.pg.drawLine({ start: { x: x0, y: yLinha }, end: { x: x0 + cw, y: yLinha }, thickness: 0.8, color: C.tinta });
        E.y = yLinha - 2;
        if (a.rotulo) paragrafo(a.rotulo, { s: 7.6, c: C.tinta2, alinhar: "centro", depois: 0, x0, lw: cw });
        paragrafo(a.nome || " ", { s: 9, f: FB, alinhar: "centro", depois: 0, x0, lw: cw });
        if (a.cargo) paragrafo(a.cargo, { s: 8.2, alinhar: "centro", depois: 0, x0, lw: cw });
        menor = Math.min(menor, E.y);
      });
      E.y = menor - 6;
    }
  }

  /** Rodapé paginado e arquivo final. */
  async function finalizar() {
    const rod = pdfTexto(rodape);
    paginas.forEach((p, k) => {
      p.drawLine({ start: { x: ML, y: 36 }, end: { x: W - MR, y: 36 }, thickness: 0.5, color: C.borda });
      p.drawText(rod, { x: ML, y: 25, size: 7, font: F, color: C.tinta2 });
      const t = `Página ${k + 1} de ${paginas.length}`;
      p.drawText(t, { x: W - MR - larg(t, F, 7), y: 25, size: 7, font: F, color: C.tinta2 });
    });
    return new Blob([await doc.save()], { type: "application/pdf" });
  }

  Object.assign(E, { larg, escrever, novaPagina, caber, quebrar, paragrafo, secao, tabela, nota, fotos, assinatura, assinaturas, finalizar });
  novaPagina();
  return E;
}

// ======================================================================
// Relatório Técnico de Vistoria
// ======================================================================
async function gerarPdfRelatorio(v, itens, fotosPorItem, comFotos) {
  const E = await motorPdf({
    titulo: `Relatório Técnico de Vistoria nº ${v.protocolo} - ${v.logradouro}`,
    assunto: "Vistoria de sinalização viária",
    numero: `Nº ${v.protocolo}`, rotulo: "Relatório Técnico de Vistoria",
    rodape: `Relatório Técnico de Vistoria nº ${v.protocolo} — gerado pelo aplicativo Vistoria de Campo em ${new Date().toLocaleString("pt-BR")}`,
  });
  const { F, FB, C, cor, ML, LW, larg, escrever, caber, paragrafo, secao, tabela, nota } = E;

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
  E.y -= 4;
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
  const yIni = E.y, meia = (LW - 12) / 2;
  tabela([{ t: "Estado de conservação", w: 56 }, { t: "Itens", w: 20, a: "c" }, { t: "%", w: 24, a: "c" }],
    ESTADOS.map(([c, r]) => [r, String(cEst[c]), pct(cEst[c])]), { s: 8, x0: ML, lw: meia });
  const yEsq = E.y;
  E.y = yIni;
  tabela([{ t: "Ação recomendada", w: 56 }, { t: "Itens", w: 20, a: "c" }, { t: "%", w: 24, a: "c" }],
    ACOES.map(([c, r]) => [r, String(cAc[c]), pct(cAc[c])]), { s: 8, x0: ML + meia + 12, lw: meia });
  E.y = Math.min(E.y, yEsq);
  nota(prec.length
    ? `Precisão horizontal do GPS informada pelo aparelho: média de ${nf(prec.reduce((a, b) => a + b, 0) / prec.length, 1)} m (mínima ${nf(Math.min(...prec), 1)} m; máxima ${nf(Math.max(...prec), 1)} m). Sistema de referência: WGS 84 (EPSG:4326).${semGps ? ` ${semGps} item(ns) sem coordenada.` : ""}`
    : "Nenhum item com coordenada GPS.");

  // ------------------------------------------------------------ croqui ----
  const altC = 200;
  caber(altC + 60); // título e croqui na mesma página
  secao("4. CROQUI DE LOCALIZAÇÃO DOS ITENS");
  const bx = ML, by = E.y - altC;
  E.pg.drawRectangle({ x: bx, y: by, width: LW, height: altC, color: C.fundoCroqui, borderColor: C.borda, borderWidth: 0.5 });
  const comGps = itens.map((i, k) => ({ ...i, n: k + 1 })).filter((i) => i.lat != null);
  if (comGps.length) {
    const lat0 = comGps.reduce((s, i) => s + i.lat, 0) / comGps.length;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
    const xs = comGps.map((i) => i.lon * kx), ys = comGps.map((i) => i.lat * ky);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const pad = 22, rodapeC = 16;
    const esc_ = Math.min((LW - 2 * pad) / Math.max(maxx - minx, 20), (altC - 2 * pad - rodapeC) / Math.max(maxy - miny, 20));
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const P = (x, yy) => [bx + LW / 2 + (x - cx) * esc_, by + rodapeC + (altC - rodapeC) / 2 + (yy - cy) * esc_];
    const pts = comGps.map((i, k) => [...P(xs[k], ys[k]), i]);
    const ocupados = pts.map(([x, yy]) => [x - 6, yy - 6, x + 6, yy + 6]);
    const livre = (a) => ocupados.every((b) => a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
    for (const [x, yy, i] of pts) E.pg.drawCircle({ x, y: yy, size: 5.2, color: cor(COR_ACAO[i.acao]), borderColor: C.branco, borderWidth: 1.2 });
    for (const [x, yy, i] of pts) {
      const t = String(i.n), tw = larg(t, FB, 8);
      const cand = [[7, 2], [7, -9], [-7 - tw, 2], [-7 - tw, -9], [-tw / 2, 8], [-tw / 2, -15]];
      let [dx, dy] = cand[0];
      for (const [a, b] of cand) { if (livre([x + a, yy + b, x + a + tw, yy + b + 8])) { dx = a; dy = b; break; } }
      ocupados.push([x + dx, yy + dy, x + dx + tw, yy + dy + 8]);
      E.pg.drawRectangle({ x: x + dx - 1, y: yy + dy - 1.5, width: tw + 2, height: 9, color: C.branco, opacity: 0.8 });
      escrever(t, x + dx, yy + dy, FB, 8);
    }
    // Norte e escala
    E.pg.drawSvgPath("M0 0 L6 15 L-6 15 Z", { x: bx + LW - 18, y: by + altC - 10, color: C.tinta });
    escrever("N", bx + LW - 21, by + altC - 36, FB, 8.5);
    const alvo = (LW * 0.22) / esc_;
    const pot = 10 ** Math.floor(Math.log10(alvo));
    const metros = [5, 2, 1].map((b) => b * pot).find((m) => m <= alvo) || pot;
    const comp = metros * esc_;
    const ex = bx + pad, ey = by + 9;
    E.pg.drawLine({ start: { x: ex, y: ey }, end: { x: ex + comp, y: ey }, thickness: 1.2, color: C.tinta });
    E.pg.drawLine({ start: { x: ex, y: ey - 3 }, end: { x: ex, y: ey + 3 }, thickness: 1.2, color: C.tinta });
    E.pg.drawLine({ start: { x: ex + comp, y: ey - 3 }, end: { x: ex + comp, y: ey + 3 }, thickness: 1.2, color: C.tinta });
    escrever(`${nf(metros, 0)} m`, ex + comp + 5, ey - 3, F, 8);
  } else {
    const t = "Itens sem coordenadas GPS.";
    escrever(t, bx + (LW - larg(t, F, 9)) / 2, by + altC / 2, F, 9, C.tinta2);
  }
  E.y = by - 4;
  caber(14);
  let lx = ML;
  E.y -= 10;
  escrever("Cores:", lx, E.y, F, 7.6, C.tinta2);
  lx += larg("Cores:", F, 7.6) + 6;
  for (const [c, r, hx] of ACOES) {
    if (!cAc[c]) continue;
    E.pg.drawCircle({ x: lx + 3.5, y: E.y + 2.6, size: 3.5, color: cor(hx) });
    escrever(r, lx + 10, E.y, F, 7.6, C.tinta2);
    lx += 10 + larg(r, F, 7.6) + 10;
  }
  E.y -= 4;
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
  const quant = quantitativoVistoria(itens);
  if (quant.linhas.length) {
    tabela(COLUNAS_QUANT, quant.linhas, { zebra: false });
    nota(quant.nota);
  } else {
    paragrafo("Não foram identificados itens que demandem intervenção.");
  }

  // ------------------------------------------------ registro fotográfico ----
  let sec = 6, nFotos = 0;
  if (comFotos) {
    const lista = listaFotosRelatorio(itens, fotosPorItem);
    if (lista.length) {
      secao(`${++sec}. REGISTRO FOTOGRÁFICO`);
      nFotos = await E.fotos(lista);
    }
  }

  // ------------------------------------- providências e fundamento legal ----
  secao(`${++sec}. PROVIDÊNCIAS INDICADAS E FUNDAMENTO LEGAL`);
  const prov = tabelaProvidencias(itens);
  if (prov.linhas.length) {
    tabela(prov.colunas, prov.linhas, { s: 7.4 });
    nota(prov.nota);
  } else {
    paragrafo("Todos os itens vistoriados encontram-se em bom estado. Recomenda-se mantê-los na inspeção periódica da sinalização.");
  }

  // ---------------------------------------------- observações e fecho ----
  secao(`${++sec}. OBSERVAÇÕES GERAIS`);
  paragrafo(v.observacoes || "Sem observações adicionais.");
  secao(`${++sec}. ENCERRAMENTO`);
  paragrafo(`Nada mais havendo a registrar, encerra-se o presente relatório, composto de ${itens.length} item(ns) inventariado(s) e ${nFotos} registro(s) fotográfico(s), que segue assinado pela Chefia do Departamento.`);
  paragrafo(`${config.municipio}, ${E.geradoEm.toLocaleDateString("pt-BR")}.`, { alinhar: "esquerda" });
  E.assinatura(config.chefeNome, config.chefeCargo || "Chefe do Departamento", config.orgaoUnidade);
  return E.finalizar();
}

// ======================================================================
// Documento descrito por blocos (o mesmo modelo gera PDF, Word e a prévia em tela)
// ======================================================================
async function renderModeloPdf(modelo) {
  const E = await motorPdf(modelo.meta);
  const { FB, C } = E;
  for (const b of modelo.blocos) {
    switch (b.k) {
      case "titulo":
        E.y -= 4;
        E.paragrafo(b.t, { s: 13.5, f: FB, c: C.azul, alinhar: "centro", depois: 0 });
        if (b.sub) E.paragrafo(b.sub, { s: 9.5, c: C.tinta2, alinhar: "centro", depois: 4 });
        break;
      case "secao": E.secao(b.t); break;
      case "par": E.paragrafo(b.t, { f: b.b ? FB : E.F, alinhar: b.alinhar || "justificar", recuo: b.recuo ? 18 : 0 }); break;
      case "lista": b.itens.forEach((t) => E.paragrafo(t, { recuo: 18, depois: 3 })); E.y -= 3; break;
      case "chave": E.tabela([{ t: "", w: 26 }, { t: "", w: 74 }], b.linhas, { s: 8.6, zebra: false, cabecalhoTab: false, chave: true }); break;
      case "tabela": E.tabela(b.cols, b.linhas, { s: b.s || 7.6, zebra: b.zebra !== false }); break;
      case "nota": E.nota(b.t); break;
      case "fotos": await E.fotos(b.lista); break;
      case "assinatura": E.assinatura(b.nome, b.cargo, b.unidade); break;
      case "assinaturas": E.assinaturas(b.lista); break;
      case "quebra": E.novaPagina(); break;
      case "espaco": E.y -= b.h || 10; break;
    }
  }
  return E.finalizar();
}
