/* Vistoria de Campo — aplicativo de vistoria de sinalização viária para tablet.
 * Funciona sem internet: todos os dados ficam no próprio aparelho (IndexedDB).
 * Nenhum dado é enviado a servidor algum; a saída é o relatório (PDF), a planilha
 * (CSV), o arquivo de mapa (GeoJSON) e o backup (.json).
 */
"use strict";

// =============================================================== Utilidades ==
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const novoId = () => (crypto.randomUUID ? crypto.randomUUID()
  : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2));
const nf = (n, casas = 0) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const qtd = (n) => (Number.isInteger(Number(n)) ? nf(n, 0) : nf(n, 2));
const coord = (v) => (v == null ? "—" : Number(v).toFixed(6).replace(".", ","));
const agoraIso = () => new Date().toISOString();
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dataBr = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
function dataHoraBr(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
const ROT_ESTADO = Object.fromEntries(ESTADOS);
const ROT_ACAO = Object.fromEntries(ACOES.map((a) => [a[0], a[1]]));
const COR_ACAO = Object.fromEntries(ACOES.map((a) => [a[0], a[2]]));
const ROT_LADO = Object.fromEntries(LADOS);
const ROT_CAT = Object.fromEntries(CATEGORIAS);
const largo = () => matchMedia("(min-width: 900px)").matches;
const GRUPO_RELATORIO = {
  VERTICAL: "Sinalização vertical", HORIZONTAL: "Sinalização horizontal", DISPOSITIVO_AUXILIAR: "Dispositivos auxiliares",
  SEMAFORICA: "Sinalização semafórica", SUPORTE: "Suportes", SERVICO: "Serviços",
};

let temporizadorToast;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("visivel");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => t.classList.remove("visivel"), 3200);
}

// ============================================================ Banco local ==
const BD = {
  bd: null,
  abrir() {
    return new Promise((ok, falha) => {
      const req = indexedDB.open("vistoria-campo", 1);
      req.onupgradeneeded = () => {
        const bd = req.result;
        bd.createObjectStore("vistorias", { keyPath: "id" });
        bd.createObjectStore("itens", { keyPath: "id" }).createIndex("vistoriaId", "vistoriaId");
        const f = bd.createObjectStore("fotos", { keyPath: "id" });
        f.createIndex("itemId", "itemId");
        f.createIndex("vistoriaId", "vistoriaId");
        bd.createObjectStore("kv", { keyPath: "k" });
      };
      req.onsuccess = () => { this.bd = req.result; ok(); };
      req.onerror = () => falha(req.error);
    });
  },
  _tx(lojas, modo, fn) {
    return new Promise((ok, falha) => {
      const tx = this.bd.transaction(lojas, modo);
      let resultado;
      tx.oncomplete = () => ok(resultado);
      tx.onerror = () => falha(tx.error);
      tx.onabort = () => falha(tx.error || new Error("Gravação cancelada"));
      resultado = fn(tx);
    });
  },
  _req(r) { return new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); }); },
  async todos(loja) { return this._req(this.bd.transaction(loja).objectStore(loja).getAll()); },
  async um(loja, id) { return this._req(this.bd.transaction(loja).objectStore(loja).get(id)); },
  async porIndice(loja, indice, valor) {
    return this._req(this.bd.transaction(loja).objectStore(loja).index(indice).getAll(valor));
  },
  gravar(loja, obj) { return this._tx([loja], "readwrite", (tx) => { tx.objectStore(loja).put(obj); }); },
  async apagarVistoria(id) {
    const itens = await this.porIndice("itens", "vistoriaId", id);
    const fotos = await this.porIndice("fotos", "vistoriaId", id);
    return this._tx(["vistorias", "itens", "fotos"], "readwrite", (tx) => {
      tx.objectStore("vistorias").delete(id);
      itens.forEach((i) => tx.objectStore("itens").delete(i.id));
      fotos.forEach((f) => tx.objectStore("fotos").delete(f.id));
    });
  },
};

// ========================================================== Configurações ==
const CONFIG_PADRAO = {
  vistoriadorNome: "", vistoriadorMatricula: "", vistoriadorCargo: "Agente de Trânsito",
  orgaoEnte: "PREFEITURA MUNICIPAL DE TIETÊ", orgaoUf: "Estado de São Paulo",
  orgaoUnidade: "Departamento de Trânsito, Engenharia e Fiscalização", municipio: "Tietê/SP",
  metaGps: 5, carimbo: true, tema: "sistema", seq: 0, ultimoBackup: null, recentes: [],
};
let config = { ...CONFIG_PADRAO };
async function carregarConfig() {
  try {
    const r = await BD.um("kv", "config");
    if (r) config = { ...CONFIG_PADRAO, ...r.v };
  } catch { /* primeira execução */ }
  aplicarTema();
}
async function salvarConfig() { await BD.gravar("kv", { k: "config", v: config }); }
function aplicarTema() {
  if (config.tema === "claro") document.documentElement.dataset.theme = "light";
  else if (config.tema === "escuro") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

let armazenamentoPedido = false;
async function pedirArmazenamentoPersistente() {
  if (armazenamentoPedido) return;
  armazenamentoPedido = true;
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
}

// ===================================================================== GPS ==
const GPS = {
  watchId: null, leituras: [], desde: 0, erro: null, ouvintes: new Set(),
  disponivel: "geolocation" in navigator,
  JANELA: 8000,       // escolhe a melhor leitura dos últimos 8 s (parado junto ao sinal)
  VALIDADE: 120000,   // sem leitura nova, usa a última recebida por até 2 min
  iniciar() {
    if (!this.disponivel) { this.erro = "Este aparelho não informa a localização."; this._avisar(); return; }
    if (this.watchId != null) return;
    this.erro = null;
    this.watchId = navigator.geolocation.watchPosition(
      (p) => {
        this.erro = null;
        this.leituras.push({
          lat: p.coords.latitude, lon: p.coords.longitude, precisao: p.coords.accuracy,
          alt: p.coords.altitude, t: Date.now(),
        });
        const limite = Date.now() - this.VALIDADE;
        this.leituras = this.leituras.filter((l) => l.t >= limite).slice(-80);
        this._avisar();
      },
      (e) => {
        this.erro = e.code === 1
          ? "Localização bloqueada. Libere o acesso à localização para este site nas configurações do navegador."
          : e.code === 3 ? "Procurando sinal de GPS..." : "Sem sinal de GPS. Vá para um local aberto.";
        this._avisar();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  },
  parar() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.leituras = [];
    document.body.classList.remove("gps-buscando");
  },
  /** Descarta as leituras anteriores (após salvar um item ou ao pedir "Medir de novo"). */
  recomecar() { this.desde = Date.now(); this._avisar(); },
  /** Melhor leitura recente. Enquanto o agente caminha, só valem as leituras dos últimos
   *  segundos; se o aparelho não mandar leitura nova (parado no mesmo ponto), vale a última. */
  melhor() {
    const agora = Date.now();
    const inicio = Math.max(agora - this.JANELA, this.desde);
    const janela = this.leituras.filter((l) => l.t >= inicio);
    if (janela.length) return janela.reduce((a, b) => (b.precisao <= a.precisao ? b : a));
    const ultima = this.leituras[this.leituras.length - 1];
    return ultima && agora - ultima.t <= this.VALIDADE ? ultima : null;
  },
  qualidade(fix) {
    if (!fix) return this.erro ? "erro" : "buscando";
    if (fix.precisao <= config.metaGps) return "bom";
    if (fix.precisao <= 15) return "medio";
    return "ruim";
  },
  _avisar() {
    const fix = this.melhor();
    const q = this.qualidade(fix);
    document.body.classList.toggle("gps-buscando", this.watchId != null && q !== "bom");
    this.ouvintes.forEach((f) => f(fix, q));
  },
};

// ================================================================ Dados ==
async function listarVistorias() {
  const [vistorias, itens] = await Promise.all([BD.todos("vistorias"), BD.todos("itens")]);
  const porV = {};
  for (const i of itens) (porV[i.vistoriaId] ||= []).push(i);
  return vistorias
    .map((v) => ({ ...v, itens: porV[v.id] || [] }))
    .sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
}
async function itensDa(vid) {
  return (await BD.porIndice("itens", "vistoriaId", vid)).sort((a, b) => a.capturadoEm.localeCompare(b.capturadoEm));
}
function contarAcoes(itens) {
  const c = Object.fromEntries(ACOES.map((a) => [a[0], 0]));
  itens.forEach((i) => c[i.acao]++);
  return c;
}
function chipsContagem(itens) {
  const c = contarAcoes(itens);
  return ACOES.filter((a) => c[a[0]]).map((a) =>
    `<span class="cont"><i style="background:${a[2]}"></i>${a[1]} <b class="num">${c[a[0]]}</b></span>`).join("");
}
const protocoloTxt = (v) => `Nº ${esc(v.protocolo)}`;

// ================================================================ Rotas ==
let estado = { rota: "", vistoria: null, itens: [], ficha: null };

function ir(hash, substituir = false) {
  if (substituir) history.replaceState(null, "", hash);
  else if (location.hash !== hash) history.pushState(null, "", hash);
  render().then(() => window.scrollTo({ top: 0 }));
}
window.addEventListener("popstate", render);
window.addEventListener("hashchange", render);
// Ao girar o tablet a tela é redesenhada. Imprimir também muda a largura da página:
// nesse caso (relatório aberto) nada é redesenhado, senão o PDF sairia em branco.
matchMedia("(min-width: 900px)").addEventListener("change", () => {
  if (!$("#relatorio").hidden || matchMedia("print").matches) return;
  if (location.hash.startsWith("#v/")) render();
});

async function render() {
  const h = location.hash || "#inicio";
  const [rota, id, sub, extra] = h.slice(1).split("/");
  fecharRelatorio();
  if (rota !== "v") { GPS.parar(); liberarWakeLock(); }
  try {
    if (rota === "nova" || rota === "editar") return await telaFormVistoria(rota === "editar" ? id : null);
    if (rota === "config") return telaConfig();
    if (rota === "v" && id) {
      if (sub === "relatorio") { await telaVistoria(id, null); return abrirRelatorio(id); }
      return await telaVistoria(id, sub === "item" ? extra : sub === "novo" ? "novo" : null);
    }
    return await telaInicio();
  } catch (e) {
    console.error(e);
    $("#tela").innerHTML = `<div class="tela"><div class="aviso">Não foi possível abrir esta tela: ${esc(e.message)}</div>
      <a class="btn" href="#inicio">Voltar ao início</a></div>`;
  }
}

function topo({ voltar = null, titulo = "Vistoria de campo", sub = null, gps = false, extras = "" } = {}) {
  $("#topo").innerHTML = `
    <div class="topo-linha">
      ${voltar ? `<button class="voltar" data-acao="ir" data-destino="${voltar}" aria-label="Voltar">‹<span class="txt-voltar"> Voltar</span></button>` : ""}
      <div class="marca">
        ${voltar ? "" : '<div class="losango" aria-hidden="true"><span>!</span></div>'}
        <h1>${esc(titulo)}<small>${esc(sub ?? config.municipio)}</small></h1>
      </div>
      <div class="topo-acoes">
        ${gps ? '<div class="gps" id="gps-topo" role="status"><span class="ponto"></span><span class="txt">GPS</span> <b class="num">—</b></div>' : ""}
        ${extras}
      </div>
    </div>
    <div class="faixa" aria-hidden="true"></div>`;
}

// =============================================================== Início ==
async function telaInicio() {
  topo({ extras: '<button class="btn-topo" data-acao="ir" data-destino="#config">Configurações</button>' });
  const vistorias = await listarVistorias();
  const totalItens = vistorias.reduce((s, v) => s + v.itens.length, 0);
  const diasBackup = config.ultimoBackup ? (Date.now() - new Date(config.ultimoBackup)) / 864e5 : Infinity;
  let uso = "";
  try {
    const e = await navigator.storage?.estimate?.();
    if (e?.usage) uso = `Espaço usado no aparelho: ${nf(e.usage / 1048576, 1)} MB.`;
  } catch { /* opcional */ }

  $("#tela").innerHTML = `
    <div class="tela">
      ${totalItens && diasBackup > 7 ? `<div class="aviso" role="note"><b>Faça uma cópia de segurança.</b>
        Os dados ficam somente neste tablet. ${config.ultimoBackup ? `A última cópia foi em ${dataBr(config.ultimoBackup)}.` : "Nenhuma cópia foi feita ainda."}
        <button class="btn-texto" data-acao="backup-tudo">Fazer agora</button></div>` : ""}
      ${!config.vistoriadorNome ? `<div class="aviso" role="note">Informe seu nome e matrícula em
        <a href="#config">Configurações</a>. Eles aparecem no relatório e no carimbo das fotos.</div>` : ""}
      <div class="cab-tela">
        <h2>Vistorias</h2>
        ${vistorias.length > 4 ? '<div class="busca"><label class="sr" for="busca-v">Buscar vistoria</label><input id="busca-v" type="search" placeholder="Buscar por rua, bairro ou número"></div>' : ""}
        <div class="direita"><button class="btn btn-primario btn-grande" data-acao="ir" data-destino="#nova">Nova vistoria</button></div>
      </div>
      ${vistorias.length ? `<div class="lista-vistorias" id="lista-v">${vistorias.map(cartaoVistoria).join("")}</div>` : `
        <div class="vazio cartao">
          <svg width="72" height="72" viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="12" width="40" height="40" rx="3" transform="rotate(45 32 32)" fill="#f2b705" stroke="#111" stroke-width="2.5"/><text x="32" y="41" text-anchor="middle" font-weight="700" font-size="24" fill="#111">!</text></svg>
          <h3 style="margin:0">Nenhuma vistoria neste tablet</h3>
          <p>Toque em <b>Nova vistoria</b>, informe a rua e registre cada sinal no local. O GPS marca a posição e a câmera registra a foto.</p>
          <button class="btn" data-acao="demo">Criar uma vistoria de demonstração</button>
        </div>`}
      <div class="rodape-inicio">
        <span>${uso}</span>
        <div class="direita">
          <button class="btn" data-acao="backup-tudo" ${vistorias.length ? "" : "disabled"}>Cópia de segurança</button>
          <label class="btn botao-foto">Restaurar cópia<input type="file" accept="application/json,.json" data-acao="restaurar"></label>
        </div>
      </div>
    </div>`;
  $("#busca-v")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$("#lista-v .vistoria-cartao").forEach((c) => { c.hidden = q && !c.dataset.busca.includes(q); });
  });
}

function cartaoVistoria(v) {
  const semGps = v.itens.filter((i) => i.lat == null).length;
  return `<button class="cartao vistoria-cartao ${v.status}" data-acao="ir" data-destino="#v/${v.id}"
      data-busca="${esc(`${v.protocolo} ${v.logradouro} ${v.bairro || ""}`.toLowerCase())}">
    <div class="linha1"><span class="num prot">${protocoloTxt(v)}</span>
      <span class="etiqueta ${v.status}">${v.status === "CONCLUIDA" ? "Concluída" : "Em andamento"}</span></div>
    <h3>${esc(v.logradouro)}</h3>
    <div class="meta">${esc(v.bairro || "Bairro não informado")}, ${dataBr(v.data)}, ${v.itens.length} ${v.itens.length === 1 ? "item" : "itens"}${semGps ? `, <span class="sem-gps">${semGps} sem GPS</span>` : ""}</div>
    <div class="contagens">${chipsContagem(v.itens)}</div>
  </button>`;
}

// ===================================================== Dados da vistoria ==
async function telaFormVistoria(id) {
  const v = id ? await BD.um("vistorias", id) : null;
  if (id && !v) return ir("#inicio", true);
  topo({ voltar: id ? `#v/${id}` : "#inicio", titulo: id ? "Dados da vistoria" : "Nova vistoria", sub: id ? protocoloTxt(v) : config.municipio });
  const d = v || { data: hojeLocal(), vistoriador: { nome: config.vistoriadorNome, matricula: config.vistoriadorMatricula, cargo: config.vistoriadorCargo } };
  $("#tela").innerHTML = `
    <div class="tela">
      <form class="form" id="form-vistoria" novalidate>
        <div class="cartao secao-form">
          <h3>Local</h3>
          <label class="campo">Logradouro <input class="campo-texto" id="f-logradouro" required autocomplete="off" value="${esc(d.logradouro || "")}" placeholder="Ex.: Rua XV de Novembro"></label>
          <div class="duas">
            <label class="campo">Bairro <input class="campo-texto" id="f-bairro" autocomplete="off" value="${esc(d.bairro || "")}"></label>
            <label class="campo">Data da vistoria <input class="campo-texto" id="f-data" type="date" value="${esc(d.data)}"></label>
          </div>
          <label class="campo">Trecho de referência <small>Ex.: entre a Praça e a Av. principal</small>
            <input class="campo-texto" id="f-trecho" autocomplete="off" value="${esc(d.trecho || "")}"></label>
          <label class="campo">Observações gerais <small>Aparecem no fim do relatório</small>
            <textarea id="f-obs">${esc(d.observacoes || "")}</textarea></label>
        </div>
        <div class="cartao secao-form">
          <h3>Responsável pela vistoria</h3>
          <div class="duas">
            <label class="campo">Nome <input class="campo-texto" id="f-nome" required value="${esc(d.vistoriador?.nome || "")}"></label>
            <label class="campo">Matrícula <input class="campo-texto" id="f-matricula" value="${esc(d.vistoriador?.matricula || "")}"></label>
          </div>
          <label class="campo">Cargo <input class="campo-texto" id="f-cargo" value="${esc(d.vistoriador?.cargo || "")}"></label>
        </div>
        <p class="sem-gps" id="erro-form" role="alert" hidden></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primario btn-grande" type="submit">${id ? "Salvar dados" : "Começar vistoria"}</button>
          ${id ? `<button class="btn btn-perigo" type="button" data-acao="excluir-vistoria" data-id="${id}">Excluir vistoria</button>` : ""}
        </div>
      </form>
    </div>`;
  $("#form-vistoria").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (s) => $(s).value.trim();
    if (val("#f-logradouro").length < 2 || !val("#f-nome")) {
      const erro = $("#erro-form");
      erro.textContent = "Informe o logradouro e o nome do responsável.";
      erro.hidden = false;
      return;
    }
    const agora = agoraIso();
    let reg = v;
    if (!reg) {
      config.seq = (config.seq || 0) + 1;
      reg = { id: novoId(), protocolo: `${new Date().getFullYear()}/${String(config.seq).padStart(4, "0")}`, status: "ABERTA", criadoEm: agora };
    }
    Object.assign(reg, {
      logradouro: val("#f-logradouro"), bairro: val("#f-bairro"), data: $("#f-data").value || hojeLocal(),
      trecho: val("#f-trecho"), observacoes: val("#f-obs"),
      vistoriador: { nome: val("#f-nome"), matricula: val("#f-matricula"), cargo: val("#f-cargo") },
      atualizadoEm: agora,
    });
    config.vistoriadorNome = reg.vistoriador.nome;
    config.vistoriadorMatricula = reg.vistoriador.matricula;
    config.vistoriadorCargo = reg.vistoriador.cargo;
    await BD.gravar("vistorias", reg);
    await salvarConfig();
    pedirArmazenamentoPersistente();
    ir(`#v/${reg.id}`, true);
  });
  if (!id) $("#f-logradouro").focus();
}

// ============================================================= Vistoria ==
async function telaVistoria(id, abrirItem) {
  const v = await BD.um("vistorias", id);
  if (!v) return ir("#inicio", true);
  const itens = await itensDa(id);
  estado.vistoria = v;
  estado.itens = itens;

  // A ficha fica em memória enquanto o app estiver aberto (não perde o que foi preenchido)
  if (abrirItem && abrirItem !== "novo") {
    if (!estado.ficha || estado.ficha.itemId !== abrirItem) await carregarFichaDoItem(abrirItem);
  } else if (!estado.ficha || estado.ficha.vistoriaId !== id || (estado.ficha.itemId && !abrirItem)) {
    estado.ficha = fichaNova(id);
  }

  topo({
    voltar: "#inicio", titulo: v.logradouro, sub: `${protocoloTxt(v)}, ${dataBr(v.data)}`, gps: true,
    extras: `<button class="btn-topo" data-acao="wakelock" aria-pressed="${!!wakeLock}" title="Impede que a tela apague durante a vistoria">Tela ligada</button>`,
  });

  const fichaVisivel = largo() || abrirItem;
  $("#tela").innerHTML = `
    <div class="tela">
      <div class="vistoria-grade">
        <div class="painel-lista">
          <div class="cartao cab-vistoria">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <span class="etiqueta ${v.status}">${v.status === "CONCLUIDA" ? "Concluída" : "Em andamento"}</span>
              <button class="btn-texto" data-acao="ir" data-destino="#editar/${v.id}">Editar dados</button>
            </div>
            <h2>${esc(v.logradouro)}</h2>
            <div class="meta">${esc([v.bairro, v.trecho].filter(Boolean).join(", ") || "Sem bairro ou trecho informado")}<br>
              ${esc(v.vistoriador?.nome || "")}${v.vistoriador?.matricula ? `, matrícula ${esc(v.vistoriador.matricula)}` : ""}</div>
            <div class="contagens">${chipsContagem(itens) || '<span class="meta">Nenhum item registrado ainda.</span>'}</div>
            <div class="botoes">
              <button class="btn btn-primario" data-acao="ir" data-destino="#v/${v.id}/relatorio" ${itens.length ? "" : "disabled"}>Relatório (PDF)</button>
              <button class="btn" data-acao="exportar" ${itens.length ? "" : "disabled"}>Exportar</button>
              <button class="btn" data-acao="status">${v.status === "CONCLUIDA" ? "Reabrir" : "Concluir vistoria"}</button>
            </div>
            <div id="painel-exportar" hidden></div>
          </div>
          <div class="cartao" style="padding:12px;display:grid;gap:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <b>Posição dos itens</b>
              <button class="btn-texto" style="margin-left:auto" data-acao="mapa" id="btn-mapa">Abrir mapa</button>
            </div>
            <div class="mapa-caixa" id="mapa-caixa" style="height:220px">${croquiSvg(itens, 600, 300, true)}</div>
          </div>
          <ol class="lista-itens" id="lista-itens" aria-label="Itens registrados">${itens.map((i, k) => linhaItem(i, k)).join("")}</ol>
        </div>
        <section class="cartao ficha ${largo() ? "" : "ficha-flutuante"} ${fichaVisivel ? "" : "ficha-oculta-estreito"}" id="ficha" aria-label="Registro do item"></section>
      </div>
      <button class="btn btn-primario btn-grande botao-novo-item" data-acao="ir" data-destino="#v/${v.id}/novo">Registrar sinal</button>
    </div>`;
  if (fichaVisivel) {
    renderFicha();
    GPS.iniciar();
  } else {
    GPS.iniciar(); // aquece o GPS enquanto o agente olha a lista
  }
  GPS.ouvintes.clear();
  GPS.ouvintes.add(atualizarIndicadoresGps);
  GPS._avisar();
}

function linhaItem(i, k) {
  const m = POR_CODIGO[i.materialCodigo] || { cod: i.materialCodigo, desc: "Item", forma: "outro" };
  const ativo = estado.ficha?.itemId === i.id;
  return `<li><button class="item-linha ${ativo ? "ativo" : ""}" data-acao="ir" data-destino="#v/${i.vistoriaId}/item/${i.id}">
    <span class="n num">${k + 1}</span>${glifo(m)}
    <span style="min-width:0"><span class="tit"><span class="cod">${esc(m.mbst || m.cod)}</span>${esc(m.desc)}</span>
      <span class="sub">${ROT_ESTADO[i.estado]}, ${qtd(i.quantidade)} ${UNIDADE[m.un] || ""}${i.lado ? `, lado ${ROT_LADO[i.lado].toLowerCase()}` : ""}${i.observacao ? `. ${esc(i.observacao.slice(0, 60))}` : ""}</span></span>
    <span class="lado-dir"><span class="pilula" style="background:${COR_ACAO[i.acao]}">${ROT_ACAO[i.acao]}</span>
      <span>${i.lat == null ? '<span class="sem-gps">sem GPS</span>' : `±${nf(i.precisao ?? 0, 0)} m`}${i.fotos?.length ? `, ${i.fotos.length} foto${i.fotos.length > 1 ? "s" : ""}` : ""}</span></span>
  </button></li>`;
}

function atualizarIndicadoresGps(fix, q) {
  const topoGps = $("#gps-topo");
  if (topoGps) {
    topoGps.className = `gps ${q}`;
    $(".num", topoGps).textContent = fix ? `±${nf(fix.precisao, 0)} m` : q === "erro" ? "sem sinal" : "buscando";
  }
  const cart = $("#gps-cartao");
  if (!cart || estado.ficha?.posicaoFixa || !$("#gps-valor")) return;
  cart.className = `gps-cartao ${q}`;
  const textos = {
    bom: "Posição precisa", medio: "Precisão aceitável", ruim: "Precisão baixa, aguarde ou vá a céu aberto",
    buscando: "Procurando satélites...", erro: GPS.erro || "Sem sinal",
  };
  $("#gps-valor").textContent = fix ? `±${nf(fix.precisao, 0)} m` : "—";
  $("#gps-texto").textContent = textos[q];
  $("#gps-coord").textContent = fix ? `${coord(fix.lat)}, ${coord(fix.lon)}` : GPS.erro && q === "erro" ? GPS.erro : "Mantenha o tablet junto ao sinal.";
}

// ================================================================ Ficha ==
function fichaNova(vistoriaId) {
  return {
    vistoriaId, itemId: null, material: null, cat: estado.ficha?.cat || "R", busca: "",
    quantidade: 1, estado: "RUIM", acao: "SUBSTITUIR", lado: "DIREITO", observacao: "",
    fotos: [], fotosRemovidas: [], posicaoFixa: null, confirmarSemGps: false, confirmarExclusao: false,
    compr: "", larg: "",
  };
}

async function carregarFichaDoItem(itemId) {
  const i = await BD.um("itens", itemId);
  if (!i) { estado.ficha = fichaNova(estado.vistoria.id); return; }
  const fotos = await BD.porIndice("fotos", "itemId", itemId);
  liberarUrlsFicha();
  estado.ficha = {
    ...fichaNova(i.vistoriaId), itemId: i.id, material: i.materialCodigo,
    cat: POR_CODIGO[i.materialCodigo]?.grupo || "R", quantidade: i.quantidade, estado: i.estado,
    acao: i.acao, lado: i.lado, observacao: i.observacao || "",
    fotos: fotos.sort((a, b) => a.capturadaEm.localeCompare(b.capturadaEm))
      .map((f) => ({ id: f.id, blob: f.blob, url: URL.createObjectURL(f.blob), capturadaEm: f.capturadaEm, nova: false })),
    posicaoFixa: i.lat == null ? null : { lat: i.lat, lon: i.lon, precisao: i.precisao, alt: i.alt },
    capturadoEm: i.capturadoEm,
  };
}
function liberarUrlsFicha() { estado.ficha?.fotos.forEach((f) => URL.revokeObjectURL(f.url)); }

function renderFicha() {
  const f = estado.ficha;
  const editando = !!f.itemId;
  const numero = editando ? estado.itens.findIndex((i) => i.id === f.itemId) + 1 : estado.itens.length + 1;
  $("#ficha").innerHTML = `
    <div class="ficha-cab">
      <h2>${editando ? `Item nº ${numero}` : `Novo item, nº ${numero}`}</h2>
      ${editando ? `<button class="btn-texto" data-acao="ficha-nova">Registrar outro</button>` : ""}
      <button class="btn fechar ficha-fechar-estreito" data-acao="ir" data-destino="#v/${f.vistoriaId}">Fechar</button>
    </div>
    <div class="ficha-corpo">
      <div class="bloco">
        <div class="rotulo">Localização</div>
        <div id="area-gps">${blocoGps()}</div>
      </div>
      <div class="bloco">
        <div class="rotulo">Sinal ou dispositivo <small id="sel-resumo"></small></div>
        <div id="sel-box"></div>
        ${config.recentes?.length ? `<div class="recentes" aria-label="Usados recentemente">${config.recentes.map((c) => POR_CODIGO[c]).filter(Boolean)
          .map((m) => `<button class="recente" data-acao="material" data-cod="${m.cod}">${glifo(m)}<span class="num">${esc(m.mbst || m.cod)}</span></button>`).join("")}</div>` : ""}
        <div class="abas" role="group" aria-label="Tipo de sinalização">${GRUPOS.map(([c, r]) =>
          `<button class="aba" data-acao="cat" data-cat="${c}" aria-pressed="${f.cat === c && !f.busca}">${r}</button>`).join("")}</div>
        <label class="sr" for="busca-sinal">Buscar sinal</label>
        <input class="campo-texto" id="busca-sinal" type="search" placeholder="Buscar por código ou nome (ex.: R-19, faixa, lombada)" value="${esc(f.busca)}" autocomplete="off">
        <div class="grade-sinais" id="grade-sinais"></div>
      </div>
      <div class="bloco">
        <div class="rotulo">Quantidade</div>
        <div class="quantidade">
          <button class="passo" type="button" data-acao="qtd" data-passo="-1" aria-label="Diminuir">−</button>
          <label class="sr" for="qtd">Quantidade</label>
          <input class="campo-texto" id="qtd" inputmode="decimal" value="${esc(String(f.quantidade).replace(".", ","))}">
          <button class="passo" type="button" data-acao="qtd" data-passo="1" aria-label="Aumentar">+</button>
          <span class="un" id="qtd-un"></span>
        </div>
        <div class="calc-area" id="calc-area" hidden>
          Calcular área: <label class="sr" for="compr">Comprimento</label><input class="campo-texto" id="compr" inputmode="decimal" placeholder="compr. (m)" value="${esc(f.compr)}">
          × <label class="sr" for="larg">Largura</label><input class="campo-texto" id="larg" inputmode="decimal" placeholder="larg. (m)" value="${esc(f.larg)}"> m
        </div>
      </div>
      <div class="bloco">
        <div class="rotulo">Estado de conservação</div>
        <div class="segmentos" role="group" aria-label="Estado de conservação">${ESTADOS.map(([c, r]) =>
          `<button class="seg" data-acao="campo" data-campo="estado" data-valor="${c}" aria-pressed="${f.estado === c}">${r}</button>`).join("")}</div>
      </div>
      <div class="bloco">
        <div class="rotulo">Ação recomendada</div>
        <div class="acoes" role="group" aria-label="Ação recomendada">${ACOES.map(([c, r, cor]) =>
          `<button class="acao-btn" style="--cor:${cor}" data-acao="campo" data-campo="acao" data-valor="${c}" aria-pressed="${f.acao === c}"><i></i>${r}</button>`).join("")}</div>
      </div>
      <div class="bloco">
        <div class="rotulo">Lado da via <small>no sentido do tráfego</small></div>
        <div class="segmentos" role="group" aria-label="Lado da via">${LADOS.map(([c, r]) =>
          `<button class="seg" data-acao="campo" data-campo="lado" data-valor="${c}" aria-pressed="${f.lado === c}">${r}</button>`).join("")}</div>
      </div>
      <div class="bloco">
        <div class="rotulo">Fotos <small>enquadre o sinal; evite pessoas e placas de veículos</small></div>
        <div class="fotos" id="fotos"></div>
      </div>
      <div class="bloco">
        <label class="rotulo" for="obs">Observação</label>
        <textarea id="obs" maxlength="2000" placeholder="Ex.: película desbotada, placa obstruída por árvore">${esc(f.observacao)}</textarea>
      </div>
      <div id="area-confirmar"></div>
    </div>
    <div class="ficha-rodape">
      <button class="btn btn-primario btn-grande" data-acao="salvar-item">${editando ? "Salvar alterações" : "Salvar item"}</button>
      ${editando ? `<button class="btn btn-perigo" data-acao="excluir-item">Excluir</button>` : `<button class="btn" data-acao="repetir" ${estado.itens.length ? "" : "disabled"} title="Preenche com os dados do último item">Repetir último</button>`}
    </div>`;
  atualizarSelecionado();
  atualizarGrade();
  atualizarFotos();
  atualizarIndicadoresGps(GPS.melhor(), GPS.qualidade(GPS.melhor()));

  $("#busca-sinal").addEventListener("input", (e) => {
    f.busca = e.target.value;
    $$(".aba").forEach((a) => a.setAttribute("aria-pressed", String(!f.busca && a.dataset.cat === f.cat)));
    atualizarGrade();
  });
  $("#qtd").addEventListener("input", (e) => { f.quantidade = e.target.value; });
  $("#obs").addEventListener("input", (e) => { f.observacao = e.target.value; });
  for (const idCampo of ["compr", "larg"]) {
    $(`#${idCampo}`).addEventListener("input", (e) => {
      f[idCampo] = e.target.value;
      const a = parseFloat(f.compr.replace(",", ".")), b = parseFloat(f.larg.replace(",", "."));
      if (a > 0 && b > 0) {
        f.quantidade = Math.round(a * b * 100) / 100;
        $("#qtd").value = String(f.quantidade).replace(".", ",");
      }
    });
  }
}

function blocoGps() {
  const f = estado.ficha;
  if (f.posicaoFixa) {
    const p = f.posicaoFixa;
    return `<div class="gps-cartao bom" id="gps-cartao">
      <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>
      <div><div class="valor">±${nf(p.precisao ?? 0, 0)} m</div>
        <div id="gps-texto">Posição registrada em ${dataHoraBr(f.capturadoEm)}</div>
        <div class="coord" id="gps-coord">${coord(p.lat)}, ${coord(p.lon)}</div></div>
      <button class="btn" data-acao="gps-atualizar">Usar posição atual</button>
    </div>`;
  }
  return `<div class="gps-cartao buscando" id="gps-cartao">
    <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.9 3A9 9 0 0 0 13 3.1V1h-2v2.1A9 9 0 0 0 3.1 11H1v2h2.1a9 9 0 0 0 7.9 7.9V23h2v-2.1a9 9 0 0 0 7.9-7.9H23v-2h-2.1zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/></svg>
    <div><div class="valor" id="gps-valor">—</div><div id="gps-texto">Procurando satélites...</div><div class="coord" id="gps-coord"></div></div>
    <button class="btn" data-acao="gps-recomecar" title="Descarta as leituras anteriores">Medir de novo</button>
  </div>`;
}

function atualizarSelecionado() {
  const f = estado.ficha;
  const m = POR_CODIGO[f.material];
  $("#sel-box").innerHTML = m
    ? `<div class="selecionado">${glifo(m)}<div><div class="cod">${esc(m.mbst || m.cod)}</div><div>${esc(m.desc)}</div></div></div>`
    : `<div class="aviso" style="margin:0">Escolha abaixo o sinal ou dispositivo vistoriado.</div>`;
  $("#qtd-un").textContent = m ? UNIDADE[m.un] : "";
  $("#calc-area").hidden = !(m && m.un === "M2");
}

function atualizarGrade() {
  const f = estado.ficha;
  const q = f.busca.trim().toLowerCase();
  const lista = q
    ? CATALOGO.filter((m) => `${m.cod} ${m.mbst} ${m.desc}`.toLowerCase().includes(q))
    : CATALOGO.filter((m) => m.grupo === f.cat);
  let subAtual = null;
  $("#grade-sinais").innerHTML = lista.length ? lista.map((m) => {
    const titulo = !q && m.sub && m.sub !== subAtual ? `<h4 class="sub-grade">${esc(m.sub)}</h4>` : "";
    subAtual = m.sub;
    return `${titulo}<button class="sinal" data-acao="material" data-cod="${m.cod}" aria-pressed="${f.material === m.cod}">
      ${glifo(m)}<span class="cod">${esc(m.mbst || m.cod)}</span><span class="d">${esc(m.desc)}</span>
    </button>`;
  }).join("") : `<p class="meta">Nenhum item encontrado para "${esc(f.busca)}".</p>`;
  const contagem = $("#sel-resumo");
  if (contagem) contagem.textContent = q ? `${lista.length} encontrado(s)` : `${lista.length} itens nesta aba`;
}

function atualizarFotos() {
  const f = estado.ficha;
  $("#fotos").innerHTML = f.fotos.map((foto, k) => `
    <div class="miniatura"><img src="${foto.url}" alt="Foto ${k + 1}">
      <button data-acao="remover-foto" data-k="${k}" aria-label="Remover foto ${k + 1}">×</button></div>`).join("") + `
    <label class="btn btn-grande botao-foto">${f.fotos.length ? "Mais uma foto" : "Tirar foto"}
      <input type="file" accept="image/*" capture="environment" data-acao="foto"></label>`;
}

async function adicionarFoto(arquivo) {
  const f = estado.ficha;
  const btn = $(".botao-foto");
  if (btn) btn.firstChild.textContent = "Processando foto...";
  try {
    const pos = f.posicaoFixa || GPS.melhor();
    const m = POR_CODIGO[f.material];
    const numero = f.itemId ? estado.itens.findIndex((i) => i.id === f.itemId) + 1 : estado.itens.length + 1;
    const blob = await processarFoto(arquivo, config.carimbo ? [
      `${config.municipio} — Vistoria nº ${estado.vistoria.protocolo} — Item ${numero}${m ? ` (${m.mbst || m.cod})` : ""}`,
      `${new Date().toLocaleString("pt-BR")} — ${pos ? `${coord(pos.lat)}, ${coord(pos.lon)} (±${nf(pos.precisao, 0)} m)` : "sem posição GPS"}`,
      estado.vistoria.logradouro,
    ] : null);
    f.fotos.push({ id: novoId(), blob, url: URL.createObjectURL(blob), capturadaEm: agoraIso(), nova: true });
  } catch (e) {
    toast("Não foi possível ler a foto. Tente novamente.");
    console.error(e);
  }
  atualizarFotos();
}

/** Reduz para 1600 px (fotos de 12 MP ocupariam o armazenamento rapidamente) e aplica o carimbo. */
async function processarFoto(arquivo, linhas) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 1600;
    const fator = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * fator), h = Math.round(img.naturalHeight * fator);
    const tela = document.createElement("canvas");
    tela.width = w; tela.height = h;
    const ctx = tela.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    if (linhas) {
      const fs = Math.max(14, Math.round(w / 58));
      const alt = Math.round(fs * 1.45 * linhas.length + fs * 0.9);
      ctx.fillStyle = "rgba(0,0,0,.62)";
      ctx.fillRect(0, h - alt, w, alt);
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "top";
      linhas.forEach((l, k) => {
        ctx.font = `${k === 0 ? "700" : "500"} ${fs}px Arial, sans-serif`;
        ctx.fillText(l, Math.round(fs * 0.6), h - alt + Math.round(fs * 0.45) + Math.round(k * fs * 1.45), w - fs);
      });
    }
    return await new Promise((ok, falha) => tela.toBlob((b) => (b ? ok(b) : falha(new Error("toBlob"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function salvarItem(semGps = false) {
  const f = estado.ficha;
  const conf = $("#area-confirmar");
  if (!f.material) {
    conf.innerHTML = '<div class="confirmar" role="alert"><b>Escolha o sinal ou dispositivo antes de salvar.</b></div>';
    $("#sel-box").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const quantidade = parseFloat(String(f.quantidade).replace(",", "."));
  if (!(quantidade > 0)) {
    conf.innerHTML = '<div class="confirmar" role="alert"><b>Informe uma quantidade maior que zero.</b></div>';
    $("#qtd").focus();
    return;
  }
  const pos = f.posicaoFixa || GPS.melhor();
  if (!pos && !semGps) {
    conf.innerHTML = `<div class="confirmar" role="alert">
      <b>O GPS ainda não encontrou a posição.</b>
      <span>Aguarde alguns segundos a céu aberto. Se precisar, salve sem coordenada e descreva o local na observação.</span>
      <div class="botoes"><button class="btn" data-acao="salvar-sem-gps">Salvar sem GPS</button>
      <button class="btn btn-texto" data-acao="limpar-confirmar">Aguardar o GPS</button></div></div>`;
    conf.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const agora = agoraIso();
  const antigo = f.itemId ? await BD.um("itens", f.itemId) : null;
  const item = {
    id: f.itemId || novoId(), vistoriaId: f.vistoriaId, materialCodigo: f.material, quantidade,
    estado: f.estado, acao: f.acao, lado: f.lado, observacao: f.observacao.trim(),
    lat: pos?.lat ?? null, lon: pos?.lon ?? null, precisao: pos?.precisao ?? null, alt: pos?.alt ?? null,
    capturadoEm: antigo?.capturadoEm || agora, atualizadoEm: agora,
    fotos: f.fotos.map((x) => x.id),
  };
  await BD._tx(["itens", "fotos", "vistorias"], "readwrite", (tx) => {
    tx.objectStore("itens").put(item);
    f.fotos.filter((x) => x.nova).forEach((x) => tx.objectStore("fotos").put({
      id: x.id, itemId: item.id, vistoriaId: item.vistoriaId, blob: x.blob, capturadaEm: x.capturadaEm,
    }));
    f.fotosRemovidas.forEach((id) => tx.objectStore("fotos").delete(id));
    tx.objectStore("vistorias").put({ ...estado.vistoria, atualizadoEm: agora });
  });
  config.recentes = [f.material, ...(config.recentes || []).filter((c) => c !== f.material)].slice(0, 6);
  salvarConfig();
  pedirArmazenamentoPersistente();
  const numero = f.itemId ? estado.itens.findIndex((i) => i.id === f.itemId) + 1 : estado.itens.length + 1;
  toast(f.itemId ? `Item nº ${numero} atualizado.` : `Item nº ${numero} salvo.`);
  liberarUrlsFicha();
  estado.ficha = fichaNova(f.vistoriaId);
  ir(`#v/${f.vistoriaId}`, true);
  GPS.recomecar(); // o próximo item usa somente leituras feitas depois deste
}

async function excluirItem() {
  const f = estado.ficha;
  const fotos = await BD.porIndice("fotos", "itemId", f.itemId);
  await BD._tx(["itens", "fotos"], "readwrite", (tx) => {
    tx.objectStore("itens").delete(f.itemId);
    fotos.forEach((x) => tx.objectStore("fotos").delete(x.id));
  });
  toast("Item excluído.");
  liberarUrlsFicha();
  estado.ficha = fichaNova(f.vistoriaId);
  ir(`#v/${f.vistoriaId}`, true);
}

async function repetirUltimo() {
  const ultimo = estado.itens[estado.itens.length - 1];
  if (!ultimo) return;
  Object.assign(estado.ficha, {
    material: ultimo.materialCodigo, cat: POR_CODIGO[ultimo.materialCodigo]?.grupo || estado.ficha.cat,
    quantidade: ultimo.quantidade, estado: ultimo.estado, acao: ultimo.acao, lado: ultimo.lado, busca: "",
  });
  renderFicha();
  toast("Dados do último item copiados. A posição e as fotos são novas.");
}

// ================================================================ Mapa ==
function croquiSvg(itens, W, H, compacto = false) {
  const comGps = itens.map((i, k) => ({ ...i, n: k + 1 })).filter((i) => i.lat != null);
  if (!comGps.length) {
    return `<div class="msg">${itens.length ? "Os itens desta vistoria estão sem coordenadas GPS." : "Os pontos aparecem aqui conforme os itens são registrados."}</div>`;
  }
  const lat0 = comGps.reduce((s, i) => s + i.lat, 0) / comGps.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const xs = comGps.map((i) => i.lon * kx), ys = comGps.map((i) => i.lat * ky);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const pad = 26;
  // Mínimo de 20 m em cada eixo para um único ponto não "explodir" a escala
  const esc_ = Math.min((W - 2 * pad) / Math.max(maxx - minx, 20), (H - 2 * pad - 14) / Math.max(maxy - miny, 20));
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const P = (x, y) => [W / 2 + (x - cx) * esc_, (H - 14) / 2 - (y - cy) * esc_];
  const pts = comGps.map((i, k) => [...P(xs[k], ys[k]), i]);
  const ocupados = pts.map(([x, y]) => [x - 6, y - 6, x + 6, y + 6]);
  const livre = (a) => ocupados.every((b) => a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  let marcas = "", rotulos = "";
  for (const [x, y, i] of pts) {
    marcas += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${compacto ? 8 : 6.5}" fill="${COR_ACAO[i.acao]}" stroke="#fff" stroke-width="1.6"/>`;
    const tw = (compacto ? 10 : 7) * String(i.n).length;
    const cand = [[8, -4], [8, 10], [-8 - tw, -4], [-8 - tw, 10], [-tw / 2, -10], [-tw / 2, 20]];
    let [dx, dy] = cand[0];
    for (const [a, b] of cand) { if (livre([x + a, y + b - 10, x + a + tw, y + b])) { dx = a; dy = b; break; } }
    ocupados.push([x + dx, y + dy - 10, x + dx + tw, y + dy]);
    rotulos += `<text x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" font-size="${compacto ? 16 : 11}" font-weight="700" font-family="Arial, sans-serif" fill="#1b1f23" stroke="#fff" stroke-width="3" paint-order="stroke">${i.n}</text>`;
  }
  // Escala "redonda" e norte
  const alvo = (W * 0.22) / esc_;
  const pot = 10 ** Math.floor(Math.log10(alvo));
  const metros = [5, 2, 1].map((b) => b * pot).find((v) => v <= alvo) || pot;
  const comp = metros * esc_;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Croqui com ${comGps.length} itens">
    <rect width="${W}" height="${H}" fill="#f6f7f8"/>
    ${marcas}${rotulos}
    <g transform="translate(${W - 22},${16})"><path d="M0 0l7 18H-7z" fill="#1b1f23"/><text y="30" text-anchor="middle" font-size="11" font-weight="700" font-family="Arial" fill="#1b1f23">N</text></g>
    <g transform="translate(${pad},${H - 12})" font-family="Arial" font-size="${compacto ? 15 : 11}" fill="#1b1f23">
      <path d="M0 -4v8M0 0h${comp.toFixed(1)}M${comp.toFixed(1)} -4v8" stroke="#1b1f23" stroke-width="1.5"/>
      <text x="${(comp + 6).toFixed(1)}" y="4">${nf(metros, 0)} m</text></g>
  </svg>`;
}

let leafletCarregando = null;
function carregarLeaflet() {
  if (window.L) return Promise.resolve();
  leafletCarregando ??= new Promise((ok, falha) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    css.crossOrigin = "";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    js.crossOrigin = "";
    js.onload = ok;
    js.onerror = () => { leafletCarregando = null; falha(new Error("offline")); };
    document.head.appendChild(js);
  });
  return leafletCarregando;
}

async function abrirMapa() {
  const caixa = $("#mapa-caixa");
  const btn = $("#btn-mapa");
  if (caixa.dataset.mapa) {
    caixa.dataset.mapa = "";
    caixa.style.height = "220px";
    caixa.innerHTML = croquiSvg(estado.itens, 600, 300, true);
    btn.textContent = "Abrir mapa";
    return;
  }
  btn.textContent = "Carregando...";
  try {
    if (!navigator.onLine) throw new Error("offline");
    await carregarLeaflet();
  } catch {
    btn.textContent = "Abrir mapa";
    toast("O mapa precisa de internet. O croqui continua disponível sem conexão.");
    return;
  }
  caixa.dataset.mapa = "1";
  caixa.style.height = "360px";
  caixa.innerHTML = "";
  btn.textContent = "Voltar ao croqui";
  const mapa = L.map(caixa).setView([-23.1017, -47.7164], 15);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, maxNativeZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  const pts = [];
  estado.itens.forEach((i, k) => {
    if (i.lat == null) return;
    const m = POR_CODIGO[i.materialCodigo];
    pts.push([i.lat, i.lon]);
    L.circleMarker([i.lat, i.lon], { radius: 9, color: "#fff", weight: 2, fillColor: COR_ACAO[i.acao], fillOpacity: 1 })
      .bindTooltip(String(k + 1), { permanent: true, direction: "right", offset: [8, 0] })
      .bindPopup(`<b>${k + 1}. ${esc(m?.mbst || m?.cod || "")}</b> ${esc(m?.desc || "")}<br>${ROT_ACAO[i.acao]}, ${ROT_ESTADO[i.estado].toLowerCase()}`)
      .addTo(mapa);
  });
  const atual = GPS.melhor();
  if (atual) L.circle([atual.lat, atual.lon], { radius: atual.precisao, color: "#1565c0", weight: 1, fillOpacity: 0.15 }).addTo(mapa);
  if (pts.length) mapa.fitBounds(pts, { padding: [30, 30], maxZoom: 19 });
  else if (atual) mapa.setView([atual.lat, atual.lon], 18);
}

// ============================================================ Relatório ==
let urlsRelatorio = [];
function fecharRelatorio() {
  const r = $("#relatorio");
  if (r && !r.hidden) { r.hidden = true; r.innerHTML = ""; }
  urlsRelatorio.forEach((u) => URL.revokeObjectURL(u));
  urlsRelatorio = [];
}

async function abrirRelatorio(id) {
  const v = await BD.um("vistorias", id);
  const itens = await itensDa(id);
  const fotos = await BD.porIndice("fotos", "vistoriaId", id);
  const fotosPorItem = {};
  for (const f of fotos.sort((a, b) => a.capturadaEm.localeCompare(b.capturadaEm))) (fotosPorItem[f.itemId] ||= []).push(f);
  const r = $("#relatorio");
  r.innerHTML = `
    <div class="rel-barra">
      <button class="btn" data-acao="ir" data-destino="#v/${id}">Voltar à vistoria</button>
      <span class="dica">Toque em Gerar PDF e escolha <b>Salvar como PDF</b> na janela de impressão.</span>
      <div class="direita">
        <label class="interruptor" style="min-height:44px;color:#fff"><input type="checkbox" id="rel-fotos" checked> Incluir fotos</label>
        <button class="btn btn-primario" data-acao="imprimir">Gerar PDF</button>
      </div>
    </div>
    <article class="folha" id="folha">${htmlRelatorio(v, itens, fotosPorItem, true)}</article>`;
  r.hidden = false;
  r.scrollTop = 0;
  $("#rel-fotos").addEventListener("change", (e) => {
    urlsRelatorio.forEach((u) => URL.revokeObjectURL(u));
    urlsRelatorio = [];
    $("#folha").innerHTML = htmlRelatorio(v, itens, fotosPorItem, e.target.checked);
  });
  document.title = `Vistoria ${v.protocolo.replace("/", "-")} - ${v.logradouro}`;
}

function htmlRelatorio(v, itens, fotosPorItem, comFotos) {
  const total = Math.max(itens.length, 1);
  const pct = (n) => `${nf((100 * n) / total, 1)}%`;
  const cEst = Object.fromEntries(ESTADOS.map((e) => [e[0], 0]));
  itens.forEach((i) => cEst[i.estado]++);
  const cAc = contarAcoes(itens);
  const prec = itens.map((i) => i.precisao).filter((p) => p != null);
  const semGps = itens.filter((i) => i.lat == null).length;
  const mat = (i) => POR_CODIGO[i.materialCodigo] || { cod: i.materialCodigo, mbst: "", desc: "Item", cat: "SERVICO", un: "UN" };

  // Quantitativo: agrupa por categoria, material e ação (somente intervenções)
  const agreg = new Map();
  for (const i of itens) {
    if (!["IMPLANTAR", "SUBSTITUIR", "REVITALIZAR", "REPOSICIONAR"].includes(i.acao)) continue;
    const chave = `${i.materialCodigo}|${i.acao}`;
    const a = agreg.get(chave) || { m: mat(i), acao: i.acao, q: 0 };
    a.q += Number(i.quantidade);
    agreg.set(chave, a);
  }
  const ordemCat = CATEGORIAS.map((c) => c[0]);
  const quant = [...agreg.values()].sort((a, b) =>
    ordemCat.indexOf(a.m.cat) - ordemCat.indexOf(b.m.cat) ||
    (ORDEM_CATALOGO[a.m.cod] ?? 9999) - (ORDEM_CATALOGO[b.m.cod] ?? 9999) || a.acao.localeCompare(b.acao));
  let linhasQuant = "", catAtual = null;
  for (const q of quant) {
    if (q.m.cat !== catAtual) {
      catAtual = q.m.cat;
      linhasQuant += `<tr class="grupo"><td colspan="6">${GRUPO_RELATORIO[catAtual] || esc(catAtual)}</td></tr>`;
    }
    linhasQuant += `<tr><td class="c">${volumeMbst(q.m) || "—"}</td><td class="c">${esc(q.m.mbst || q.m.cod)}</td><td>${esc(q.m.desc)}</td>
      <td class="c">${ROT_ACAO[q.acao]}</td><td class="c">${UNIDADE[q.m.un]}</td><td class="c">${qtd(Math.round(q.q * 100) / 100)}</td></tr>`;
  }
  const vols = [...new Set(quant.map((q) => volumeMbst(q.m)).filter(Boolean))].sort((a, b) => Object.keys(VOLUME_MBST).indexOf(a) - Object.keys(VOLUME_MBST).indexOf(b));

  let figuras = "", nFoto = 0;
  if (comFotos) {
    itens.forEach((i, k) => {
      for (const f of fotosPorItem[i.id] || []) {
        nFoto++;
        const u = URL.createObjectURL(f.blob);
        urlsRelatorio.push(u);
        const m = mat(i);
        figuras += `<figure><img src="${u}" alt="Foto ${nFoto}"><figcaption><b>Foto ${nFoto}</b>, item nº ${k + 1} (${esc(m.mbst || m.cod)}), ${ROT_ACAO[i.acao].toLowerCase()}.<br>
          ${dataHoraBr(f.capturadaEm)}${i.lat != null ? `, ${coord(i.lat)}; ${coord(i.lon)}` : ""}</figcaption></figure>`;
      }
    });
  }
  const nTotalFotos = itens.reduce((s, i) => s + (fotosPorItem[i.id]?.length || 0), 0);
  let sec = 6;

  return `
    <header class="cab-orgao">
      <div><b>${esc(config.orgaoEnte)}</b>${esc(config.orgaoUf)}<br>${esc(config.orgaoUnidade)}</div>
      <div class="dir"><b style="font-size:10pt">Nº ${esc(v.protocolo)}</b>Relatório Técnico de Vistoria</div>
    </header>
    <h1>RELATÓRIO TÉCNICO DE VISTORIA DE SINALIZAÇÃO VIÁRIA</h1>
    <p class="subtit">Levantamento de campo georreferenciado</p>

    <h2>1. IDENTIFICAÇÃO</h2>
    <table class="chave"><tbody>
      <tr><td>Logradouro</td><td>${esc(v.logradouro)}</td></tr>
      <tr><td>Bairro</td><td>${esc(v.bairro || "—")}</td></tr>
      <tr><td>Trecho de referência</td><td>${esc(v.trecho || "—")}</td></tr>
      <tr><td>Município</td><td>${esc(config.municipio)}</td></tr>
      <tr><td>Data da vistoria</td><td>${dataBr(v.data)}</td></tr>
      <tr><td>Responsável pela coleta</td><td>${esc(v.vistoriador?.nome || "—")}${v.vistoriador?.matricula ? `, matrícula ${esc(v.vistoriador.matricula)}` : ""}${v.vistoriador?.cargo ? ` (${esc(v.vistoriador.cargo)})` : ""}</td></tr>
      <tr><td>Situação</td><td>${v.status === "CONCLUIDA" ? "Concluída" : "Em andamento"}</td></tr>
      <tr><td>Itens levantados</td><td>${itens.length}</td></tr>
    </tbody></table>

    <h2>2. FUNDAMENTAÇÃO LEGAL E OBJETIVO</h2>
    <p>O presente levantamento é realizado com fundamento na Lei Federal nº 9.503/1997 (Código de Trânsito Brasileiro), em especial no art. 24, inciso III, que atribui aos órgãos e entidades executivos de trânsito dos Municípios a competência para implantar, manter e operar o sistema de sinalização; no art. 80, segundo o qual a sinalização deve observar os padrões estabelecidos pelo CONTRAN; e no art. 90, § 1º, que imputa ao órgão com circunscrição sobre a via a responsabilidade pela sua implantação e conservação. Os padrões técnicos de referência são os do Manual Brasileiro de Sinalização de Trânsito (MBST), consolidado pela Resolução CONTRAN nº 973/2022.</p>
    <p>O objetivo é registrar o inventário georreferenciado da sinalização existente, seu estado de conservação e as intervenções recomendadas, subsidiando o planejamento da contratação nos termos da Lei Federal nº 14.133/2021, notadamente a elaboração do Estudo Técnico Preliminar (art. 6º, inciso XX, e art. 18, § 1º), do Termo de Referência (art. 6º, inciso XXIII) e da estimativa do valor da contratação (art. 23).</p>

    <h2>3. SÍNTESE DO LEVANTAMENTO</h2>
    <div class="lado-a-lado">
      <table><thead><tr><th>Estado de conservação</th><th>Itens</th><th>%</th></tr></thead><tbody>
        ${ESTADOS.map(([c, r]) => `<tr><td>${r}</td><td class="c">${cEst[c]}</td><td class="c">${pct(cEst[c])}</td></tr>`).join("")}</tbody></table>
      <table><thead><tr><th>Ação recomendada</th><th>Itens</th><th>%</th></tr></thead><tbody>
        ${ACOES.map(([c, r]) => `<tr><td>${r}</td><td class="c">${cAc[c]}</td><td class="c">${pct(cAc[c])}</td></tr>`).join("")}</tbody></table>
    </div>
    <p class="nota">${prec.length ? `Precisão horizontal do GPS informada pelo aparelho: média de ${nf(prec.reduce((a, b) => a + b, 0) / prec.length, 1)} m (mínima ${nf(Math.min(...prec), 1)} m; máxima ${nf(Math.max(...prec), 1)} m). Sistema de referência: WGS 84 (EPSG:4326).` : "Nenhum item com coordenada GPS."}${semGps ? ` ${semGps} item(ns) registrado(s) sem coordenada; ver observações do inventário.` : ""}</p>

    <h2>4. CROQUI DE LOCALIZAÇÃO DOS ITENS</h2>
    <div class="croqui">${croquiSvg(itens, 700, 300)}</div>
    <p class="nota">Croqui esquemático, sem base cartográfica, gerado a partir das coordenadas coletadas. A numeração corresponde à coluna "Nº" do inventário. Cores: ${ACOES.filter((a) => cAc[a[0]]).map((a) => `<span class="pilula" style="background:${a[2]};color:#fff">${a[1]}</span>`).join(" ")}</p>

    <h2>5. INVENTÁRIO GEORREFERENCIADO</h2>
    <table><thead><tr><th>Nº</th><th>Código</th><th>Descrição / observação</th><th>Estado</th><th>Ação</th><th>Qtd.</th><th>Un.</th><th>Latitude<br>Longitude</th><th>Prec. (m)</th></tr></thead><tbody>
      ${itens.map((i, k) => {
        const m = mat(i);
        const extras = [i.lado ? `Lado: ${ROT_LADO[i.lado].toLowerCase()}` : "", i.observacao ? esc(i.observacao) : ""].filter(Boolean).join(". ");
        return `<tr><td class="c">${k + 1}</td><td class="c"><b>${esc(m.mbst || m.cod)}</b></td><td><b>${esc(m.desc)}</b>${extras ? `<br><span style="color:#555">${extras}</span>` : ""}</td>
          <td class="c">${ROT_ESTADO[i.estado]}</td><td class="c" style="color:${COR_ACAO[i.acao]};font-weight:700">${ROT_ACAO[i.acao]}</td>
          <td class="c">${qtd(i.quantidade)}</td><td class="c">${UNIDADE[m.un]}</td>
          <td class="c">${i.lat == null ? "sem GPS" : `${coord(i.lat)}<br>${coord(i.lon)}`}</td><td class="c">${i.precisao == null ? "—" : nf(i.precisao, 1)}</td></tr>`;
      }).join("")}
    </tbody></table>

    <h2>6. QUANTITATIVO ESTIMADO DE INTERVENÇÕES</h2>
    ${quant.length ? `<table><thead><tr><th>MBST</th><th>Código</th><th>Descrição</th><th>Ação</th><th>Un.</th><th>Quantidade</th></tr></thead><tbody>${linhasQuant}</tbody></table>
    <p class="nota">Quantitativo restrito às ações Implantar, Substituir, Revitalizar e Reposicionar. A estimativa de valor da contratação deverá ser obtida mediante pesquisa de preços (art. 23 da Lei nº 14.133/2021).
      ${vols.length ? `Coluna MBST: volume do Manual Brasileiro de Sinalização de Trânsito (Res. CONTRAN nº 973/2022): ${vols.map((x) => VOLUME_MBST[x]).join("; ")}.` : ""}</p>`
    : "<p>Não foram identificados itens que demandem intervenção.</p>"}

    ${figuras ? `<h2>${++sec}. REGISTRO FOTOGRÁFICO</h2><div class="fotos-rel">${figuras}</div>` : ""}

    <div class="bloco-final">
      <h2>${++sec}. OBSERVAÇÕES GERAIS</h2>
      <p>${esc(v.observacoes || "Sem observações adicionais.")}</p>
      <h2>${++sec}. ENCERRAMENTO</h2>
      <p>Nada mais havendo a registrar, encerra-se o presente relatório, composto de ${itens.length} item(ns) inventariado(s) e ${comFotos ? nTotalFotos : 0} registro(s) fotográfico(s), que segue assinado pelo responsável pela vistoria e pela chefia imediata.</p>
      <p>${esc(config.municipio)}, ${new Date().toLocaleDateString("pt-BR")}.</p>
      <div class="assin">
        <div><b>${esc(v.vistoriador?.nome || "Responsável pela vistoria")}</b><br>${esc(v.vistoriador?.cargo || "")}${v.vistoriador?.matricula ? `, matr. ${esc(v.vistoriador.matricula)}` : ""}</div>
        <div><b>Chefia do Departamento</b><br>${esc(config.orgaoUnidade)}</div>
      </div>
    </div>`;
}

// ============================================================ Exportação ==
const podeCompartilhar = (arq) => { try { return !!navigator.canShare?.({ files: [arq] }); } catch { return false; } };

async function entregar(nome, blob, enviar = false) {
  const arq = new File([blob], nome, { type: blob.type });
  if (enviar && podeCompartilhar(arq)) {
    try { await navigator.share({ files: [arq], title: nome }); return true; }
    catch (e) { if (e.name === "AbortError") return false; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  toast(`Arquivo ${nome} salvo em Downloads.`);
  return true;
}

function nomeBase(v) {
  const rua = v.logradouro.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return `vistoria_${v.protocolo.replace("/", "-")}_${rua}`;
}

function csvVistoria(v, itens) {
  const cel = (t) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const cab = ["Nº", "Código MBST", "Código interno", "Descrição", "Categoria", "Estado", "Ação", "Quantidade", "Unidade",
    "Lado da via", "Latitude", "Longitude", "Precisão GPS (m)", "Data e hora", "Observação", "Fotos"];
  const linhas = itens.map((i, k) => {
    const m = POR_CODIGO[i.materialCodigo] || {};
    return [k + 1, m.mbst, i.materialCodigo, m.desc, ROT_CAT[m.cat], ROT_ESTADO[i.estado], ROT_ACAO[i.acao],
      String(i.quantidade).replace(".", ","), UNIDADE[m.un], ROT_LADO[i.lado] || "",
      i.lat == null ? "" : String(i.lat).replace(".", ","), i.lon == null ? "" : String(i.lon).replace(".", ","),
      i.precisao == null ? "" : String(Math.round(i.precisao * 10) / 10).replace(".", ","),
      dataHoraBr(i.capturadoEm), i.observacao, i.fotos?.length || 0].map(cel).join(";");
  });
  const topoCsv = [`Vistoria nº ${v.protocolo}`, v.logradouro, v.bairro || "", dataBr(v.data)].map(cel).join(";");
  return new Blob(["﻿" + [topoCsv, "", cab.map(cel).join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" });
}

function geojsonVistoria(v, itens) {
  return new Blob([JSON.stringify({
    type: "FeatureCollection",
    features: itens.filter((i) => i.lat != null).map((i, k) => {
      const m = POR_CODIGO[i.materialCodigo] || {};
      return {
        type: "Feature", geometry: { type: "Point", coordinates: [i.lon, i.lat] },
        properties: {
          n: k + 1, vistoria: v.protocolo, logradouro: v.logradouro, codigo: m.mbst || i.materialCodigo,
          descricao: m.desc, estado: ROT_ESTADO[i.estado], acao: ROT_ACAO[i.acao], quantidade: i.quantidade,
          unidade: UNIDADE[m.un], lado: ROT_LADO[i.lado] || null, precisao_m: i.precisao, data: i.capturadoEm,
          observacao: i.observacao || null, cor: COR_ACAO[i.acao],
        },
      };
    }),
  }, null, 1)], { type: "application/geo+json" });
}

const blobParaBase64 = (blob) => new Promise((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1]);
  r.onerror = () => falha(r.error);
  r.readAsDataURL(blob);
});

/** Monta o backup em partes, para não segurar uma string gigante na memória. */
async function backup(vistoriaId = null) {
  const vistorias = vistoriaId ? [await BD.um("vistorias", vistoriaId)] : await BD.todos("vistorias");
  const ids = new Set(vistorias.map((v) => v.id));
  const itens = (await BD.todos("itens")).filter((i) => ids.has(i.vistoriaId));
  const fotos = (await BD.todos("fotos")).filter((f) => ids.has(f.vistoriaId));
  const partes = [JSON.stringify({ formato: "vistoria-campo", versao: 1, exportadoEm: agoraIso(), vistorias, itens }).slice(0, -1), ',"fotos":['];
  for (let k = 0; k < fotos.length; k++) {
    const { blob, ...resto } = fotos[k];
    partes.push((k ? "," : "") + JSON.stringify({ ...resto, tipo: blob.type, dados: await blobParaBase64(blob) }));
  }
  partes.push("]}");
  return new Blob(partes, { type: "application/json" });
}

async function restaurar(arquivo) {
  let dados;
  try { dados = JSON.parse(await arquivo.text()); } catch { return toast("Arquivo inválido: não é uma cópia de segurança deste aplicativo."); }
  if (dados.formato !== "vistoria-campo") return toast("Arquivo inválido: não é uma cópia de segurança deste aplicativo.");
  let novos = 0, atualizados = 0;
  const existentes = Object.fromEntries((await BD.todos("vistorias")).map((v) => [v.id, v]));
  const fotos = await Promise.all((dados.fotos || []).map(async (f) => {
    const blob = await (await fetch(`data:${f.tipo || "image/jpeg"};base64,${f.dados}`)).blob();
    const { dados: _d, tipo: _t, ...resto } = f;
    return { ...resto, blob };
  }));
  await BD._tx(["vistorias", "itens", "fotos"], "readwrite", (tx) => {
    for (const v of dados.vistorias || []) {
      const atual = existentes[v.id];
      if (atual && atual.atualizadoEm >= v.atualizadoEm) continue;
      atual ? atualizados++ : novos++;
      tx.objectStore("vistorias").put(v);
    }
    (dados.itens || []).forEach((i) => tx.objectStore("itens").put(i));
    fotos.forEach((f) => tx.objectStore("fotos").put(f));
  });
  // Mantém a numeração à frente das vistorias restauradas
  const maiorSeq = Math.max(config.seq || 0, ...(dados.vistorias || []).map((v) => parseInt(String(v.protocolo).split("/")[1], 10) || 0));
  config.seq = maiorSeq;
  await salvarConfig();
  toast(`Cópia restaurada: ${novos} vistoria(s) nova(s), ${atualizados} atualizada(s).`);
  render();
}

function painelExportar() {
  const p = $("#painel-exportar");
  if (!p.hidden) { p.hidden = true; return; }
  const exemplo = new File(["x"], "x.csv", { type: "text/csv" });
  const enviar = podeCompartilhar(exemplo);
  const linha = (tipo, titulo, desc) => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--borda)">
    <div style="flex:1 1 180px"><b>${titulo}</b><div class="meta" style="font-size:14px">${desc}</div></div>
    <button class="btn" data-acao="exp" data-tipo="${tipo}">Baixar</button>
    ${enviar ? `<button class="btn" data-acao="exp" data-tipo="${tipo}" data-enviar="1">Enviar</button>` : ""}</div>`;
  p.innerHTML = linha("csv", "Planilha (CSV)", "Abre no Excel e no Google Planilhas") +
    linha("geojson", "Mapa (GeoJSON)", "Abre no QGIS e no Google My Maps") +
    linha("backup", "Cópia desta vistoria (.json)", "Inclui as fotos; serve para levar a outro tablet");
  p.hidden = false;
}

async function exportar(tipo, enviar) {
  const v = estado.vistoria;
  const base = nomeBase(v);
  if (tipo === "csv") return entregar(`${base}.csv`, csvVistoria(v, estado.itens), enviar);
  if (tipo === "geojson") return entregar(`${base}.geojson`, geojsonVistoria(v, estado.itens), enviar);
  if (tipo === "backup") {
    toast("Preparando a cópia...");
    return entregar(`${base}_copia.json`, await backup(v.id), enviar);
  }
}

// ====================================================== Configurações ==
function telaConfig() {
  topo({ voltar: "#inicio", titulo: "Configurações" });
  const c = config;
  $("#tela").innerHTML = `
    <div class="tela">
      <form class="form" id="form-config" novalidate>
        <div class="cartao secao-form">
          <h3>Responsável pelas vistorias</h3>
          <div class="duas">
            <label class="campo">Nome <input class="campo-texto" id="c-nome" value="${esc(c.vistoriadorNome)}"></label>
            <label class="campo">Matrícula <input class="campo-texto" id="c-matricula" value="${esc(c.vistoriadorMatricula)}"></label>
          </div>
          <label class="campo">Cargo <input class="campo-texto" id="c-cargo" value="${esc(c.vistoriadorCargo)}"></label>
        </div>
        <div class="cartao secao-form">
          <h3>Órgão (cabeçalho do relatório)</h3>
          <label class="campo">Ente <input class="campo-texto" id="c-ente" value="${esc(c.orgaoEnte)}"></label>
          <div class="duas">
            <label class="campo">Estado <input class="campo-texto" id="c-uf" value="${esc(c.orgaoUf)}"></label>
            <label class="campo">Município <input class="campo-texto" id="c-municipio" value="${esc(c.municipio)}"></label>
          </div>
          <label class="campo">Unidade <input class="campo-texto" id="c-unidade" value="${esc(c.orgaoUnidade)}"></label>
        </div>
        <div class="cartao secao-form">
          <h3>Coleta</h3>
          <label class="campo">Precisão de GPS considerada boa <small>em metros; acima disso o indicador fica amarelo</small>
            <select id="c-meta">${[3, 5, 8, 10].map((m) => `<option value="${m}" ${c.metaGps == m ? "selected" : ""}>${m} m</option>`).join("")}</select></label>
          <label class="interruptor"><input type="checkbox" id="c-carimbo" ${c.carimbo ? "checked" : ""}> Gravar data, hora e coordenadas na foto (carimbo)</label>
          <label class="campo">Tema
            <select id="c-tema">
              <option value="sistema" ${c.tema === "sistema" ? "selected" : ""}>Igual ao tablet</option>
              <option value="claro" ${c.tema === "claro" ? "selected" : ""}>Claro (melhor sob sol)</option>
              <option value="escuro" ${c.tema === "escuro" ? "selected" : ""}>Escuro</option>
            </select></label>
        </div>
        <div class="cartao secao-form">
          <h3>Sobre os dados</h3>
          <p style="margin:0" class="meta">As vistorias e fotos ficam guardadas somente neste tablet, no navegador. Elas não são enviadas a nenhum servidor.
          Faça cópias de segurança regularmente (botão na tela inicial) e guarde-as no computador ou na rede da Prefeitura.
          Limpar os dados do navegador apaga as vistorias.</p>
        </div>
        <div><button class="btn btn-primario btn-grande" type="submit">Salvar configurações</button></div>
      </form>
    </div>`;
  $("#c-tema").addEventListener("change", (e) => { config.tema = e.target.value; aplicarTema(); });
  $("#form-config").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (s) => $(s).value.trim();
    Object.assign(config, {
      vistoriadorNome: val("#c-nome"), vistoriadorMatricula: val("#c-matricula"), vistoriadorCargo: val("#c-cargo"),
      orgaoEnte: val("#c-ente"), orgaoUf: val("#c-uf"), municipio: val("#c-municipio") || "Tietê/SP", orgaoUnidade: val("#c-unidade"),
      metaGps: Number($("#c-meta").value), carimbo: $("#c-carimbo").checked, tema: $("#c-tema").value,
    });
    await salvarConfig();
    toast("Configurações salvas.");
    ir("#inicio");
  });
}

// ========================================================= Demonstração ==
async function criarDemonstracao() {
  const agora = Date.now();
  config.seq = (config.seq || 0) + 1;
  const v = {
    id: novoId(), protocolo: `${new Date().getFullYear()}/${String(config.seq).padStart(4, "0")}`, status: "CONCLUIDA",
    logradouro: "Rua de demonstração", bairro: "Centro", trecho: "Dados fictícios para conhecer o aplicativo",
    data: hojeLocal(), observacoes: "Vistoria de demonstração criada automaticamente. Pode ser excluída em Editar dados.",
    vistoriador: { nome: config.vistoriadorNome || "Vistoriador de demonstração", matricula: config.vistoriadorMatricula || "0000", cargo: config.vistoriadorCargo },
    criadoEm: new Date(agora).toISOString(), atualizadoEm: new Date(agora).toISOString(),
  };
  const base = [-23.1017, -47.7164];
  const roteiro = [
    ["VRT-001", 1, "RUIM", "SUBSTITUIR", 0, 0, 4.2, "DIREITO", "Película desbotada"],
    ["SUP-001", 1, "RUIM", "SUBSTITUIR", 0.00002, 0.00003, 4.2, "DIREITO", "Corrosão na base"],
    ["HRZ-006", 2.4, "RUIM", "REVITALIZAR", 0.00008, 0.0001, 5.1, "CENTRO", ""],
    ["HRZ-007", 28.8, "REGULAR", "REVITALIZAR", 0.00012, 0.00016, 3.6, "AMBOS", "Desgaste nas faixas centrais"],
    ["VRT-009", 1, "INEXISTENTE", "IMPLANTAR", 0.0003, 0.0004, 6.4, "DIREITO", "Travessia sem placa de advertência"],
    ["VRT-003", 1, "BOM", "MANTER", 0.0007, 0.0009, 3.1, "ESQUERDO", ""],
    ["AUX-001", 24, "INEXISTENTE", "IMPLANTAR", 0.0011, 0.0014, 7.8, "CENTRO", "Curva sem delimitação"],
    ["VRT-005", 1, "REGULAR", "REPOSICIONAR", 0.0015, 0.0019, 4.4, "ESQUERDO", "Placa obstruída por árvore"],
  ];
  const itens = [], fotos = [];
  for (let k = 0; k < roteiro.length; k++) {
    const [cod, q, est, ac, dlat, dlon, prec, lado, obs] = roteiro[k];
    const t = new Date(agora - (roteiro.length - k) * 240000).toISOString();
    const item = {
      id: novoId(), vistoriaId: v.id, materialCodigo: cod, quantidade: q, estado: est, acao: ac, lado, observacao: obs,
      lat: base[0] + dlat, lon: base[1] + dlon, precisao: prec, alt: null, capturadoEm: t, atualizadoEm: t, fotos: [],
    };
    if (k === 0 || k === 3 || k === 4) {
      const blob = await fotoDemonstracao(POR_CODIGO[cod], k + 1, item, v);
      const f = { id: novoId(), itemId: item.id, vistoriaId: v.id, blob, capturadaEm: t };
      item.fotos.push(f.id);
      fotos.push(f);
    }
    itens.push(item);
  }
  await BD._tx(["vistorias", "itens", "fotos"], "readwrite", (tx) => {
    tx.objectStore("vistorias").put(v);
    itens.forEach((i) => tx.objectStore("itens").put(i));
    fotos.forEach((f) => tx.objectStore("fotos").put(f));
  });
  await salvarConfig();
  ir(`#v/${v.id}`);
}

async function fotoDemonstracao(m, n, item, v) {
  const tela = document.createElement("canvas");
  tela.width = 1200; tela.height = 900;
  const ctx = tela.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 900);
  g.addColorStop(0, "#9cc3e6"); g.addColorStop(0.55, "#dfe8ef"); g.addColorStop(0.56, "#6b7177"); g.addColorStop(1, "#4b5157");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = "#f2f2f2";
  for (let x = 120; x < 1200; x += 220) ctx.fillRect(x, 700, 120, 18);
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(glifo(m).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" '));
  await img.decode();
  ctx.fillStyle = "#9aa4ad";
  ctx.fillRect(590, 330, 20, 420);
  ctx.drawImage(img, 420, 120, 360, 360);
  const arq = await new Promise((ok) => tela.toBlob(ok, "image/jpeg", 0.85));
  return processarFoto(arq, [
    `${config.municipio} — Vistoria nº ${v.protocolo} — Item ${n} (${m.mbst || m.cod}) — DEMONSTRAÇÃO`,
    `${new Date(item.capturadoEm).toLocaleString("pt-BR")} — ${coord(item.lat)}, ${coord(item.lon)} (±${nf(item.precisao, 0)} m)`,
    v.logradouro,
  ]);
}

// ======================================================= Tela ligada ==
let wakeLock = null;
async function alternarWakeLock(botao) {
  if (wakeLock) { liberarWakeLock(); botao.setAttribute("aria-pressed", "false"); return; }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; $('[data-acao="wakelock"]')?.setAttribute("aria-pressed", "false"); });
    botao.setAttribute("aria-pressed", "true");
    toast("A tela vai permanecer ligada durante a vistoria.");
  } catch {
    toast("Este navegador não permite manter a tela ligada.");
  }
}
function liberarWakeLock() { try { wakeLock?.release(); } catch { /* */ } wakeLock = null; }

// ==================================================== Cliques e ações ==
const armados = new Map();
/** Exclusões pedem um segundo toque em até 4 segundos (sem janelas de confirmação). */
function confirmarComSegundoToque(botao, texto) {
  if (armados.has(botao)) { clearTimeout(armados.get(botao)); armados.delete(botao); return true; }
  const original = botao.textContent;
  botao.textContent = texto;
  botao.classList.add("armado");
  armados.set(botao, setTimeout(() => { botao.textContent = original; botao.classList.remove("armado"); armados.delete(botao); }, 4000));
  return false;
}

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-acao]");
  if (!el || el.tagName === "INPUT") return;
  const f = estado.ficha;
  switch (el.dataset.acao) {
    case "ir": e.preventDefault(); return ir(el.dataset.destino);
    case "cat":
      f.cat = el.dataset.cat; f.busca = "";
      $("#busca-sinal").value = "";
      $$(".aba").forEach((a) => a.setAttribute("aria-pressed", String(a === el)));
      return atualizarGrade();
    case "material": {
      f.material = el.dataset.cod;
      const m = POR_CODIGO[f.material];
      if (m.grupo !== f.cat && !f.busca) { f.cat = m.grupo; $$(".aba").forEach((a) => a.setAttribute("aria-pressed", String(a.dataset.cat === f.cat))); }
      atualizarSelecionado();
      atualizarGrade();
      $("#area-confirmar").innerHTML = "";
      return;
    }
    case "campo":
      f[el.dataset.campo] = el.dataset.valor;
      $$(`[data-acao="campo"][data-campo="${el.dataset.campo}"]`).forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
      return;
    case "qtd": {
      const atual = parseFloat(String(f.quantidade).replace(",", ".")) || 0;
      const m = POR_CODIGO[f.material];
      const minimo = !m || m.un === "UN" ? 1 : 0.1;
      f.quantidade = Math.max(minimo, Math.round((atual + Number(el.dataset.passo)) * 100) / 100);
      $("#qtd").value = String(f.quantidade).replace(".", ",");
      return;
    }
    case "remover-foto": {
      const [foto] = f.fotos.splice(Number(el.dataset.k), 1);
      if (!foto.nova) f.fotosRemovidas.push(foto.id);
      URL.revokeObjectURL(foto.url);
      return atualizarFotos();
    }
    case "gps-recomecar": GPS.recomecar(); return toast("Medindo a posição de novo.");
    case "gps-atualizar": f.posicaoFixa = null; $("#area-gps").innerHTML = blocoGps(); GPS.recomecar(); return;
    case "salvar-item": return salvarItem(false);
    case "salvar-sem-gps": return salvarItem(true);
    case "limpar-confirmar": $("#area-confirmar").innerHTML = ""; return;
    case "excluir-item": if (confirmarComSegundoToque(el, "Tocar de novo para excluir")) await excluirItem(); return;
    case "ficha-nova": liberarUrlsFicha(); estado.ficha = fichaNova(estado.vistoria.id); return ir(`#v/${estado.vistoria.id}${largo() ? "" : "/novo"}`, true);
    case "repetir": return repetirUltimo();
    case "status": {
      const v = estado.vistoria;
      v.status = v.status === "CONCLUIDA" ? "ABERTA" : "CONCLUIDA";
      v.atualizadoEm = agoraIso();
      await BD.gravar("vistorias", v);
      toast(v.status === "CONCLUIDA" ? "Vistoria concluída." : "Vistoria reaberta.");
      return render();
    }
    case "excluir-vistoria":
      if (confirmarComSegundoToque(el, "Tocar de novo para excluir tudo")) {
        await BD.apagarVistoria(el.dataset.id);
        estado.ficha = null;
        toast("Vistoria excluída.");
        ir("#inicio", true);
      }
      return;
    case "exportar": return painelExportar();
    case "exp": return exportar(el.dataset.tipo, !!el.dataset.enviar);
    case "mapa": return abrirMapa();
    case "imprimir": return window.print();
    case "backup-tudo": {
      toast("Preparando a cópia de segurança...");
      const blob = await backup();
      const nome = `vistorias_copia_${hojeLocal()}.json`;
      if (await entregar(nome, blob, false)) { config.ultimoBackup = agoraIso(); await salvarConfig(); if (!location.hash || location.hash === "#inicio") render(); }
      return;
    }
    case "demo": return criarDemonstracao();
    case "wakelock": return alternarWakeLock(el);
  }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.acao === "foto" && el.files?.[0]) { adicionarFoto(el.files[0]); el.value = ""; }
  if (el.dataset.acao === "restaurar" && el.files?.[0]) { restaurar(el.files[0]); el.value = ""; }
});

window.addEventListener("afterprint", () => {
  if (estado.vistoria) document.title = "Vistoria de Campo";
});
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && $('[data-acao="wakelock"][aria-pressed="true"]') && !wakeLock) {
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch { /* */ }
  }
});

// =============================================================== Início ==
(async function iniciar() {
  try {
    await BD.abrir();
  } catch (e) {
    $("#tela").innerHTML = `<div class="tela"><div class="aviso">O navegador bloqueou o armazenamento local, e o aplicativo não pode guardar vistorias.
      Saia da navegação anônima ou libere o armazenamento para este site. (${esc(e?.message || e)})</div></div>`;
    return;
  }
  await carregarConfig();
  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* funciona sem, apenas não fica offline */ });
  }
})();
