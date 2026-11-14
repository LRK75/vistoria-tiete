/* Ordem de Serviço para as equipes de execução, emitida a partir do Relatório Técnico
 * ao Secretário. Linguagem direta: o que fazer, onde, quanto, até quando, e o registro
 * de execução a ser preenchido em campo. Usa os mesmos renderizadores (tela, PDF, Word).
 */
"use strict";

const OS_PADRAO = { equipe: "", autorizacao: "", inicio: "", prioridades: ["IMEDIATA", "ALTA", "MEDIA", "PROGRAMADA"], instrucoes: "", veiculo: "" };

function _somarDias(iso, dias) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + dias);
  return dt.toLocaleDateString("pt-BR");
}
function prazoOS(os, prio) {
  const dias = DIAS_PRIO[prio];
  return dias == null ? "conforme plano anual" : _somarDias(os.inicio || hojeLocal(), dias);
}

/** Serviço em linguagem de campo: verbo, objeto, quantidade e cuidados. */
function servicoOS(i, p) {
  const m = POR_CODIGO[i.materialCodigo] || { desc: "Item (ver observação)", mbst: "", cat: "SERVICO", un: "UN" };
  const obj = `${m.desc.charAt(0).toLowerCase()}${m.desc.slice(1)}${m.mbst ? ` (${m.mbst})` : ""}`;
  const horizontal = m.cat === "HORIZONTAL", vertical = m.cat === "VERTICAL";
  const verbo = {
    IMPLANTAR: vertical ? `Instalar placa nova: ${obj}, com suporte, na altura e no afastamento do MBST.` : `Implantar ${obj}.`,
    SUBSTITUIR: vertical ? `Trocar a placa: ${obj}. Placa e película refletiva novas; recolher a placa retirada.` : `Trocar ${obj} por peça nova; recolher a peça retirada.`,
    REVITALIZAR: horizontal ? `Repintar ${obj}, com microesferas de vidro, nas medidas originais.` : `Recuperar ${obj}: limpar, recuperar a película e reapertar a fixação.`,
    REPOSICIONAR: `Reposicionar ${obj}: corrigir altura, afastamento e ângulo, deixando o sinal visível de dia e de noite.`,
    REMOVER: `Remover ${obj} e o suporte, se não servir a outro sinal; recolher o material ao depósito.`,
    MANTER: `Verificar ${obj} e comunicar a chefia (estado ${(ROT_ESTADO[i.estado] || "").toLowerCase()} com ação "Manter").`,
  }[i.acao];
  return [verbo, ...p.tarefas].join(" ");
}

async function modeloOS(v, itens, fotosPorItem, comFotos, os) {
  const hoje = new Date();
  const local = [v.logradouro, v.bairro].filter(Boolean).join(", ");
  const todas = providenciasDaVistoria(itens);
  const sel = todas.filter((x) => x.p.prioridade !== "NENHUMA" && os.prioridades.includes(x.p.prioridade));
  const prioUsadas = PRIORIDADES.map((p) => p[0]).filter((c) => sel.some((x) => x.p.prioridade === c));
  const equipe = (os.equipe || "").split("\n").map((t) => t.trim()).filter(Boolean);
  const limiteFinal = prioUsadas.length ? prazoOS(os, prioUsadas.findLast((c) => DIAS_PRIO[c] != null) || prioUsadas.at(-1)) : "—";
  const _m = (i) => POR_CODIGO[i.materialCodigo] || { cod: i.materialCodigo, mbst: "", desc: "Item", un: "UN" };

  const b = [];
  b.push({ k: "titulo", t: `ORDEM DE SERVIÇO Nº ${v.protocolo}`, sub: "Execução de serviços de sinalização viária" });
  b.push({ k: "chave", linhas: [
    ["Local", `${local}${v.trecho ? ` (${v.trecho})` : ""}, ${config.municipio}`],
    ["Origem", `Relatório Técnico nº ${v.protocolo} ao ${config.secretarioCargo}${os.autorizacao ? `\n${os.autorizacao}` : ""}`],
    ["Emitente", `${config.chefeNome}, ${config.chefeCargo}`],
    ["Equipe executora", equipe.length ? equipe.join("\n") : "A designar pela chefia"],
    ...(os.veiculo ? [["Veículo e equipamentos", os.veiculo]] : []),
    ["Início", (os.inicio ? _somarDias(os.inicio, 0) : hoje.toLocaleDateString("pt-BR"))],
    ["Conclusão até", limiteFinal],
    ["Serviços", `${sel.length} (${prioUsadas.map((c) => `${ROT_PRIO[c].toLowerCase()}: ${sel.filter((x) => x.p.prioridade === c).length}`).join("; ") || "nenhum"})`],
  ] });
  b.push({ k: "par", t: `Determina-se à equipe acima a execução dos serviços relacionados nesta ordem, na ordem de prioridade indicada, observados os padrões do Manual Brasileiro de Sinalização de Trânsito (Resolução CONTRAN nº 973/2022) e as instruções de execução e segurança desta ordem.` });

  b.push({ k: "secao", t: "1. SERVIÇOS A EXECUTAR" });
  if (sel.length) {
    // Ícone de cada sinal, em tamanho médio, para a equipe reconhecer o tipo de placa ou marca
    const icones = new Map();
    for (const { i } of sel) if (!icones.has(i.materialCodigo) && POR_CODIGO[i.materialCodigo]) icones.set(i.materialCodigo, await iconePng(POR_CODIGO[i.materialCodigo]));
    const linhas = [];
    for (const c of prioUsadas) {
      linhas.push({ grupo: `Prioridade ${ROT_PRIO[c].toLowerCase()}: ${DIAS_PRIO[c] == null ? "concluir conforme o plano anual de manutenção" : `concluir até ${prazoOS(os, c)}`}` });
      for (const { i, n, p } of sel.filter((x) => x.p.prioridade === c)) {
        const m = _m(i);
        const ondeTxt = [i.lado ? `Lado ${ROT_LADO[i.lado].toLowerCase()}` : "", i.lat != null ? `${coord(i.lat)}\n${coord(i.lon)}` : "sem GPS: ver observação"].filter(Boolean).join("\n");
        linhas.push([String(n), { t: m.mbst || m.cod, b: true, sub: m.desc, a: "c", img: icones.get(i.materialCodigo) || null, imgW: 50 }, ondeTxt,
          { t: servicoOS(i, p), sub: i.observacao ? `Encontrado: ${ROT_ESTADO[i.estado].toLowerCase()}. ${i.observacao}` : `Encontrado: ${ROT_ESTADO[i.estado].toLowerCase()}.` },
          `${qtd(i.quantidade)} ${UNIDADE[m.un] || ""}`, "", "☐", "☐"]);
      }
    }
    b.push({ k: "tabela", cols: [{ t: "Nº", w: 4, a: "c" }, { t: "Sinal e definição", w: 15, a: "c" }, { t: "Onde", w: 12, a: "c" }, { t: "O que fazer", w: 34 },
      { t: "Qtd. prevista", w: 8, a: "c" }, { t: "Qtd. instalada", w: 8, a: "c" }, { t: "Executado", w: 9.5, a: "c" }, { t: "Não executado", w: 9.5, a: "c" }], linhas, s: 7.4, zebra: false });
    b.push({ k: "nota", t: "Nº: número do item no Relatório Técnico de Vistoria. Onde: lado da via no sentido do tráfego e coordenadas GPS (latitude e longitude), que podem ser digitadas no aplicativo de mapas do celular. Qtd. instalada: preencher em campo. Não executado: marcar e informar o motivo no registro de execução." });
  } else {
    b.push({ k: "par", t: "Não há serviços nas prioridades selecionadas." });
  }

  // Materiais: somente dos itens incluídos
  const quant = quantitativoVistoria(sel.map((x) => x.i));
  if (quant.linhas.length) {
    b.push({ k: "secao", t: "2. MATERIAIS A RETIRAR NO DEPÓSITO" });
    b.push({ k: "tabela", cols: COLUNAS_QUANT.map((c) => (c.t === "Quantidade" ? { ...c, t: "Quantidade retirada" } : c)),
      linhas: quant.linhas.map((l) => (Array.isArray(l) ? [...l.slice(0, -1), ""] : l)), s: 7.6, zebra: false });
    b.push({ k: "nota", t: "Quantidade retirada: preencher manualmente no depósito. Sobras retornam ao depósito ao final do serviço." });
  }

  b.push({ k: "secao", t: `${quant.linhas.length ? 3 : 2}. INSTRUÇÕES DE EXECUÇÃO E SEGURANÇA` });
  const instr = [
    "Antes de começar, sinalizar a área de trabalho com cones, cavaletes e placas, conforme o Manual de Sinalização Temporária (MBST, Vol. VII). Ninguém trabalha na pista sem a área sinalizada.",
    "Usar os equipamentos de proteção individual: colete refletivo, calçado de segurança, luvas e, na pintura, máscara e óculos.",
    "Fotografar cada item antes e depois do serviço, do mesmo ponto, mostrando o sinal inteiro.",
    "Seguir os padrões do MBST: modelo, cor e tamanho da placa; altura e afastamento do suporte; medidas e cor da pintura.",
    "Pintura somente com o pavimento limpo e seco, sem chuva prevista; liberar o trânsito apenas após a secagem.",
    "Placas, suportes e peças retirados devem ser recolhidos ao depósito do Departamento.",
    "Qualquer impedimento (falta de material, rede elétrica, árvore em imóvel particular, obra, conflito com o morador) deve ser comunicado à chefia no mesmo dia, e anotado no registro abaixo.",
  ];
  if (sel.some((x) => x.p.prioridade === "IMEDIATA")) instr.splice(1, 0, "Itens de prioridade imediata: se não puderem ser concluídos no mesmo dia, deixar sinalização provisória no local e comunicar a chefia.");
  (os.instrucoes || "").split("\n").map((t) => t.trim()).filter(Boolean).forEach((t) => instr.push(t));
  b.push({ k: "lista", itens: instr.map((t, k) => `${String.fromCharCode(97 + k)}) ${t}`) });

  const secReg = quant.linhas.length ? 4 : 3;
  b.push({ k: "secao", t: `${secReg}. REGISTRO DE EXECUÇÃO (preencher em campo)` });
  b.push({ k: "tabela", cols: [{ t: "Nº", w: 5, a: "c" }, { t: "Data", w: 13, a: "c" }, { t: "Servidor(es)", w: 27 }, { t: "Fotos antes e depois", w: 13, a: "c" }, { t: "Ocorrências", w: 42 }],
    linhas: (sel.length ? sel : [{ n: "" }]).map((x) => [String(x.n), "___/___/_____", "\n ", "☐", ""]), s: 7.6, zebra: false });

  b.push({ k: "par", t: `${config.municipio}, ${hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.`, alinhar: "esquerda" });
  const assin = [{ rotulo: "Emitente", nome: config.chefeNome, cargo: config.chefeCargo }];
  equipe.forEach((nome) => assin.push({ rotulo: "Ciente (equipe executora)", nome }));
  if (!equipe.length) assin.push({ rotulo: "Ciente (equipe executora)", nome: "" }, { rotulo: "Ciente (equipe executora)", nome: "" });
  assin.push({ rotulo: "Conferência da execução, em ___/___/_____", nome: config.chefeNome, cargo: config.chefeCargo });
  b.push({ k: "assinaturas", lista: assin });

  if (comFotos) {
    const incl = new Map(sel.map((x) => [x.i.id, x]));
    const fotos = listaFotosRelatorio(sel.map((x) => x.i), Object.fromEntries([[GERAIS, fotosPorItem[GERAIS] || []], ...sel.map((x) => [x.i.id, fotosPorItem[x.i.id] || []])]),
      (base, i) => { const x = incl.get(i.id); return `Item nº ${x.n} (${_m(i).mbst || _m(i).cod}): ${ROT_ACAO[i.acao].toLowerCase()}, prioridade ${ROT_PRIO[x.p.prioridade].toLowerCase()}.`; });
    if (fotos.length) {
      b.push({ k: "quebra" });
      b.push({ k: "secao", t: "ANEXO. SITUAÇÃO ENCONTRADA NA VISTORIA" });
      b.push({ k: "fotos", lista: fotos.map((f) => ({ ...f, legenda: f.legenda.replace(/^Foto \d+, vista geral/, "Vista geral") })) });
    }
  }

  return {
    meta: {
      titulo: `Ordem de Serviço nº ${v.protocolo} - ${v.logradouro}`, assunto: `Execução de serviços de sinalização viária: ${local}`,
      numero: `OS nº ${v.protocolo}`, rotulo: "Ordem de Serviço",
      rodape: `Ordem de Serviço nº ${v.protocolo}, ${config.orgaoUnidade} — ${config.municipio}`,
    },
    blocos: b,
  };
}

/** Tela da ordem de serviço: dados da equipe, prioridades incluídas, prévia, PDF e Word. */
async function abrirOrdemServico(id) {
  const { v, itens, fotosPorItem } = await dadosRelatorio(id);
  const os = { ...OS_PADRAO, inicio: hojeLocal(), ...(v.os || {}) };
  const contagem = contarPrioridades(providenciasDaVistoria(itens));
  const r = $("#relatorio");
  r.innerHTML = `${barraRelatorio(id, { word: true, imprimir: false })}
    <div class="folha sec-form">
      <div class="sec-dest"><span>Ordem de Serviço nº</span><b>${esc(v.protocolo)}</b>emitida a partir do Relatório Técnico ao Secretário</div>
      <div class="rotulo">Prioridades incluídas</div>
      <div class="os-prios">${PRIORIDADES.filter((p) => p[0] !== "NENHUMA").map(([c, rot, prazo, cor]) => `
        <label class="interruptor"><input type="checkbox" data-prio="${c}" ${os.prioridades.includes(c) ? "checked" : ""} ${contagem[c] ? "" : "disabled"}>
          <span style="color:${cor};font-weight:700">${rot}</span>&nbsp;(${contagem[c]} ${contagem[c] === 1 ? "item" : "itens"}, ${prazo})</label>`).join("")}</div>
      <div class="duas">
        <label class="campo">Data de início <input class="campo-texto" type="date" id="os-inicio" value="${esc(os.inicio)}"></label>
        <label class="campo">Autorização <input class="campo-texto" id="os-aut" placeholder="Ex.: Autorizado pelo Secretário em 14/11/2026, Processo nº 1234/2026" value="${esc(os.autorizacao)}"></label>
      </div>
      <label class="campo">Equipe executora <small>um servidor por linha, com matrícula</small>
        <textarea id="os-equipe" placeholder="João da Silva, matrícula 1234&#10;Maria Souza, matrícula 5678">${esc(os.equipe)}</textarea></label>
      <label class="campo">Veículo e equipamentos <input class="campo-texto" id="os-veiculo" placeholder="Ex.: caminhão de sinalização, máquina de pintura, cones" value="${esc(os.veiculo)}"></label>
      <label class="campo">Instruções adicionais <small>opcional; uma por linha</small>
        <textarea id="os-instr" placeholder="Ex.: executar das 9h às 16h, fora do horário de entrada e saída da escola">${esc(os.instrucoes)}</textarea></label>
    </div>
    <article class="folha" id="folha"></article>`;
  r.hidden = false;
  r.scrollTop = 0;
  let geracaoOS = 0;
  const atualizar = async () => {
    const comFotos = $("#rel-fotos").checked;
    urlsRelatorio.forEach((u) => URL.revokeObjectURL(u));
    urlsRelatorio = [];
    const g = ++geracaoOS;
    const modelo = await modeloOS(v, itens, fotosPorItem, comFotos, os);
    if (g !== geracaoOS || !$("#folha")) return;
    $("#folha").innerHTML = renderModeloHtml(modelo);
    const nome = `ordem_de_servico_${nomeBase(v).replace(/^vistoria_/, "")}${comFotos ? "" : "_sem_fotos"}`;
    prepararArquivos({
      pdf: () => renderModeloPdf(modelo), word: () => renderModeloDocx(modelo), nome,
      titulo: `Ordem de Serviço nº ${v.protocolo}`,
      texto: `Ordem de Serviço nº ${v.protocolo}: sinalização viária de ${v.logradouro}${v.bairro ? `, ${v.bairro}` : ""}.`,
    });
  };
  let t;
  const salvarDepois = () => {
    clearTimeout(t);
    t = setTimeout(async () => { v.os = { ...os }; await BD.gravar("vistorias", v); atualizar(); }, 900);
  };
  const ligar = (sel, campo) => $(sel).addEventListener("input", (e) => { os[campo] = e.target.value; salvarDepois(); });
  ligar("#os-equipe", "equipe"); ligar("#os-aut", "autorizacao"); ligar("#os-instr", "instrucoes"); ligar("#os-veiculo", "veiculo"); ligar("#os-inicio", "inicio");
  $$(".os-prios input").forEach((c) => c.addEventListener("change", () => {
    os.prioridades = $$(".os-prios input:checked").map((x) => x.dataset.prio);
    salvarDepois();
  }));
  $("#rel-fotos").addEventListener("change", atualizar);
  ligarBarraRelatorio();
  document.title = `Ordem de Serviço ${v.protocolo.replace("/", "-")} - ${v.logradouro}`;
  atualizar();
}
