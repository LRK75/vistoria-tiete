# Vistoria de Campo — aplicativo para tablet

Aplicativo de vistoria de sinalização viária que funciona no navegador do tablet
(Android ou iPad), **inclusive sem internet**. Não precisa de servidor, banco de dados,
Docker nem instalação de programas no computador.

## O que ele faz

- Cadastra a vistoria (rua, bairro, trecho, responsável) com número sequencial (ex.: 2026/0001).
- Registra cada sinal no local:
  - **posição GPS** escolhida entre as leituras mais precisas, com a precisão em metros;
  - **catálogo visual** com 38 itens: placas MBST, pintura no solo, dispositivos, semáforos, suportes e serviços;
  - estado de conservação, ação recomendada, lado da via e quantidade (com cálculo de área em m²);
  - **fotos** tiradas pela câmera, com carimbo de data, hora e coordenadas.
- Mostra o croqui dos pontos sem internet e o mapa do OpenStreetMap quando há conexão.
- Gera o **Relatório Técnico em PDF** com as seções do relatório oficial:
  - identificação e fundamentação legal;
  - síntese, croqui e inventário;
  - quantitativo por volume do MBST;
  - fotos e assinaturas.
- Exporta **planilha (CSV)**, **mapa (GeoJSON)** e **cópia de segurança (.json)**.

Os dados ficam **somente no tablet**. Nenhuma informação é enviada a servidor algum.

---

## 1. Publicar o aplicativo (uma vez, pelo computador)

O GPS e a câmera do navegador só funcionam em endereços **https**. Por isso a pasta
precisa ser publicada num serviço de hospedagem. Os dois caminhos abaixo são gratuitos
e não exigem instalar nada.

> Publicar a pasta disponibiliza apenas o **código** do aplicativo. As vistorias e as
> fotos nunca saem do tablet.

### Opção A — Netlify Drop (mais rápida)

1. Descompacte o arquivo `vistoria-tablet.zip` no computador.
2. Acesse <https://app.netlify.com/drop>.
3. Arraste a **pasta** `vistoria-tablet` para a área indicada na página.
4. Em poucos segundos aparece um endereço do tipo `https://nome-aleatorio.netlify.app`.
5. Crie uma conta gratuita (ou entre) e **reivindique o site** para ele não ser removido.
   Nas configurações do site é possível trocar o nome, por exemplo para
   `vistoria-tiete.netlify.app`.

### Opção B — GitHub Pages

1. Crie uma conta em <https://github.com> e um repositório novo, por exemplo `vistoria`.
2. Na página do repositório, clique em **Add file > Upload files** e envie todos os arquivos
   da pasta `vistoria-tablet`, incluindo a pasta `icones`.
3. Em **Settings > Pages**, escolha *Deploy from a branch*, ramo `main`, pasta `/ (root)`, e salve.
4. Após 1 ou 2 minutos, o endereço será `https://SEU-USUARIO.github.io/vistoria/`.

> **Repositório público:** no plano gratuito, o GitHub Pages exige repositório público.
> Isso expõe somente o código, sem nenhum dado de vistoria.

Se a Prefeitura já tiver um site com https, a TI também pode copiar a pasta para lá.

---

## 2. Instalar no tablet

1. No tablet, abra o endereço publicado **com internet**:
   - Android: navegador Chrome;
   - iPad: navegador Safari.
2. Instale como aplicativo:
   - **Android (Chrome):** menu **⋮ > Instalar app** (ou *Adicionar à tela inicial*).
   - **iPad (Safari):** botão **Compartilhar > Adicionar à Tela de Início**.
3. Abra pelo ícone criado (losango amarelo com o marcador de localização).
4. Na primeira vistoria, **permita** o acesso à **localização** e à **câmera** quando o tablet perguntar.
5. Em **Configurações**, informe seu nome, matrícula e cargo.

A partir daí o aplicativo abre e funciona **sem internet**.

---

## 3. Uso em campo

| Passo | O que fazer |
|---|---|
| 1 | **Nova vistoria**: informe a rua e toque em *Começar vistoria* |
| 2 | Pare junto ao sinal e aguarde o indicador de GPS ficar **verde** (precisão de até 5 m) |
| 3 | Toque no ícone do sinal; use as abas ou a busca (ex.: `R-19`, `faixa`, `lombada`) |
| 4 | Marque estado, ação e lado da via; ajuste a quantidade |
| 5 | **Tirar foto**: enquadre o sinal, evitando pessoas e placas de veículos |
| 6 | **Salvar item**. Para o próximo sinal igual, use **Repetir último** |
| 7 | Ao terminar: **Concluir vistoria** e **Relatório (PDF) > Gerar PDF > Salvar como PDF** |

Dicas:
- O botão **Tela ligada** impede que a tela apague durante a vistoria.
- No tablet em pé, a lista ocupa a tela; toque em **Registrar sinal** para abrir a ficha.
- Sem sinal de GPS, é possível **salvar sem coordenada**. Nesse caso, descreva o local na
  observação; o relatório indica esses itens.
- Para corrigir um item, toque nele na lista. *Usar posição atual* substitui a coordenada gravada.
- No relatório, desmarque *Incluir fotos* para gerar a versão destinada a anexar a processo público.

---

## 4. Cópia de segurança (importante)

Os dados ficam no armazenamento do navegador do tablet. Eles **se perdem** se você:
- limpar os dados do navegador;
- desinstalar o navegador;
- perder o aparelho.

- Na tela inicial, toque em **Cópia de segurança** ao fim de cada dia de trabalho.
  O arquivo `.json` inclui as fotos.
- Guarde o arquivo no computador ou na rede da Prefeitura.
- Para levar as vistorias a outro tablet, use **Restaurar cópia** no outro aparelho.
- O aplicativo avisa na tela inicial quando a última cópia tiver mais de 7 dias.

---

## 5. Atualizar o aplicativo

Se algum arquivo for alterado:

1. Abra `sw.js` e troque `vistoria-campo-v1` por `vistoria-campo-v2` (e assim por diante).
2. Publique a pasta de novo:
   - Netlify: arraste a pasta outra vez em *Deploys*;
   - GitHub: envie os arquivos alterados.
3. Os tablets recebem a nova versão na próxima vez que abrirem o app com internet.

As vistorias já gravadas **não** são afetadas pela atualização.

---

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página do aplicativo |
| `app.js` | Funcionamento: telas, GPS, fotos, armazenamento, relatório e exportações |
| `catalogo.js` | Catálogo de sinais (códigos MBST, Res. CONTRAN nº 973/2022), estados e ações |
| `estilo.css` | Aparência, incluindo o layout de impressão do relatório |
| `sw.js` | Funcionamento sem internet (*service worker*) |
| `manifest.webmanifest`, `icones/` | Instalação na tela inicial |

Para acrescentar itens ao catálogo, inclua uma linha em `catalogo.js` seguindo o modelo
das existentes e publique novamente (seção 5).
