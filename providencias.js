/* Providências indicadas para cada item vistoriado, com o fundamento legal.
 *
 * A indicação considera o tipo do sinal, o estado de conservação, a ação recomendada
 * pelo agente e palavras da observação (vegetação, publicidade, obra, obstáculo).
 * Os prazos são critério técnico do Departamento, graduados pelo risco à segurança
 * viária; a legislação não fixa prazos para a manutenção da sinalização.
 *
 * Referências conferidas em novembro de 2026:
 * - Lei Federal nº 9.503/1997 (Código de Trânsito Brasileiro);
 * - Resolução CONTRAN nº 973/2022 (Manual Brasileiro de Sinalização de Trânsito, MBST),
 *   em revisão pela Senatran desde 2025, sem substituição publicada;
 * - Lei Federal nº 14.133/2021; Lei nº 13.146/2015; Lei nº 10.741/2003;
 * - ABNT NBR 14644 (películas) e NBR 14723 (retrorrefletividade da sinalização horizontal).
 */
"use strict";

// [código, rótulo, prazo sugerido, cor, ordem]
const PRIORIDADES = [
  ["IMEDIATA", "Imediata", "até 72 horas", "#b71c1c"],
  ["ALTA", "Alta", "até 30 dias", "#e65100"],
  ["MEDIA", "Média", "até 90 dias", "#9a7b00"],
  ["PROGRAMADA", "Programada", "plano anual de manutenção", "#1565c0"],
  ["NENHUMA", "Sem intervenção", "inspeção periódica", "#2e7d32"],
];
const ROT_PRIO = Object.fromEntries(PRIORIDADES.map((p) => [p[0], p[1]]));
const PRAZO_PRIO = Object.fromEntries(PRIORIDADES.map((p) => [p[0], p[2]]));
const COR_PRIO = Object.fromEntries(PRIORIDADES.map((p) => [p[0], p[3]]));
const ORDEM_PRIO = Object.fromEntries(PRIORIDADES.map((p, k) => [p[0], k]));

/** Dispositivos legais citados. ref: forma curta; txt: conteúdo, para o quadro do relatório. */
const NORMAS = {
  ctb1: { ref: "CTB, art. 1º, § 3º", txt: "Os órgãos do Sistema Nacional de Trânsito respondem objetivamente por danos causados aos cidadãos em virtude de ação, omissão ou erro na execução e manutenção de programas, projetos e serviços que garantam o trânsito seguro." },
  ctb24: { ref: "CTB, art. 24, III", txt: "Compete ao órgão executivo de trânsito do Município implantar, manter e operar o sistema de sinalização, os dispositivos e os equipamentos de controle viário." },
  ctb61: { ref: "CTB, art. 61", txt: "A velocidade máxima permitida para a via é indicada por meio de sinalização, obedecidas suas características técnicas e as condições de trânsito." },
  ctb80: { ref: "CTB, art. 80, caput", txt: "A sinalização deve observar os padrões e as especificações estabelecidos pelo CONTRAN." },
  ctb80p1: { ref: "CTB, art. 80, § 1º", txt: "A sinalização deve ser colocada em posição e condições que a tornem perfeitamente visível e legível durante o dia e a noite, em distância compatível com a segurança do trânsito." },
  ctb81: { ref: "CTB, art. 81", txt: "É proibido colocar nas vias e nos imóveis luzes, publicidade, inscrições, vegetação e mobiliário que possam gerar confusão, interferir na visibilidade da sinalização e comprometer a segurança do trânsito." },
  ctb82: { ref: "CTB, art. 82", txt: "É proibido afixar sobre a sinalização e seus suportes, ou junto a ambos, publicidade, inscrições, legendas e símbolos que não se relacionem com a mensagem da sinalização." },
  ctb84: { ref: "CTB, art. 84", txt: "O órgão de trânsito pode retirar ou determinar a imediata retirada de elemento que prejudique a visibilidade da sinalização e a segurança do trânsito, com ônus para quem o tenha colocado." },
  ctb85: { ref: "CTB, art. 85", txt: "Os locais destinados à travessia de pedestres devem ser sinalizados com faixas pintadas ou demarcadas no leito da via." },
  ctb88: { ref: "CTB, art. 88", txt: "Nenhuma via pavimentada pode ser entregue após a construção, ou reaberta ao trânsito após obras ou manutenção, enquanto não estiver devidamente sinalizada, vertical e horizontalmente." },
  ctb90: { ref: "CTB, art. 90, caput", txt: "Não se aplicam as sanções do Código por inobservância à sinalização quando esta for insuficiente ou incorreta." },
  ctb90p1: { ref: "CTB, art. 90, § 1º", txt: "O órgão com circunscrição sobre a via é responsável pela implantação da sinalização, respondendo pela sua falta, insuficiência ou incorreta colocação." },
  ctb94: { ref: "CTB, art. 94", txt: "Qualquer obstáculo à livre circulação e à segurança de veículos e pedestres, no leito da via ou nas calçadas, deve ser imediata e devidamente sinalizado." },
  ctb94pu: { ref: "CTB, art. 94, parágrafo único", txt: "Ondulações transversais e sonorizadores só podem ser utilizados como redutores de velocidade em casos especiais, nos padrões e critérios estabelecidos pelo CONTRAN." },
  ctb95: { ref: "CTB, art. 95", txt: "Nenhuma obra ou evento que possa perturbar ou interromper a circulação, ou comprometer a segurança, será iniciado sem permissão prévia do órgão com circunscrição sobre a via; o responsável pela obra deve sinalizá-la." },
  ctb320: { ref: "CTB, art. 320", txt: "A receita arrecadada com multas de trânsito é aplicada, entre outras finalidades, em sinalização e engenharia de tráfego." },
  mbst: { ref: "Res. CONTRAN nº 973/2022 (MBST)", txt: "Institui o Manual Brasileiro de Sinalização de Trânsito, com os padrões de forma, cor, dimensão, posicionamento e critérios de implantação de cada sinal." },
  mbst1: { ref: "MBST, Vol. I", txt: "Sinalização vertical de regulamentação." },
  mbst2: { ref: "MBST, Vol. II", txt: "Sinalização vertical de advertência." },
  mbst3: { ref: "MBST, Vol. III", txt: "Sinalização vertical de indicação." },
  mbst4: { ref: "MBST, Vol. IV", txt: "Sinalização horizontal." },
  mbst5: { ref: "MBST, Vol. V", txt: "Sinalização semafórica." },
  mbst6: { ref: "MBST, Vol. VI", txt: "Dispositivos auxiliares, incluindo ondulações transversais, tachas, tachões e balizadores." },
  mbst7: { ref: "MBST, Vol. VII", txt: "Sinalização temporária, para obras, eventos e situações de emergência." },
  nbr14644: { ref: "ABNT NBR 14644", txt: "Sinalização vertical viária: requisitos das películas retrorrefletivas." },
  nbr14723: { ref: "ABNT NBR 14723", txt: "Sinalização horizontal viária: medição da retrorrefletividade." },
  lbi47: { ref: "Lei nº 13.146/2015, art. 47", txt: "Reserva de vagas de estacionamento para veículos que transportem pessoa com deficiência, devidamente sinalizadas." },
  idoso41: { ref: "Lei nº 10.741/2003, art. 41", txt: "Reserva de 5% das vagas dos estacionamentos públicos e privados para pessoas idosas." },
  l14133: { ref: "Lei nº 14.133/2021, arts. 6º, XX e XXIII, 18 e 23", txt: "Planejamento da contratação: estudo técnico preliminar, termo de referência e estimativa do valor por pesquisa de preços." },
  l14133srp: { ref: "Lei nº 14.133/2021, arts. 82 a 86", txt: "Sistema de registro de preços, adequado a serviços contínuos e demandas sob encomenda, como a manutenção da sinalização." },
  cf37: { ref: "Constituição Federal, art. 37, § 6º", txt: "As pessoas jurídicas de direito público respondem pelos danos que seus agentes, nessa qualidade, causarem a terceiros." },
};

// Sinais cuja falta ou ilegibilidade expõe a risco imediato de acidente grave
const MBST_CRITICOS = new Set([
  "R-1", "R-2", "R-3", "A-39", "A-40", "A-41", "A-33a", "A-33b", "A-32b",
  "FTP-1", "FTP-2", "LRE", "MCF", "SIF", "OND", "LFO-3",
]);
const COD_CRITICOS = new Set(["SEM-001", "SEM-002", "AUX-004"]);

function _criticidade(m) {
  if (!m) return "baixa";
  if (MBST_CRITICOS.has(m.mbst) || COD_CRITICOS.has(m.cod)) return "critica";
  if (m.grupo === "R" || m.grupo === "A" || m.grupo === "S") return "alta";
  if (m.grupo === "H" || m.grupo === "D") return "media";
  return "baixa";
}

function _normasDoTipo(m) {
  if (!m) return [];
  const vol = { R: "mbst1", A: "mbst2", I: "mbst3", H: "mbst4", S: "mbst5", D: "mbst6" }[m.grupo];
  const r = vol ? [vol] : [];
  if (m.mbst === "R-19") r.push("ctb61");
  if (["FTP-1", "FTP-2"].includes(m.mbst)) r.push("ctb85");
  if (m.cod === "AUX-004") r.push("ctb94pu");
  if (m.mbst === "DEF") r.push("lbi47");
  if (m.mbst === "IDS") r.push("idoso41");
  return r;
}

const _PRIO_POR = {
  // ação: criticidade -> prioridade
  IMPLANTAR: { critica: "IMEDIATA", alta: "ALTA", media: "MEDIA", baixa: "PROGRAMADA" },
  SUBSTITUIR: { critica: "IMEDIATA", alta: "ALTA", media: "MEDIA", baixa: "PROGRAMADA" },
  REVITALIZAR: { critica: "ALTA", alta: "MEDIA", media: "MEDIA", baixa: "PROGRAMADA" },
  REPOSICIONAR: { critica: "ALTA", alta: "ALTA", media: "MEDIA", baixa: "PROGRAMADA" },
  REMOVER: { critica: "ALTA", alta: "ALTA", media: "MEDIA", baixa: "PROGRAMADA" },
};
const _maisUrgente = (a, b) => (ORDEM_PRIO[a] <= ORDEM_PRIO[b] ? a : b);

/**
 * Providência indicada para um item.
 * Recebe { materialCodigo, estado, acao, observacao, fotos } e devolve
 * { prioridade, prazo, criticidade, texto, normas: [chaves de NORMAS], alertas: [] }.
 */
function providenciaItem(i) {
  const m = POR_CODIGO[i.materialCodigo];
  const crit = _criticidade(m);
  const vertical = m?.cat === "VERTICAL";
  const horizontal = m?.cat === "HORIZONTAL";
  const nome = m ? `${m.desc.charAt(0).toLowerCase()}${m.desc.slice(1)}${m.mbst ? ` (${m.mbst})` : ""}` : "o item";
  const regul = m?.grupo === "R";
  const obs = (i.observacao || "").toLowerCase();
  let texto, prioridade, normas = [];
  const alertas = [];

  switch (i.acao) {
    case "IMPLANTAR":
      texto = `Implantar ${nome} conforme o projeto e os padrões do MBST.`;
      normas = ["ctb90p1", "ctb24", "ctb80"];
      if (regul) { texto += " Enquanto não for implantada, a regra correspondente não pode ser objeto de autuação."; normas.push("ctb90"); }
      break;
    case "SUBSTITUIR":
      texto = vertical
        ? `Substituir ${nome}, com placa e película retrorrefletiva novas, em conformidade com o MBST e a ABNT NBR 14644.`
        : `Substituir ${nome} por dispositivo novo, nos padrões do MBST.`;
      normas = ["ctb80p1", "ctb90p1", "ctb24"];
      if (vertical) normas.push("nbr14644");
      if (regul) normas.push("ctb90");
      break;
    case "REVITALIZAR":
      texto = horizontal
        ? `Repintar ${nome}, recompondo dimensões, cor e retrorrefletividade (avaliação conforme ABNT NBR 14723).`
        : `Revitalizar ${nome}: limpeza, recuperação da película ou pintura e reaperto da fixação.`;
      normas = ["ctb80p1", "ctb24"];
      if (horizontal) normas.push("nbr14723");
      break;
    case "REPOSICIONAR":
      texto = `Reposicionar ${nome} na altura, no afastamento e no ângulo previstos no MBST, garantindo visibilidade de dia e de noite.`;
      normas = ["ctb80p1", "ctb24"];
      break;
    case "REMOVER":
      texto = `Remover ${nome}, por ser desnecessário, conflitante ou em desacordo com o MBST, recolhendo o material.`;
      normas = ["ctb90p1", "ctb80"];
      if (regul) { texto += " Sinalização incorreta impede a autuação e pode induzir o condutor a erro."; normas.push("ctb90"); }
      break;
    default: // MANTER
      if (i.estado === "BOM") {
        texto = "Manter. Incluir o item na inspeção periódica da sinalização.";
        prioridade = "NENHUMA";
      } else if (i.estado === "REGULAR") {
        texto = "Manter, com limpeza e manutenção preventiva. Reavaliar na próxima inspeção.";
        prioridade = "PROGRAMADA";
      } else {
        texto = `Rever a ação: o estado "${(ROT_ESTADO[i.estado] || "").toLowerCase()}" não é compatível com "Manter".`;
        prioridade = i.estado === "INEXISTENTE" ? _PRIO_POR.IMPLANTAR[crit] : _PRIO_POR.SUBSTITUIR[crit];
        alertas.push("Estado e ação incompatíveis.");
      }
      normas = ["ctb24", "ctb80p1"];
  }
  prioridade ??= _PRIO_POR[i.acao]?.[crit] || "PROGRAMADA";

  // Coerência entre estado e ação
  if (i.estado === "INEXISTENTE" && !["IMPLANTAR", "MANTER"].includes(i.acao)) alertas.push("Item inexistente: a ação esperada é Implantar.");
  if (i.estado === "BOM" && ["SUBSTITUIR", "REVITALIZAR"].includes(i.acao)) alertas.push("Item em bom estado com ação de substituição ou revitalização: confirme.");

  // Sinais críticos ausentes ou ilegíveis: sinalização provisória até a solução definitiva
  if (prioridade === "IMEDIATA") {
    texto += " Até a solução definitiva, instalar sinalização provisória no local.";
    normas.push("mbst7", "ctb1");
  }

  // Situações descritas na observação
  const extras = [];
  if (/vegeta|árvore|arvore|galho|mato|arbust|folhag/.test(obs)) {
    extras.push("Providenciar a poda da vegetação que encobre a sinalização; se em imóvel particular, notificar o responsável.");
    normas.push("ctb81", "ctb84");
    prioridade = _maisUrgente(prioridade, crit === "critica" ? "IMEDIATA" : "ALTA");
  }
  if (/publicidade|propaganda|cartaz|faixa de pano|banner|adesivo|picha|grafit/.test(obs)) {
    extras.push("Retirar publicidade, inscrições ou adesivos afixados na sinalização ou no suporte, com ônus para quem os colocou.");
    normas.push("ctb82", "ctb84");
    prioridade = _maisUrgente(prioridade, "ALTA");
  }
  if (/\bobra|caçamba|cacamba|tapume|interdi/.test(obs)) {
    extras.push("Verificar a permissão da obra ou interdição e exigir do responsável a sinalização temporária.");
    normas.push("ctb95", "mbst7");
  }
  if (/buraco|obst[aá]culo|cratera|desn[ií]vel|bueiro|tampa/.test(obs)) {
    extras.push("Sinalizar imediatamente o obstáculo e acionar o setor responsável pelo reparo.");
    normas.push("ctb94");
    prioridade = _maisUrgente(prioridade, "IMEDIATA");
  }
  if (/recape|recapead|pavimenta|asfalt/.test(obs) && horizontal) {
    extras.push("Via com pavimento novo ou recomposto deve ser liberada somente com a sinalização refeita.");
    normas.push("ctb88");
  }
  if (extras.length) texto += ` ${extras.join(" ")}`;

  if (prioridade !== "NENHUMA" && !(i.fotos?.length)) alertas.push("Sem foto: registre ao menos uma foto como prova da situação.");

  const ordem = Object.keys(NORMAS);
  normas = [...new Set([...normas, ..._normasDoTipo(m)])].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
  return { prioridade, prazo: PRAZO_PRIO[prioridade], criticidade: crit, texto, normas, alertas };
}

/** Referências curtas, em texto corrido. */
function refsNormas(chaves) { return chaves.map((k) => NORMAS[k]?.ref).filter(Boolean).join("; "); }

/** Itens com providência, ordenados por prioridade (os sem intervenção ficam por último). */
function providenciasDaVistoria(itens) {
  return itens.map((i, k) => ({ i, n: k + 1, p: providenciaItem(i) }))
    .sort((a, b) => ORDEM_PRIO[a.p.prioridade] - ORDEM_PRIO[b.p.prioridade] || a.n - b.n);
}

function contarPrioridades(lista) {
  const c = Object.fromEntries(PRIORIDADES.map((p) => [p[0], 0]));
  lista.forEach((x) => c[x.p.prioridade]++);
  return c;
}
