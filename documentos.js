/* Conteúdo compartilhado pelos relatórios e o Relatório Técnico ao Secretário.
 * O relatório ao Secretário é descrito uma única vez como lista de blocos (modelo);
 * o mesmo modelo gera a prévia em tela, o PDF (pdf-lib) e o arquivo Word (docx).
 */
"use strict";

const _mat = (i) => POR_CODIGO[i.materialCodigo] || { cod: i.materialCodigo, mbst: "", desc: "Item", cat: "SERVICO", un: "UN" };
const _codigo = (m) => m.mbst || m.cod;
const juntarE = (l) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l.at(-1)}` : l[0] || "");

// ------------------------------------------------------- quantitativo ----
const COLUNAS_QUANT = [{ t: "MBST", w: 7, a: "c" }, { t: "Código", w: 9, a: "c" }, { t: "Descrição", w: 47 },
  { t: "Ação", w: 13, a: "c" }, { t: "Un.", w: 7, a: "c" }, { t: "Quantidade", w: 12, a: "c" }];

function quantitativoVistoria(itens) {
  const agreg = new Map();
  for (const i of itens) {
    if (!["IMPLANTAR", "SUBSTITUIR", "REVITALIZAR", "REPOSICIONAR"].includes(i.acao)) continue;
    const chave = `${i.materialCodigo}|${i.acao}`;
    const a = agreg.get(chave) || { m: _mat(i), acao: i.acao, q: 0 };
    a.q += Number(i.quantidade);
    agreg.set(chave, a);
  }
  const ordemCat = CATEGORIAS.map((c) => c[0]);
  const quant = [...agreg.values()].sort((a, b) => ordemCat.indexOf(a.m.cat) - ordemCat.indexOf(b.m.cat) ||
    (ORDEM_CATALOGO[a.m.cod] ?? 9999) - (ORDEM_CATALOGO[b.m.cod] ?? 9999) || a.acao.localeCompare(b.acao));
  const linhas = [];
  let catAtual = null;
  for (const q of quant) {
    if (q.m.cat !== catAtual) { catAtual = q.m.cat; linhas.push({ grupo: GRUPO_RELATORIO[catAtual] || catAtual }); }
    linhas.push([volumeMbst(q.m) || "—", _codigo(q.m), q.m.desc, ROT_ACAO[q.acao], UNIDADE[q.m.un], qtd(Math.round(q.q * 100) / 100)]);
  }
  const ordemVol = Object.keys(VOLUME_MBST);
  const vols = [...new Set(quant.map((q) => volumeMbst(q.m)).filter(Boolean))].sort((a, b) => ordemVol.indexOf(a) - ordemVol.indexOf(b));
  const nota = `Quantitativo restrito às ações Implantar, Substituir, Revitalizar e Reposicionar. A estimativa de valor da contratação deverá ser obtida mediante pesquisa de preços (art. 23 da Lei nº 14.133/2021).${vols.length ? ` Coluna MBST: volume do Manual Brasileiro de Sinalização de Trânsito (Res. CONTRAN nº 973/2022): ${vols.map((x) => VOLUME_MBST[x]).join("; ")}.` : ""}`;
  return { linhas, nota };
}

// --------------------------------------------- ícone do sinal em PNG ----
const _cacheIcone = new Map();
/** Converte o ícone (SVG do catálogo) em PNG, para o PDF e o Word. */
function iconePng(m, px = 256) {
  const chave = `${m.cod}|${px}`;
  if (!_cacheIcone.has(chave)) {
    _cacheIcone.set(chave, new Promise((ok) => {
      const svg = glifo(m).replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" `);
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = px;
        cv.getContext("2d").drawImage(im, 0, 0, px, px);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => ok(b), "image/png");
      };
      im.onerror = () => { URL.revokeObjectURL(url); ok(null); };
      im.src = url;
    }));
  }
  return _cacheIcone.get(chave);
}

// ------------------------------------------------------------- fotos ----
/** Fotos gerais primeiro, depois as dos itens. legendaItem(i, k, p) permite acrescentar a providência. */
function listaFotosRelatorio(itens, fotosPorItem, legendaItem = null) {
  const lista = [];
  for (const f of fotosPorItem[GERAIS] || []) {
    lista.push({ blob: f.blob, legenda: `Foto ${lista.length + 1}, vista geral${f.legenda ? `: ${f.legenda}` : "."}`,
      sub: `${dataHoraBr(f.capturadaEm)}${f.lat != null ? `, ${coord(f.lat)}; ${coord(f.lon)}` : ""}` });
  }
  itens.forEach((i, k) => {
    for (const f of fotosPorItem[i.id] || []) {
      const m = _mat(i);
      const base = `Foto ${lista.length + 1}, item nº ${k + 1} (${_codigo(m)})`;
      lista.push({ blob: f.blob, legenda: legendaItem ? legendaItem(base, i, k) : `${base}, ${ROT_ACAO[i.acao].toLowerCase()}.`,
        sub: `${dataHoraBr(f.capturadaEm)}${i.lat != null ? `, ${coord(i.lat)}; ${coord(i.lon)}` : ""}` });
    }
  });
  return lista;
}

// ------------------------------------------------------ providências ----
const NOTA_PRAZOS = "Os prazos constituem critério técnico deste Departamento, graduado pelo risco à segurança viária: a legislação de trânsito não fixa prazos para a manutenção da sinalização, mas responsabiliza o órgão pela sua falta, insuficiência ou incorreta colocação (CTB, art. 90, § 1º).";

function celulaPrioridade(p) { return { t: ROT_PRIO[p.prioridade], b: true, cor: COR_PRIO[p.prioridade], sub: p.prazo, a: "c" }; }

/** Tabela das providências (itens que exigem intervenção), ordenada por prioridade. */
function tabelaProvidencias(itens) {
  const lista = providenciasDaVistoria(itens);
  const com = lista.filter((x) => x.p.prioridade !== "NENHUMA");
  const sem = lista.filter((x) => x.p.prioridade === "NENHUMA").map((x) => x.n).sort((a, b) => a - b);
  const colunas = [{ t: "Nº", w: 4, a: "c" }, { t: "Código", w: 8, a: "c" }, { t: "Providência indicada", w: 44 },
    { t: "Prioridade e prazo", w: 13, a: "c" }, { t: "Fundamento legal", w: 31 }];
  const linhas = com.map(({ i, n, p }) => [String(n), { t: _codigo(_mat(i)), b: true }, p.texto, celulaPrioridade(p), refsNormas(p.normas)]);
  const nota = `${NOTA_PRAZOS}${sem.length ? ` Itens em bom estado, sem intervenção: nº ${sem.join(", ")}.` : ""}`;
  return { colunas, linhas, nota, lista, com, sem };
}

// ========================================== Relatório ao Secretário ====
const CRITERIO_PRIO = {
  IMEDIATA: "Sinal crítico ausente ou ilegível (parada obrigatória, preferência, sentido proibido, travessia de pedestres, área escolar, passagem de nível, semáforo, ondulação) ou obstáculo na via",
  ALTA: "Regulamentação ou advertência comprometida; interferência de vegetação ou publicidade na visibilidade",
  MEDIA: "Sinalização horizontal e dispositivos auxiliares deteriorados",
  PROGRAMADA: "Sinalização de indicação e manutenção preventiva",
  NENHUMA: "Item em bom estado",
};

function nomeSecretario() { return (config.secretarioNome || "").toLocaleUpperCase("pt-BR"); }

function modeloSecretario(v, itens, fotosPorItem, comFotos) {
  const hoje = new Date();
  const local = [v.logradouro, v.bairro].filter(Boolean).join(", ");
  const prov = tabelaProvidencias(itens);
  const cPrio = contarPrioridades(prov.lista);
  const cEst = Object.fromEntries(ESTADOS.map((e) => [e[0], 0]));
  itens.forEach((i) => cEst[i.estado]++);
  const nIntervir = prov.com.length;
  const nums = (pr) => prov.lista.filter((x) => x.p.prioridade === pr).map((x) => x.n).sort((a, b) => a - b);
  const temNorma = (k) => prov.com.some((x) => x.p.normas.includes(k));
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  // Quadro de fundamentação: base do documento + o que as providências citam, na ordem de NORMAS
  const usadas = new Set(["ctb1", "ctb24", "ctb80", "ctb80p1", "ctb90", "ctb90p1", "mbst", "l14133", "l14133srp", "ctb320", "cf37"]);
  prov.com.forEach((x) => x.p.normas.forEach((k) => usadas.add(k)));
  const quadroNormas = Object.keys(NORMAS).filter((k) => usadas.has(k)).map((k) => [{ t: NORMAS[k].ref, b: true }, NORMAS[k].txt]);

  const b = [];
  b.push({ k: "titulo", t: `RELATÓRIO TÉCNICO Nº ${v.protocolo}`, sub: "Sinalização viária: providências indicadas conforme a legislação vigente" });
  b.push({ k: "chave", linhas: [
    ["Destinatário", `${nomeSecretario()}\n${config.secretarioCargo}`],
    ["Remetente", `${config.chefeNome}\n${config.chefeCargo}`],
    ["Assunto", `Providências para a sinalização viária: ${local}`],
    ["Referência", `Vistoria de campo nº ${v.protocolo}, realizada em ${dataBr(v.data)}${v.trecho ? ` (${v.trecho})` : ""}`],
    ["Data", hoje.toLocaleDateString("pt-BR")],
  ] });
  b.push({ k: "par", t: "Senhor Secretário,", alinhar: "esquerda" });
  b.push({ k: "par", t: `Encaminha-se a Vossa Senhoria o resultado da vistoria de sinalização viária realizada em ${dataBr(v.data)} em ${local}, com a indicação das providências necessárias ao cumprimento da legislação de trânsito, a respectiva prioridade e o fundamento legal de cada medida, para conhecimento e deliberação.` });

  b.push({ k: "secao", t: "1. FUNDAMENTAÇÃO LEGAL" });
  b.push({ k: "par", t: "Compete ao Município, por meio de seu órgão executivo de trânsito, implantar, manter e operar a sinalização viária, nos padrões do Conselho Nacional de Trânsito, respondendo o órgão pela falta, insuficiência ou incorreta colocação da sinalização. As disposições aplicáveis às providências deste relatório são as seguintes:" });
  b.push({ k: "tabela", cols: [{ t: "Norma", w: 27 }, { t: "Disposição", w: 73 }], linhas: quadroNormas, s: 7.8 });

  b.push({ k: "secao", t: "2. DIAGNÓSTICO" });
  b.push({ k: "par", t: `Foram vistoriados ${plural(itens.length, "item", "itens")} de sinalização: ${juntarE([cEst.BOM && `${cEst.BOM} em bom estado`, cEst.REGULAR && `${cEst.REGULAR} em estado regular`, cEst.RUIM && `${cEst.RUIM} em mau estado`, cEst.INEXISTENTE && plural(cEst.INEXISTENTE, "inexistente", "inexistentes")].filter(Boolean))}. Do total, ${plural(nIntervir, "item demanda", "itens demandam")} intervenção, ${cPrio.IMEDIATA ? `dos quais ${plural(cPrio.IMEDIATA, "é", "são")} de prioridade imediata, por envolverem risco direto à segurança de condutores e pedestres` : "nenhum de prioridade imediata"}.` });
  b.push({ k: "tabela", cols: [{ t: "Prioridade", w: 15, a: "c" }, { t: "Prazo sugerido", w: 18, a: "c" }, { t: "Itens", w: 9, a: "c" }, { t: "Itens nº", w: 16, a: "c" }, { t: "Critério", w: 42 }],
    linhas: PRIORIDADES.map(([c, r, prazo, cor]) => [{ t: r, b: true, cor }, prazo, String(cPrio[c]), nums(c).join(", ") || "—", CRITERIO_PRIO[c]]), s: 7.8 });
  b.push({ k: "nota", t: NOTA_PRAZOS });

  b.push({ k: "secao", t: "3. PROVIDÊNCIAS INDICADAS POR ITEM" });
  if (prov.com.length) {
    b.push({ k: "tabela", cols: [{ t: "Nº", w: 4, a: "c" }, { t: "Sinal", w: 15 }, { t: "Situação constatada", w: 17 }, { t: "Providência indicada", w: 32 }, { t: "Prioridade e prazo", w: 11, a: "c" }, { t: "Fundamento legal", w: 21 }],
      linhas: prov.com.map(({ i, n, p }) => {
        const m = _mat(i);
        const sit = [`${ROT_ESTADO[i.estado]}${i.lado ? `, lado ${ROT_LADO[i.lado].toLowerCase()}` : ""}`, i.observacao].filter(Boolean).join(". ");
        return [String(n), { t: _codigo(m), b: true, sub: m.desc }, sit, p.texto, celulaPrioridade(p), refsNormas(p.normas)];
      }), s: 7.2 });
    if (prov.sem.length) b.push({ k: "nota", t: `Itens em bom estado, a manter na inspeção periódica: nº ${prov.sem.join(", ")}.` });
  } else {
    b.push({ k: "par", t: "Todos os itens vistoriados encontram-se em bom estado; não há intervenção a executar." });
  }

  b.push({ k: "secao", t: "4. PLANO DE AÇÃO E FORMA DE EXECUÇÃO" });
  const etapas = PRIORIDADES.filter(([c]) => c !== "NENHUMA" && cPrio[c]).map(([c, r, prazo, cor]) => [
    { t: r, b: true, cor }, prazo, nums(c).join(", "),
    c === "IMEDIATA" ? "Execução por equipe própria do Departamento ou por contrato ou ata de registro de preços vigente; sinalização provisória (MBST, Vol. VII) até a solução definitiva."
      : c === "PROGRAMADA" ? "Inclusão no plano anual de manutenção da sinalização."
        : "Execução por contrato ou ata vigente; não havendo, inclusão no processo de contratação a ser instruído.",
  ]);
  if (etapas.length) {
    b.push({ k: "tabela", cols: [{ t: "Etapa", w: 14, a: "c" }, { t: "Prazo", w: 17, a: "c" }, { t: "Itens nº", w: 17, a: "c" }, { t: "Forma de execução", w: 52 }], linhas: etapas, s: 7.8 });
  }
  b.push({ k: "par", t: "Não havendo contrato ou ata de registro de preços vigente que contemple os serviços, a contratação deverá ser precedida de estudo técnico preliminar, termo de referência e estimativa do valor por pesquisa de preços (Lei nº 14.133/2021, arts. 6º, XX e XXIII, 18 e 23), recomendando-se o sistema de registro de preços (arts. 82 a 86), adequado à natureza contínua e sob demanda da manutenção da sinalização. A despesa pode ser custeada com a receita de multas de trânsito, vinculada, entre outras finalidades, à sinalização e à engenharia de tráfego (CTB, art. 320), observada a disponibilidade orçamentária." });
  const quant = quantitativoVistoria(itens);
  if (quant.linhas.length) {
    b.push({ k: "par", t: "Quantitativo estimado das intervenções:", b: true, alinhar: "esquerda" });
    b.push({ k: "tabela", cols: COLUNAS_QUANT, linhas: quant.linhas, s: 7.6, zebra: false });
    b.push({ k: "nota", t: quant.nota });
  }

  b.push({ k: "secao", t: "5. RISCOS DA NÃO EXECUÇÃO" });
  const riscos = [
    ["Acidente com vítima em local de sinalização ausente, ilegível ou incorreta", "Responsabilidade objetiva do Município pelos danos, com ação regressiva contra o responsável nos casos de dolo ou culpa", "Constituição Federal, art. 37, § 6º; CTB, art. 1º, § 3º, e art. 90, § 1º"],
    ["Autuação de infrações em local com sinalização insuficiente ou incorreta", "Inaplicabilidade das sanções e perda de eficácia da fiscalização", "CTB, art. 90, caput"],
  ];
  if (temNorma("ctb81") || temNorma("ctb82")) riscos.push(["Permanência de vegetação, publicidade ou inscrições que encobrem a sinalização", "Perda de visibilidade do sinal; omissão do órgão no exercício do poder de polícia", "CTB, arts. 81, 82 e 84"]);
  if (temNorma("ctb94")) riscos.push(["Obstáculo na via sem sinalização", "Risco imediato de acidente e de responsabilização do órgão", "CTB, art. 94"]);
  b.push({ k: "tabela", cols: [{ t: "Risco", w: 34 }, { t: "Consequência", w: 40 }, { t: "Fundamento", w: 26 }], linhas: riscos, s: 7.8 });

  let sec = 5;
  if ((v.parecer || "").trim()) {
    b.push({ k: "secao", t: `${++sec}. CONSIDERAÇÕES DO DEPARTAMENTO` });
    v.parecer.trim().split(/\n+/).forEach((t) => b.push({ k: "par", t }));
  }

  b.push({ k: "secao", t: `${++sec}. CONCLUSÃO E PROPOSTAS` });
  b.push({ k: "par", t: "Diante do exposto, submete-se a matéria à apreciação de Vossa Senhoria, com as seguintes propostas:" });
  const propostas = [];
  const letra = () => `${String.fromCharCode(97 + propostas.length)}) `;
  if (cPrio.IMEDIATA) propostas.push(`${letra()}autorizar a execução imediata ${cPrio.IMEDIATA === 1 ? "do item" : "dos itens"} nº ${nums("IMEDIATA").join(", ")}, de prioridade imediata, com a instalação de sinalização provisória até a solução definitiva;`);
  if (cPrio.ALTA || cPrio.MEDIA) propostas.push(`${letra()}autorizar a execução ${cPrio.ALTA + cPrio.MEDIA === 1 ? "do item" : "dos itens"} nº ${[...nums("ALTA"), ...nums("MEDIA")].sort((a, b) => a - b).join(", ")} nos prazos indicados, por meio de contrato ou ata vigente ou, na sua falta, mediante instrução de processo de contratação nos termos da Lei nº 14.133/2021;`);
  if (cPrio.PROGRAMADA) propostas.push(`${letra()}incluir ${cPrio.PROGRAMADA === 1 ? "o item" : "os itens"} nº ${nums("PROGRAMADA").join(", ")} no plano anual de manutenção da sinalização;`);
  if (temNorma("ctb84")) propostas.push(`${letra()}determinar a notificação dos responsáveis pela vegetação, publicidade ou inscrições que prejudicam a visibilidade da sinalização, para remoção, sob pena de retirada pelo órgão de trânsito com ônus ao responsável (CTB, art. 84);`);
  if (temNorma("ctb95")) propostas.push(`${letra()}determinar a verificação da permissão das obras ou interdições constatadas e a exigência da respectiva sinalização (CTB, art. 95);`);
  if (prov.sem.length) propostas.push(`${letra()}manter ${prov.sem.length === 1 ? "o item" : "os itens"} nº ${prov.sem.join(", ")}, em bom estado, na inspeção periódica da sinalização;`);
  if (!propostas.length) propostas.push("a) tomar ciência de que não há intervenção a executar;");
  propostas[propostas.length - 1] = propostas.at(-1).replace(/;$/, ".");
  b.push({ k: "lista", itens: propostas });
  b.push({ k: "par", t: "Autorizadas as providências, este Departamento emitirá a correspondente Ordem de Serviço às equipes de execução, com o registro da execução de cada item." });
  b.push({ k: "par", t: `Acompanha este relatório o Relatório Técnico de Vistoria nº ${v.protocolo}, com o inventário georreferenciado, o croqui de localização e o registro fotográfico completo.` });
  b.push({ k: "par", t: "Respeitosamente,", alinhar: "esquerda" });
  b.push({ k: "par", t: `${config.municipio}, ${hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.`, alinhar: "esquerda" });
  b.push({ k: "assinatura", nome: config.chefeNome, cargo: config.chefeCargo || "Chefe do Departamento", unidade: config.orgaoUnidade });

  if (comFotos) {
    const provPorItem = new Map(prov.lista.map((x) => [x.i.id, x.p]));
    const fotos = listaFotosRelatorio(itens, fotosPorItem, (base, i) => {
      const p = provPorItem.get(i.id);
      return p.prioridade === "NENHUMA" ? `${base}: manter.` : `${base}, prioridade ${ROT_PRIO[p.prioridade].toLowerCase()}: ${ROT_ACAO[i.acao].toLowerCase()}.`;
    });
    if (fotos.length) {
      b.push({ k: "quebra" });
      b.push({ k: "secao", t: "ANEXO I. REGISTRO FOTOGRÁFICO" });
      b.push({ k: "fotos", lista: fotos });
    }
  }

  return {
    meta: {
      titulo: `Relatório Técnico nº ${v.protocolo} - Providências - ${v.logradouro}`,
      assunto: `Providências para a sinalização viária: ${local}`,
      numero: `Nº ${v.protocolo}`, rotulo: "Relatório Técnico ao Secretário",
      rodape: `Relatório Técnico nº ${v.protocolo}, ${config.orgaoUnidade} — ${config.municipio}`,
    },
    blocos: b,
  };
}

// ================================================ prévia em tela (HTML) ==
function _celHtml(c, col) {
  const o = c && typeof c === "object" ? c : { t: c };
  const a = (o.a ?? col?.a) === "c" ? ' class="c"' : "";
  const estilo = o.cor ? ` style="color:${o.cor};font-weight:700"` : "";
  const txt = esc(o.t ?? "").replace(/\n/g, "<br>");
  let img = "";
  if (o.img) { const u = URL.createObjectURL(o.img); urlsRelatorio.push(u); img = `<img class="icone-celula" src="${u}" alt="" style="width:${Math.round((o.imgW || 48) * 1.33)}px"><br>`; }
  return `<td${a}${estilo}>${img}${o.b && !o.cor ? `<b>${txt}</b>` : txt}${o.sub ? `<br><span style="color:#555">${esc(o.sub)}</span>` : ""}</td>`;
}
function tabelaHtml(cols, linhas, { chave = false } = {}) {
  const tot = cols.reduce((a, c) => a + c.w, 0);
  const cg = `<colgroup>${cols.map((c) => `<col style="width:${((c.w / tot) * 100).toFixed(1)}%">`).join("")}</colgroup>`;
  const cab = chave ? "" : `<thead><tr>${cols.map((c) => `<th>${esc(c.t)}</th>`).join("")}</tr></thead>`;
  const corpo = linhas.map((l) => (l.grupo ? `<tr class="grupo"><td colspan="${cols.length}">${esc(l.grupo)}</td></tr>`
    : `<tr>${l.map((c, i) => _celHtml(c, cols[i])).join("")}</tr>`)).join("");
  return `<table${chave ? ' class="chave"' : ""} style="table-layout:fixed">${cg}${cab}<tbody>${corpo}</tbody></table>`;
}

function renderModeloHtml(modelo) {
  const m = modelo.meta;
  let h = `<header class="cab-orgao">
      <div><b>${esc(config.orgaoEnte)}</b>${esc(config.orgaoUf)}<br>${esc(config.orgaoUnidade)}</div>
      <div class="dir"><b style="font-size:10pt">${esc(m.numero)}</b>${esc(m.rotulo)}</div></header>`;
  for (const b of modelo.blocos) {
    switch (b.k) {
      case "titulo": h += `<h1>${esc(b.t)}</h1>${b.sub ? `<p class="subtit">${esc(b.sub)}</p>` : ""}`; break;
      case "secao": h += `<h2>${esc(b.t)}</h2>`; break;
      case "par": h += `<p${b.alinhar === "esquerda" ? ' style="text-align:left"' : ""}>${b.b ? `<b>${esc(b.t)}</b>` : esc(b.t)}</p>`; break;
      case "lista": h += b.itens.map((t) => `<p style="padding-left:1.5em">${esc(t)}</p>`).join(""); break;
      case "chave": h += tabelaHtml([{ t: "", w: 26 }, { t: "", w: 74 }], b.linhas, { chave: true }); break;
      case "tabela": h += tabelaHtml(b.cols, b.linhas); break;
      case "nota": h += `<p class="nota">${esc(b.t)}</p>`; break;
      case "fotos":
        h += `<div class="fotos-rel">${b.lista.map((f) => {
          const u = URL.createObjectURL(f.blob);
          urlsRelatorio.push(u);
          return `<figure><img src="${u}" alt=""><figcaption><b>${esc(f.legenda)}</b><br>${esc(f.sub || "")}</figcaption></figure>`;
        }).join("")}</div>`;
        break;
      case "assinatura":
        h += `<div class="assin"><div>${b.nome ? `<b>${esc(b.nome)}</b><br>` : ""}${esc(b.cargo)}${String(b.cargo).includes(b.unidade) ? "" : `<br>${esc(b.unidade)}`}</div></div>`;
        break;
      case "assinaturas":
        h += `<div class="assin grade-assin">${b.lista.map((a) => `<div>${a.rotulo ? `<i>${esc(a.rotulo)}</i><br>` : ""}${a.nome ? `<b>${esc(a.nome)}</b>` : "&nbsp;"}${a.cargo ? `<br>${esc(a.cargo)}` : ""}</div>`).join("")}</div>`;
        break;
      case "quebra": h += '<div class="quebra-pagina"></div>'; break;
    }
  }
  return h;
}

// ======================================================= Word (.docx) ==
let _docxCarregando = null;
function carregarDocx() {
  if (window.docx) return Promise.resolve();
  _docxCarregando ??= new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "lib/docx.iife.js";
    s.onload = ok;
    s.onerror = () => { _docxCarregando = null; falha(new Error("Não foi possível carregar o gerador de Word.")); };
    document.head.appendChild(s);
  });
  return _docxCarregando;
}

async function renderModeloDocx(modelo) {
  await carregarDocx();
  const D = window.docx;
  const { Paragraph: P, TextRun: T, Table, TableRow, TableCell, WidthType, AlignmentType: AL, ShadingType, BorderStyle, PageNumber, TabStopType } = D;
  const LARG = 9071; // A4 com margens de 3 cm (esq.) e 2 cm (dir.), em twips
  const AZUL = "1F3864", AZUL_CLARO = "D9E2F3", CINZA = "F2F2F2", BORDA = "A6A6A6";
  const hex = (c) => (c || "").replace("#", "").toUpperCase();
  const bordas = { top: { style: BorderStyle.SINGLE, size: 4, color: BORDA }, bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDA },
    left: { style: BorderStyle.SINGLE, size: 4, color: BORDA }, right: { style: BorderStyle.SINGLE, size: 4, color: BORDA } };
  const semBorda = Object.fromEntries(["top", "bottom", "left", "right"].map((k) => [k, { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }]));
  const corpo = [];
  const bytesImg = new Map();
  for (const b of modelo.blocos) {
    if (b.k !== "tabela") continue;
    for (const l of b.linhas) if (Array.isArray(l)) for (const c of l) if (c?.img && !bytesImg.has(c.img)) bytesImg.set(c.img, new Uint8Array(await c.img.arrayBuffer()));
  }

  const linhasTxt = (t, op = {}) => String(t ?? "").split("\n").map((l, k) => new T({ text: l, break: k ? 1 : 0, ...op }));
  function celula(c, col, w, { fill, cab = false, chave = false } = {}) {
    const o = c && typeof c === "object" ? c : { t: c };
    const alin = cab || (o.a ?? col?.a) === "c" ? AL.CENTER : AL.LEFT;
    const filhos = [];
    if (o.img && bytesImg.has(o.img)) {
      const px = Math.round((o.imgW || 48) * 1.33);
      filhos.push(new P({ alignment: AL.CENTER, spacing: { before: 0, after: 40 }, children: [new D.ImageRun({ type: "png", data: bytesImg.get(o.img), transformation: { width: px, height: px } })] }));
    }
    filhos.push(new P({ alignment: alin, spacing: { before: 0, after: 0 },
      children: linhasTxt(o.t, { bold: cab || chave || !!o.b, color: cab ? "FFFFFF" : o.cor ? hex(o.cor) : undefined, size: cab ? 15 : 17 }) }));
    if (o.sub) filhos.push(new P({ alignment: alin, spacing: { before: 0, after: 0 }, children: linhasTxt(o.sub, { color: "555555", size: 16 }) }));
    return new TableCell({ children: filhos, width: { size: w, type: WidthType.DXA }, borders: bordas,
      margins: { top: 40, bottom: 40, left: cab ? 30 : 70, right: cab ? 30 : 70 },
      ...(fill ? { shading: { type: ShadingType.CLEAR, fill, color: "auto" } } : {}) });
  }
  function tabela(cols, linhas, { chave = false, zebra = true } = {}) {
    const tot = cols.reduce((a, c) => a + c.w, 0);
    const ws = cols.map((c) => Math.round((c.w / tot) * LARG));
    const rows = [];
    if (!chave) rows.push(new TableRow({ tableHeader: true, cantSplit: true, children: cols.map((c, i) => celula(c.t, c, ws[i], { fill: AZUL, cab: true })) }));
    linhas.forEach((l, idx) => {
      if (l.grupo) {
        rows.push(new TableRow({ cantSplit: true, children: [new TableCell({ columnSpan: cols.length, borders: bordas, width: { size: LARG, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: AZUL_CLARO, color: "auto" }, margins: { top: 40, bottom: 40, left: 70, right: 70 },
          children: [new P({ spacing: { before: 0, after: 0 }, children: [new T({ text: l.grupo, bold: true, size: 17 })] })] })] }));
        return;
      }
      rows.push(new TableRow({ cantSplit: true, children: l.map((c, i) => celula(c, cols[i], ws[i], {
        chave: chave && i === 0, fill: chave && i === 0 ? AZUL_CLARO : zebra && idx % 2 ? CINZA : undefined })) }));
    });
    corpo.push(new Table({ rows, width: { size: LARG, type: WidthType.DXA }, columnWidths: ws }));
    corpo.push(new P({ spacing: { before: 0, after: 80 }, children: [] }));
  }

  for (const b of modelo.blocos) {
    switch (b.k) {
      case "titulo":
        corpo.push(new P({ alignment: AL.CENTER, spacing: { before: 120, after: 40 }, children: [new T({ text: b.t, bold: true, size: 28, color: AZUL })] }));
        if (b.sub) corpo.push(new P({ alignment: AL.CENTER, spacing: { after: 200 }, children: [new T({ text: b.sub, color: "555555" })] }));
        break;
      case "secao":
        corpo.push(new P({ keepNext: true, spacing: { before: 240, after: 120 }, shading: { type: ShadingType.CLEAR, fill: AZUL, color: "auto" },
          children: [new T({ text: ` ${b.t}`, bold: true, color: "FFFFFF", size: 21 })] }));
        break;
      case "par":
        corpo.push(new P({ alignment: b.alinhar === "esquerda" ? AL.LEFT : AL.JUSTIFIED, spacing: { after: 120, line: 300 },
          keepNext: b.b, children: [new T({ text: b.t, bold: !!b.b })] }));
        break;
      case "lista":
        b.itens.forEach((t) => corpo.push(new P({ alignment: AL.JUSTIFIED, indent: { left: 567 }, spacing: { after: 80, line: 300 }, children: [new T(t)] })));
        break;
      case "chave": tabela([{ t: "", w: 26 }, { t: "", w: 74 }], b.linhas, { chave: true, zebra: false }); break;
      case "tabela": tabela(b.cols, b.linhas, { zebra: b.zebra !== false }); break;
      case "nota": corpo.push(new P({ spacing: { after: 120 }, children: [new T({ text: b.t, size: 17, color: "555555" })] })); break;
      case "fotos": {
        const largCol = Math.floor(LARG / 2);
        const pxMax = 290, pyMax = 210; // tamanho das fotos no Word, em pixels (96 ppp)
        const cels = [];
        for (const f of b.lista) {
          const filhos = [];
          try {
            const bmp = await createImageBitmap(f.blob);
            const k = Math.min(pxMax / bmp.width, pyMax / bmp.height);
            const tipo = f.blob.type === "image/png" ? "png" : "jpg";
            filhos.push(new P({ alignment: AL.CENTER, children: [new D.ImageRun({ type: tipo, data: new Uint8Array(await f.blob.arrayBuffer()),
              transformation: { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) } })] }));
            bmp.close?.();
          } catch { filhos.push(new P({ alignment: AL.CENTER, children: [new T("Foto indisponível")] })); }
          filhos.push(new P({ alignment: AL.CENTER, spacing: { before: 60, after: 0 }, children: [new T({ text: f.legenda, bold: true, size: 16 })] }));
          if (f.sub) filhos.push(new P({ alignment: AL.CENTER, spacing: { after: 60 }, children: [new T({ text: f.sub, size: 16, color: "555555" })] }));
          cels.push(new TableCell({ children: filhos, width: { size: largCol, type: WidthType.DXA }, borders: bordas, margins: { top: 80, bottom: 80, left: 80, right: 80 } }));
        }
        const rows = [];
        for (let k = 0; k < cels.length; k += 2) {
          const par = cels.slice(k, k + 2);
          if (par.length < 2) par.push(new TableCell({ children: [new P("")], width: { size: largCol, type: WidthType.DXA }, borders: semBorda }));
          rows.push(new TableRow({ cantSplit: true, children: par }));
        }
        corpo.push(new Table({ rows, width: { size: largCol * 2, type: WidthType.DXA }, columnWidths: [largCol, largCol] }));
        break;
      }
      case "assinatura":
        corpo.push(new P({ alignment: AL.CENTER, spacing: { before: 900, after: 0 }, keepNext: true, children: [new T("______________________________________________")] }));
        if (b.nome) corpo.push(new P({ alignment: AL.CENTER, spacing: { after: 0 }, keepNext: true, children: [new T({ text: b.nome, bold: true })] }));
        corpo.push(new P({ alignment: AL.CENTER, spacing: { after: 0 }, children: [new T(b.cargo)] }));
        if (!String(b.cargo).includes(b.unidade)) corpo.push(new P({ alignment: AL.CENTER, children: [new T(b.unidade)] }));
        break;
      case "assinaturas": {
        const largCol = Math.floor(LARG / 2);
        const cel = (a) => new TableCell({ width: { size: largCol, type: WidthType.DXA }, borders: semBorda, margins: { left: 200, right: 200 },
          children: a ? [
            new P({ alignment: AL.CENTER, spacing: { before: 700, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 2 } }, children: [] }),
            ...(a.rotulo ? [new P({ alignment: AL.CENTER, spacing: { after: 0 }, children: [new T({ text: a.rotulo, italics: true, size: 16, color: "555555" })] })] : []),
            new P({ alignment: AL.CENTER, spacing: { after: 0 }, children: [new T({ text: a.nome || " ", bold: true, size: 19 })] }),
            ...(a.cargo ? [new P({ alignment: AL.CENTER, spacing: { after: 120 }, children: [new T({ text: a.cargo, size: 17 })] })] : []),
          ] : [new P("")] });
        const rows = [];
        for (let k = 0; k < b.lista.length; k += 2) rows.push(new TableRow({ cantSplit: true, children: [cel(b.lista[k]), cel(b.lista[k + 1])] }));
        corpo.push(new Table({ rows, width: { size: largCol * 2, type: WidthType.DXA }, columnWidths: [largCol, largCol] }));
        break;
      }
      case "quebra": corpo.push(new P({ pageBreakBefore: true, children: [] })); break;
    }
  }

  const m = modelo.meta;
  const cabecalho = new D.Header({ children: [
    new P({ tabStops: [{ type: TabStopType.RIGHT, position: LARG }], spacing: { after: 0 },
      children: [new T({ text: config.orgaoEnte, bold: true, color: AZUL, size: 22 }), new T({ text: `\t${m.numero}`, bold: true, color: AZUL, size: 20 })] }),
    new P({ tabStops: [{ type: TabStopType.RIGHT, position: LARG }], spacing: { after: 0 },
      children: [new T({ text: config.orgaoUf, size: 16, color: "555555" }), new T({ text: `\t${m.rotulo}`, size: 16, color: "555555" })] }),
    new P({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 4 } },
      children: [new T({ text: config.orgaoUnidade, size: 16, color: "555555" })] }),
  ] });
  const rodape = new D.Footer({ children: [
    new P({ tabStops: [{ type: TabStopType.RIGHT, position: LARG }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDA, space: 4 } },
      children: [new T({ text: m.rodape, size: 14, color: "555555" }),
        new T({ children: ["\tPágina ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 14, color: "555555" })] }),
  ] });

  const documento = new D.Document({
    creator: config.chefeNome || config.orgaoUnidade, title: m.titulo, description: m.assunto,
    styles: { default: { document: { run: { font: "Arial", size: 21 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1985, bottom: 1134, left: 1701, right: 1134, header: 567, footer: 567 } } },
      headers: { default: cabecalho }, footers: { default: rodape }, children: corpo,
    }],
  });
  const blob = await D.Packer.toBlob(documento);
  return new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
