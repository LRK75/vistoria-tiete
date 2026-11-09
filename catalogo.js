/* Catálogo de sinalização — Manual Brasileiro de Sinalização de Trânsito (MBST),
 * consolidado pela Resolução CONTRAN nº 973/2022, e Anexo II do CTB (Lei nº 9.503/1997).
 *
 *  - Regulamentação: R-1 a R-40 (MBST Vol. I)
 *  - Advertência:    A-1a a A-48 (MBST Vol. II)
 *  - Indicação:      tipos de placa (MBST Vol. III); os códigos "IND-xx" são internos
 *  - Horizontal:     todas as marcas do MBST Vol. IV
 *
 * cod   identificador interno (os códigos antigos VRT/HRZ foram mantidos para não
 *       alterar vistorias já gravadas)
 * mbst  código oficial exibido no aplicativo e no relatório
 * grupo aba do catálogo: R, A, I, H, D, S, P, X
 * forma/pic/rot/barra/xis/esp  desenho do ícone (ver glifo() em app.js)
 */
"use strict";

// Categorias usadas no relatório e na planilha
const CATEGORIAS = [
  ["VERTICAL", "Sinalização vertical"],
  ["HORIZONTAL", "Sinalização horizontal"],
  ["DISPOSITIVO_AUXILIAR", "Dispositivos auxiliares"],
  ["SEMAFORICA", "Sinalização semafórica"],
  ["SUPORTE", "Suportes"],
  ["SERVICO", "Serviços"],
];

// Abas do catálogo na ficha de registro
const GRUPOS = [
  ["R", "Regulamentação"],
  ["A", "Advertência"],
  ["I", "Indicação"],
  ["H", "Pintura no solo"],
  ["D", "Dispositivos"],
  ["S", "Semáforos"],
  ["P", "Suportes"],
  ["X", "Serviços"],
];

// ------------------------------------------------------------ montagem ------
const _R = (cod, mbst, desc, ic = {}) => ({ cod, mbst, desc, cat: "VERTICAL", grupo: "R", un: "UN", forma: "reg", ...ic });
const _A = (cod, mbst, desc, ic = {}) => ({ cod, mbst, desc, cat: "VERTICAL", grupo: "A", un: "UN", forma: "adv", ...ic });
const _I = (cod, mbst, desc, ic = {}) => ({ cod, mbst, desc, cat: "VERTICAL", grupo: "I", un: "UN", forma: "ind", ...ic });
const _H = (cod, mbst, desc, sub, ic = {}) => ({ cod, mbst, desc, cat: "HORIZONTAL", grupo: "H", un: "M2", forma: "linha", sub, ...ic });

const CATALOGO = [
  // ===================================================== REGULAMENTAÇÃO ====
  _R("VRT-001", "R-1", "Parada obrigatória", { forma: "pare" }),
  _R("VRT-002", "R-2", "Dê a preferência", { forma: "preferencia" }),
  _R("VRT-007", "R-3", "Sentido proibido", { forma: "proibido" }),
  _R("VRT-008", "R-4a", "Proibido virar à esquerda", { pic: "virar", barra: true }),
  _R("R-4b", "R-4b", "Proibido virar à direita", { pic: "virar", esp: true, barra: true }),
  _R("R-5a", "R-5a", "Proibido retornar à esquerda", { pic: "retorno", barra: true }),
  _R("R-5b", "R-5b", "Proibido retornar à direita", { pic: "retorno", esp: true, barra: true }),
  _R("VRT-003", "R-6a", "Proibido estacionar", { rot: "E", barra: true }),
  _R("R-6b", "R-6b", "Estacionamento regulamentado", { rot: "E" }),
  _R("VRT-004", "R-6c", "Proibido parar e estacionar", { rot: "E", xis: true }),
  _R("R-7", "R-7", "Proibido ultrapassar", { pic: "ultrapassar" }),
  _R("R-8a", "R-8a", "Proibido mudar de faixa ou pista de trânsito da esquerda para a direita", { pic: "mudarFaixa", barra: true }),
  _R("R-8b", "R-8b", "Proibido mudar de faixa ou pista de trânsito da direita para a esquerda", { pic: "mudarFaixa", esp: true, barra: true }),
  _R("R-9", "R-9", "Proibido trânsito de caminhões", { pic: "caminhao", barra: true }),
  _R("R-10", "R-10", "Proibido trânsito de veículos automotores", { pic: "carro", barra: true }),
  _R("R-11", "R-11", "Proibido trânsito de veículos de tração animal", { pic: "carroca", barra: true }),
  _R("R-12", "R-12", "Proibido trânsito de bicicletas", { pic: "bicicleta", barra: true }),
  _R("R-13", "R-13", "Proibido trânsito de tratores e máquinas de obras", { pic: "trator", barra: true }),
  _R("R-14", "R-14", "Peso bruto total máximo permitido", { rot: "10t" }),
  _R("R-15", "R-15", "Altura máxima permitida", { rot: "3,5m", pic: "setasV" }),
  _R("R-16", "R-16", "Largura máxima permitida", { rot: "2,5m", pic: "setasH" }),
  _R("R-17", "R-17", "Peso máximo permitido por eixo", { rot: "4t", pic: "eixo" }),
  _R("R-18", "R-18", "Comprimento máximo permitido", { rot: "15m", pic: "setasH" }),
  _R("VRT-005", "R-19", "Velocidade máxima permitida", { rot: "40" }),
  _R("R-20", "R-20", "Proibido acionar buzina ou sinal sonoro", { pic: "buzina", barra: true }),
  _R("R-21", "R-21", "Alfândega", { rot: "ALFÂN-DEGA" }),
  _R("R-22", "R-22", "Uso obrigatório de corrente", { pic: "corrente" }),
  _R("R-23", "R-23", "Conserve-se à direita", { pic: "conservar" }),
  _R("VRT-006", "R-24a", "Sentido de circulação da via ou pista", { pic: "setaDir" }),
  _R("R-24b", "R-24b", "Passagem obrigatória", { pic: "setaDiag" }),
  _R("R-25a", "R-25a", "Vire à esquerda", { pic: "virar" }),
  _R("R-25b", "R-25b", "Vire à direita", { pic: "virar", esp: true }),
  _R("R-25c", "R-25c", "Siga em frente ou à esquerda", { pic: "frenteOuVirar" }),
  _R("R-25d", "R-25d", "Siga em frente ou à direita", { pic: "frenteOuVirar", esp: true }),
  _R("R-26", "R-26", "Siga em frente", { pic: "setaCima" }),
  _R("R-27", "R-27", "Ônibus, caminhões e veículos de grande porte, mantenham-se à direita", { pic: "caminhaoDireita" }),
  _R("R-28", "R-28", "Duplo sentido de circulação", { pic: "duploSentido" }),
  _R("R-29", "R-29", "Proibido trânsito de pedestres", { pic: "pedestre", barra: true }),
  _R("R-30", "R-30", "Pedestre, ande pela esquerda", { pic: "pedestreLado" }),
  _R("R-31", "R-31", "Pedestre, ande pela direita", { pic: "pedestreLado", esp: true }),
  _R("R-32", "R-32", "Circulação exclusiva de ônibus", { pic: "onibus" }),
  _R("R-33", "R-33", "Sentido de circulação na rotatória", { pic: "rotatoria" }),
  _R("R-34", "R-34", "Circulação exclusiva de bicicletas", { pic: "bicicleta" }),
  _R("R-35a", "R-35a", "Ciclista, transite à esquerda", { pic: "bicicletaLado" }),
  _R("R-35b", "R-35b", "Ciclista, transite à direita", { pic: "bicicletaLado", esp: true }),
  _R("R-36a", "R-36a", "Ciclistas à esquerda, pedestres à direita", { pic: "cicloPedestre" }),
  _R("R-36b", "R-36b", "Pedestres à esquerda, ciclistas à direita", { pic: "cicloPedestre", esp: true }),
  _R("R-37", "R-37", "Proibido trânsito de motocicletas, motonetas e ciclomotores", { pic: "moto", barra: true }),
  _R("R-38", "R-38", "Proibido trânsito de ônibus", { pic: "onibus", barra: true }),
  _R("R-39", "R-39", "Circulação exclusiva de caminhão", { pic: "caminhao" }),
  _R("R-40", "R-40", "Trânsito proibido a carros de mão", { pic: "carroMao", barra: true }),

  // ======================================================== ADVERTÊNCIA ====
  _A("A-1a", "A-1a", "Curva acentuada à esquerda", { pic: "curvaAcentuada" }),
  _A("A-1b", "A-1b", "Curva acentuada à direita", { pic: "curvaAcentuada", esp: true }),
  _A("A-2a", "A-2a", "Curva à esquerda", { pic: "curva" }),
  _A("A-2b", "A-2b", "Curva à direita", { pic: "curva", esp: true }),
  _A("A-3a", "A-3a", "Pista sinuosa à esquerda", { pic: "sinuosa" }),
  _A("A-3b", "A-3b", "Pista sinuosa à direita", { pic: "sinuosa", esp: true }),
  _A("A-4a", "A-4a", "Curva acentuada em \"S\" à esquerda", { pic: "sAcentuado" }),
  _A("A-4b", "A-4b", "Curva acentuada em \"S\" à direita", { pic: "sAcentuado", esp: true }),
  _A("A-5a", "A-5a", "Curva em \"S\" à esquerda", { pic: "curvaS" }),
  _A("A-5b", "A-5b", "Curva em \"S\" à direita", { pic: "curvaS", esp: true }),
  _A("A-6", "A-6", "Cruzamento de vias", { pic: "cruzamento" }),
  _A("A-7a", "A-7a", "Via lateral à esquerda", { pic: "viaLateral" }),
  _A("A-7b", "A-7b", "Via lateral à direita", { pic: "viaLateral", esp: true }),
  _A("A-8", "A-8", "Interseção em \"T\"", { pic: "interT" }),
  _A("A-9", "A-9", "Bifurcação em \"Y\"", { pic: "bifurcacao" }),
  _A("A-10a", "A-10a", "Entroncamento oblíquo à esquerda", { pic: "obliquo" }),
  _A("A-10b", "A-10b", "Entroncamento oblíquo à direita", { pic: "obliquo", esp: true }),
  _A("A-11a", "A-11a", "Junções sucessivas contrárias, primeira à esquerda", { pic: "juncoes" }),
  _A("A-11b", "A-11b", "Junções sucessivas contrárias, primeira à direita", { pic: "juncoes", esp: true }),
  _A("A-12", "A-12", "Interseção em círculo", { pic: "circulo" }),
  _A("A-13a", "A-13a", "Confluência à esquerda", { pic: "confluencia" }),
  _A("A-13b", "A-13b", "Confluência à direita", { pic: "confluencia", esp: true }),
  _A("VRT-012", "A-14", "Semáforo à frente", { pic: "semaforo" }),
  _A("A-15", "A-15", "Parada obrigatória à frente", { pic: "pareFrente" }),
  _A("A-16", "A-16", "Bonde", { pic: "bonde" }),
  _A("A-17", "A-17", "Pista irregular", { pic: "irregular" }),
  _A("VRT-011", "A-18", "Saliência ou lombada", { pic: "lombada" }),
  _A("A-19", "A-19", "Depressão", { pic: "depressao" }),
  _A("A-20a", "A-20a", "Declive acentuado", { pic: "declive" }),
  _A("A-20b", "A-20b", "Aclive acentuado", { pic: "declive", esp: true }),
  _A("A-21a", "A-21a", "Estreitamento de pista ao centro", { pic: "estreitaCentro" }),
  _A("A-21b", "A-21b", "Estreitamento de pista à esquerda", { pic: "estreitaLado" }),
  _A("A-21c", "A-21c", "Estreitamento de pista à direita", { pic: "estreitaLado", esp: true }),
  _A("A-21d", "A-21d", "Alargamento de pista à esquerda", { pic: "alargaLado" }),
  _A("A-21e", "A-21e", "Alargamento de pista à direita", { pic: "alargaLado", esp: true }),
  _A("A-22", "A-22", "Ponte estreita", { pic: "ponteEstreita" }),
  _A("A-23", "A-23", "Ponte móvel", { pic: "ponteMovel" }),
  _A("A-24", "A-24", "Obras", { pic: "obras" }),
  _A("A-25", "A-25", "Mão dupla adiante", { pic: "duploSentido" }),
  _A("A-26a", "A-26a", "Sentido único", { pic: "setaCima" }),
  _A("A-26b", "A-26b", "Sentido duplo", { pic: "duploHorizontal" }),
  _A("A-27", "A-27", "Área com desmoronamento", { pic: "desmoronamento" }),
  _A("A-28", "A-28", "Pista escorregadia", { pic: "escorregadia" }),
  _A("A-29", "A-29", "Projeção de cascalho", { pic: "cascalho" }),
  _A("A-30a", "A-30a", "Trânsito de ciclistas", { pic: "bicicleta" }),
  _A("A-30b", "A-30b", "Passagem sinalizada de ciclistas", { pic: "bicicletaFaixa" }),
  _A("A-30c", "A-30c", "Trânsito compartilhado por ciclistas e pedestres", { pic: "cicloPedestre" }),
  _A("A-31", "A-31", "Trânsito de tratores ou maquinaria agrícola", { pic: "trator" }),
  _A("A-32a", "A-32a", "Trânsito de pedestres", { pic: "pedestre" }),
  _A("VRT-009", "A-32b", "Passagem sinalizada de pedestres", { pic: "pedestreFaixa" }),
  _A("A-33a", "A-33a", "Área escolar", { pic: "escolar" }),
  _A("VRT-010", "A-33b", "Passagem sinalizada de escolares", { pic: "escolarFaixa" }),
  _A("A-34", "A-34", "Crianças", { pic: "criancas" }),
  _A("A-35", "A-35", "Animais", { pic: "animal" }),
  _A("A-36", "A-36", "Animais selvagens", { pic: "cervo" }),
  _A("A-37", "A-37", "Altura limitada", { rot: "3,5m", pic: "setasV" }),
  _A("A-38", "A-38", "Largura limitada", { rot: "2,5m", pic: "setasH" }),
  _A("A-39", "A-39", "Passagem de nível sem barreira", { pic: "trem" }),
  _A("A-40", "A-40", "Passagem de nível com barreira", { pic: "barreira" }),
  _A("A-41", "A-41", "Cruz de Santo André", { forma: "cruz" }),
  _A("A-42a", "A-42a", "Início de pista dupla", { pic: "inicioDupla" }),
  _A("A-42b", "A-42b", "Fim de pista dupla", { pic: "fimDupla" }),
  _A("A-42c", "A-42c", "Pista dividida", { pic: "pistaDividida" }),
  _A("A-43", "A-43", "Aeroporto", { pic: "aviao" }),
  _A("A-44", "A-44", "Vento lateral", { pic: "vento" }),
  _A("A-45", "A-45", "Rua sem saída", { pic: "semSaida" }),
  _A("A-46", "A-46", "Peso bruto total limitado", { rot: "10t" }),
  _A("A-47", "A-47", "Peso limitado por eixo", { rot: "4t", pic: "eixo" }),
  _A("A-48", "A-48", "Comprimento limitado", { rot: "15m", pic: "setasH" }),

  // ========================================================== INDICAÇÃO ====
  _I("VRT-013", "IND-01", "Identificação de logradouro", { rot: "RUA" }),
  _I("VRT-014", "IND-02", "Orientação de destino (por m²)", { rot: "CENTRO", verde: true, un: "M2" }),
  _I("IND-03", "IND-03", "Identificação de município ou de limite de município", { rot: "TIETÊ", cor: "#1565c0" }),
  _I("IND-04", "IND-04", "Identificação de rodovia", { forma: "escudo" }),
  _I("IND-05", "IND-05", "Identificação de ponte, viaduto, túnel ou passarela", { rot: "PONTE" }),
  _I("IND-06", "IND-06", "Placa de distâncias", { rot: "12 km", verde: true }),
  _I("IND-07", "IND-07", "Marco quilométrico", { forma: "marco" }),
  _I("IND-08", "IND-08", "Educativa", { rot: "USE O CINTO", cor: "#ffffff", texto: "#111" }),
  _I("IND-09", "IND-09", "Serviços auxiliares (pictograma)", { forma: "servicoAux" }),
  _I("IND-10", "IND-10", "Atrativo turístico", { rot: "TURISMO", cor: "#6d4c41" }),
  _I("IND-11", "IND-11", "Posto de fiscalização", { rot: "FISCAL", cor: "#1565c0" }),
  _I("IND-12", "IND-12", "Informação complementar (placa adicional)", { forma: "adicional" }),

  // ================================================= PINTURA NO SOLO ====
  // Marcas longitudinais
  _H("HRZ-001", "LFO-1", "Linha simples contínua (fluxos opostos)", "Marcas longitudinais", { cor: "am", tipo: "continua" }),
  _H("HRZ-002", "LFO-2", "Linha simples seccionada (fluxos opostos)", "Marcas longitudinais", { cor: "am", tipo: "tracejada" }),
  _H("HRZ-003", "LFO-3", "Linha dupla contínua (fluxos opostos)", "Marcas longitudinais", { cor: "am", tipo: "dupla" }),
  _H("LFO-4", "LFO-4", "Linha contínua/seccionada (fluxos opostos)", "Marcas longitudinais", { cor: "am", tipo: "contSecc" }),
  _H("HRZ-004", "LMS-1", "Linha simples contínua (mesmo sentido)", "Marcas longitudinais", { cor: "br", tipo: "continua" }),
  _H("LMS-2", "LMS-2", "Linha simples seccionada (mesmo sentido)", "Marcas longitudinais", { cor: "br", tipo: "tracejada" }),
  _H("HRZ-005", "LBO", "Linha de bordo", "Marcas longitudinais", { cor: "br", tipo: "bordo" }),
  _H("LCO", "LCO", "Linha de continuidade", "Marcas longitudinais", { cor: "br", tipo: "continuidade" }),
  _H("MFE", "MFE", "Marcação de faixa exclusiva", "Marcas longitudinais", { cor: "br", tipo: "exclusiva" }),
  _H("MFP", "MFP", "Marcação de faixa preferencial", "Marcas longitudinais", { cor: "br", tipo: "preferencial" }),
  _H("MFR", "MFR", "Marcação de faixa reversível no contrafluxo", "Marcas longitudinais", { cor: "am", tipo: "duplaSecc" }),
  _H("MCI", "MCI", "Marcação de ciclofaixa ao longo da via", "Marcas longitudinais", { cor: "br", tipo: "ciclofaixa" }),
  // Marcas transversais
  _H("HRZ-006", "LRE", "Linha de retenção", "Marcas transversais", { cor: "br", tipo: "retencao" }),
  _H("LRV", "LRV", "Linhas de estímulo à redução de velocidade", "Marcas transversais", { cor: "br", tipo: "reducao" }),
  _H("LDP", "LDP", "Linha de \"Dê a preferência\"", "Marcas transversais", { cor: "br", tipo: "dePreferencia" }),
  _H("HRZ-007", "FTP-1", "Faixa de travessia de pedestres (zebrada)", "Marcas transversais", { cor: "br", tipo: "zebra" }),
  _H("FTP-2", "FTP-2", "Faixa de travessia de pedestres (paralela)", "Marcas transversais", { cor: "br", tipo: "paralela" }),
  _H("MCC", "MCC", "Marcação de cruzamento rodocicloviário", "Marcas transversais", { cor: "br", tipo: "rodociclo" }),
  _H("MAC", "MAC", "Marcação de área de conflito", "Marcas transversais", { cor: "am", tipo: "conflito" }),
  _H("MAE", "MAE", "Marcação de área de cruzamento com faixa exclusiva", "Marcas transversais", { cor: "am", tipo: "cruzExclusiva" }),
  _H("MCF", "MCF", "Marcação de cruzamento rodoferroviário", "Marcas transversais", { cor: "br", tipo: "ferroviario" }),
  // Marcas de canalização
  _H("LCA", "LCA", "Linha de canalização", "Marcas de canalização", { cor: "br", tipo: "canalizacao" }),
  _H("HRZ-010", "ZPA", "Zebrado de preenchimento da área de pavimento não utilizável", "Marcas de canalização", { cor: "am", tipo: "zebrado" }),
  // Estacionamento e parada
  _H("LPP", "LPP", "Linha de indicação de proibição de estacionamento e/ou parada", "Estacionamento e parada", { cor: "am", tipo: "proibicao" }),
  _H("MVE", "MVE", "Marca delimitadora de parada de veículos específicos", "Estacionamento e parada", { cor: "am", tipo: "parada" }),
  _H("HRZ-009", "MER", "Marca delimitadora de estacionamento regulamentado", "Estacionamento e parada", { cor: "br", tipo: "vaga" }),
  // Inscrições no pavimento
  _H("HRZ-008", "PEM", "Seta indicativa de posicionamento na pista para execução de movimentos", "Inscrições no pavimento", { cor: "br", tipo: "seta" }),
  _H("MOF", "MOF", "Seta indicativa de mudança obrigatória de faixa", "Inscrições no pavimento", { cor: "br", tipo: "setaMudanca" }),
  _H("IMC", "IMC", "Seta indicativa de movimento em curva", "Inscrições no pavimento", { cor: "br", tipo: "setaCurva" }),
  _H("SIP", "SIP", "Símbolo \"Dê a preferência\"", "Inscrições no pavimento", { cor: "br", tipo: "simbPreferencia" }),
  _H("SIF", "SIF", "Símbolo \"Cruz de Santo André\" (cruzamento rodoferroviário)", "Inscrições no pavimento", { cor: "br", tipo: "simbCruz" }),
  _H("SIC", "SIC", "Símbolo \"Bicicleta\" (uso de ciclistas)", "Inscrições no pavimento", { cor: "br", tipo: "simbBike" }),
  _H("SIR", "SIR", "Símbolo de rota de bicicleta (ciclorrota)", "Inscrições no pavimento", { cor: "br", tipo: "simbCiclorrota" }),
  _H("SIB", "SIB", "Símbolo de bolsão para bicicletas e motocicletas", "Inscrições no pavimento", { cor: "br", tipo: "simbBolsao" }),
  _H("SAS", "SAS", "Símbolo \"Serviços de saúde\"", "Inscrições no pavimento", { cor: "br", tipo: "simbSaude" }),
  _H("DEF", "DEF", "Símbolo de estacionamento para pessoa com deficiência", "Inscrições no pavimento", { cor: "br", tipo: "simbDef" }),
  _H("IDS", "IDS", "Símbolo de estacionamento para pessoa idosa (60 anos ou mais)", "Inscrições no pavimento", { cor: "br", tipo: "simbIdoso" }),
  _H("SIRVE", "SIRVE", "Símbolo de estacionamento de veículo elétrico em recarga", "Inscrições no pavimento", { cor: "br", tipo: "simbEletrico" }),
  _H("LEG", "Legenda", "Legenda (PARE, ESCOLA, ÔNIBUS etc.)", "Inscrições no pavimento", { cor: "br", tipo: "legenda" }),

  // ===================================================== DISPOSITIVOS ====
  { cod: "AUX-001", mbst: "TAC", desc: "Tacha refletiva bidirecional", cat: "DISPOSITIVO_AUXILIAR", grupo: "D", un: "UN", forma: "tacha" },
  { cod: "AUX-002", mbst: "TCH", desc: "Tachão refletivo bidirecional", cat: "DISPOSITIVO_AUXILIAR", grupo: "D", un: "UN", forma: "tachao" },
  { cod: "AUX-003", mbst: "BAL", desc: "Balizador / delineador flexível", cat: "DISPOSITIVO_AUXILIAR", grupo: "D", un: "UN", forma: "baliza" },
  { cod: "AUX-004", mbst: "OND", desc: "Ondulação transversal (lombada) tipo A", cat: "DISPOSITIVO_AUXILIAR", grupo: "D", un: "UN", forma: "lombada" },
  { cod: "AUX-005", mbst: "PRT", desc: "Gradil / defensa de proteção de pedestres", cat: "DISPOSITIVO_AUXILIAR", grupo: "D", un: "M", forma: "gradil" },
  // ======================================================== SEMÁFOROS ====
  { cod: "SEM-001", mbst: "", desc: "Grupo focal veicular 3 × 200 mm em LED", cat: "SEMAFORICA", grupo: "S", un: "UN", forma: "semaforo" },
  { cod: "SEM-002", mbst: "", desc: "Grupo focal de pedestre com contador", cat: "SEMAFORICA", grupo: "S", un: "UN", forma: "semaforo-ped" },
  // ========================================================= SUPORTES ====
  { cod: "SUP-001", mbst: "", desc: "Poste de aço galvanizado Ø 2\" × 3,00 m", cat: "SUPORTE", grupo: "P", un: "UN", forma: "poste" },
  { cod: "SUP-002", mbst: "", desc: "Braçadeira para fixação de placa", cat: "SUPORTE", grupo: "P", un: "UN", forma: "bracadeira" },
  { cod: "SUP-003", mbst: "", desc: "Semipórtico / braço projetado", cat: "SUPORTE", grupo: "P", un: "UN", forma: "portico" },
  // ========================================================= SERVIÇOS ====
  { cod: "SRV-001", mbst: "", desc: "Remoção de placa com recolhimento do suporte", cat: "SERVICO", grupo: "X", un: "UN", forma: "servico", rot: "−" },
  { cod: "SRV-002", mbst: "", desc: "Reposicionamento / realinhamento de placa", cat: "SERVICO", grupo: "X", un: "UN", forma: "servico", rot: "↔" },
  { cod: "SRV-003", mbst: "", desc: "Remoção de pintura por fresagem/jateamento", cat: "SERVICO", grupo: "X", un: "M2", forma: "servico", rot: "▭" },
  { cod: "OUT-001", mbst: "", desc: "Outro item (descrever na observação)", cat: "SERVICO", grupo: "X", un: "UN", forma: "outro", rot: "?" },
];

const POR_CODIGO = Object.fromEntries(CATALOGO.map((m) => [m.cod, m]));
const ORDEM_CATALOGO = Object.fromEntries(CATALOGO.map((m, k) => [m.cod, k]));

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
  if (m.cat === "VERTICAL") return { R: "I", A: "II" }[m.grupo] || "III";
  return { HORIZONTAL: "IV", SEMAFORICA: "V", DISPOSITIVO_AUXILIAR: "VI" }[m.cat] || null;
}
