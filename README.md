# XChat (xbot-chat-v1)

Widget de chat para colar em qualquer site. Conecta à API do XBot.

Repositório: [github.com/BTBW-Co/xbot-chat-v1](https://github.com/BTBW-Co/xbot-chat-v1)

---

## Antes de integrar

1. No painel XBot: **Configurações → API Keys** → crie uma chave com escopo **`xchat:widget`** (guarde `client_id` e `client_secret` — o secret só aparece uma vez).
2. **Configurações → Conexões** → crie um canal **XChat** e associe uma **pipeline** (nome do bot, boas-vindas e tom vêm da pipeline).
3. Anote o **UUID do canal** (`channelId`).

---

## CDN e embed hospedado

### Embed hospedado (recomendado — escala)

O widget roda em **iframe** em `xbotone.com`. O site do cliente só carrega um loader leve; `channelId` é sanitizado (UUID puro); com `data-lazy="1"` **não há chamada à API** até o visitante clicar.

```html
<script
  src="https://xbotone.com/xchat/embed.js"
  data-channel-id="UUID-DO-CANAL-XCHAT"
  data-client-id="SEU_CLIENT_ID"
  data-token="SEU_CLIENT_SECRET"
  data-api-base="https://api.xbotone.com"
  data-lazy="1"
  async
></script>
```

| Item | Valor |
|------|--------|
| Loader | `https://xbotone.com/xchat/embed.js` |
| Frame | `https://xbotone.com/xchat/embed.html` |
| Widget JS | `https://xbotone.com/xchat/xbot.min.js` (interno ao frame) |

Identidade do visitante no embed hospedado (página pai → iframe):

```js
// O embed.js define estes helpers no parent e encaminha via postMessage.
window.setXBotUser({
  externalUserId: "USR-123",
  name: "Maria",
  custom_fields: { company_name: "Acme" }
});
window.setXBotContext({ pageUrl: location.href, notes: "Checkout" });
// ou: window.XBotEmbed.setUser(...); window.XBotEmbed.setContext(...);
```

Também é possível passar `user` / `context` em `XBotEmbed.mount({ ..., user, context })`.
A próxima mensagem do chat já sai identificada.

API (`GET /v1/xchat/widget-config`): `embed_loader_url`, `embed_page_url`, `script_cdn_url`.

Controle via host: `XBotEmbed.open()` / `XBotEmbed.close()` / `XBotEmbed.mount({...})`.

**`channelId` deve ser só o UUID** — não concatene secret nem sufixos (`…db51e-o_g` quebra auth e gera carga inútil).

### Script direto (first-party)

[https://xbotone.com/xchat/xbot.min.js](https://xbotone.com/xchat/xbot.min.js) — atualiza no deploy do site (`public/xchat/`). Cache curto (`max-age=5`).

### Congelar em uma versão (opcional, jsDelivr)

```
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@1.0.25/versions/1.0.25/xbot.min.js
```

### O que evitar

- `cdn.jsdelivr.net/...@main/versions/latest/...` — cache inconsistente.
- Carregar o widget antigo (≤ 1.0.20) no layout global (poll no pageload).
- Repositório legado `btbw/xbot-chat`.

---

## Integração em qualquer site (HTML)

### 1) Embed hospedado (recomendado)

Ver bloco acima (`embed.js` + `data-lazy="1"`).

### 2) Lazy-load no domínio do cliente

Não baixa o JS nem chama a API até o visitante clicar:

```html
<script>
(function () {
  var SCRIPT_URL = "https://xbotone.com/xchat/xbot.min.js";
  var CFG = {
    channelId: "UUID-DO-CANAL-XCHAT",
    clientId: "SEU_CLIENT_ID",
    token: "SEU_CLIENT_SECRET",
    apiBaseUrl: "https://api.xbotone.com"
  };
  var loading = false, inited = false;
  function openWhenReady() {
    if (typeof window.openXBot === "function") { window.openXBot(); return; }
    var n = 0, t = setInterval(function () {
      if (typeof window.openXBot === "function") { clearInterval(t); window.openXBot(); return; }
      var btn = document.querySelector(".xbot-launcher");
      if (btn) { clearInterval(t); btn.click(); }
      if (++n > 80) clearInterval(t);
    }, 50);
  }
  function loadAndOpen() {
    if (typeof window.initXBot === "function") {
      if (!inited) { window.initXBot(CFG); inited = true; }
      openWhenReady(); return;
    }
    if (loading) return;
    loading = true;
    var s = document.createElement("script");
    s.src = SCRIPT_URL; s.async = true;
    s.onload = function () { window.initXBot(CFG); inited = true; openWhenReady(); };
    document.body.appendChild(s);
  }
  function mountStub() {
    if (document.getElementById("xbot-lazy-stub") || document.querySelector(".xbot-launcher")) return;
    var b = document.createElement("button");
    b.id = "xbot-lazy-stub"; b.type = "button"; b.setAttribute("aria-label", "Abrir chat");
    b.textContent = "💬";
    b.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:#25D366;color:#fff;font-size:22px;box-shadow:0 4px 14px rgba(0,0,0,.18)";
    b.addEventListener("click", function () {
      b.disabled = true; loadAndOpen();
      var n = 0, t = setInterval(function () {
        if (document.querySelector(".xbot-launcher")) { clearInterval(t); b.remove(); }
        if (++n > 100) clearInterval(t);
      }, 80);
    });
    document.body.appendChild(b);
  }
  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest("[data-xbot-open], #xbot-open-chat");
    if (!el) return;
    ev.preventDefault();
    loadAndOpen();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountStub);
  else mountStub();
  window.loadXBot = loadAndOpen;
})();
</script>
```

### 3) Carga imediata (opcional)

```html
<script src="https://xbotone.com/xchat/xbot.min.js"></script>
<script>
  window.initXBot({
    channelId: "UUID-DO-CANAL-XCHAT",
    clientId: "SEU_CLIENT_ID",
    token: "SEU_CLIENT_SECRET",
    apiBaseUrl: "https://api.xbotone.com"
  });
</script>
```

Com widget **≥ 1.0.24**, mesmo no pageload o transporte (poll/SSE) só liga ao **abrir** o chat.

Nome, cor, posição, offset, avatares e mensagem de boas-vindas vêm do painel
(edição do canal XChat → aparência), via `GET /v1/xchat/widget-config` — não precisam
estar no embed.

| Campo | Descrição |
|-------|-----------|
| `channelId` | UUID do canal XChat (**somente** o UUID) |
| `clientId` | Client ID da API Key (autenticação — **não** é o ID do visitante) |
| `token` | Client secret da API Key |
| `apiBaseUrl` | URL da API (produção: `https://api.xbotone.com`) |
| `user` | (opcional) Identidade do visitante logado no seu site |
| `context` | (opcional) URL/observações → follow-up no card Kanban |

### Contato identificado (`user`) e contexto (`context`)

Sem `user.externalUserId`, o visitante fica anônimo (`Visitante v_…`).

Com identidade, o site passa a chave única do usuário + dados do perfil:

```html
<script src="https://xbotone.com/xchat/xbot.min.js"></script>
<script>
  window.initXBot({
    channelId: "UUID-DO-CANAL-XCHAT",
    clientId: "SEU_CLIENT_ID",
    token: "SEU_CLIENT_SECRET",
    apiBaseUrl: "https://api.xbotone.com",
    user: {
      externalUserId: "USR-123",   // chave única no seu sistema (evita duplicar contato)
      name: "Maria Silva",
      email: "maria@empresa.com",
      phone: "+5511999999999",
      // chaves de campos customizáveis em snake_case
      custom_fields: {
        company_name: "Acme",
        plan_tier: "pro",
        lead_origin: "checkout"
      }
    },
    context: {
      pageUrl: "https://loja.com/produto/abc",
      pageTitle: "Produto ABC",
      notes: "Veio do checkout"
    }
  });
</script>
```

Os nomes em `custom_fields` devem coincidir com os campos customizáveis do contato
(Contatos → campos). Use **snake_case** quando o nome tiver mais de uma palavra
(`company_name`, não `companyName`). O widget/API também convertem camelCase para snake_case.

Em SPAs, após login ou mudança de rota:

```js
window.setXBotUser({ externalUserId: "USR-123", name: "Maria" });
window.setXBotContext({ pageUrl: location.href, pageTitle: document.title });
```

Com **embed hospedado**, esses helpers são definidos pelo `embed.js` na página pai e
encaminhados ao iframe (`xbot:set-user` / `xbot:set-context`).

Se `context.pageUrl` não for informado, o widget envia `window.location.href` automaticamente.

**Não commite o `client_secret` em repositório público.** Em apps com build (Next, Vite), use variáveis de ambiente.

### Mensagem de boas-vindas

Configure no painel (edição do canal XChat → "Mensagem de boas-vindas"). Quando definida:

1. **Ao carregar a página** do site hospedeiro (uma vez por aba/sessão do navegador), o widget:
   - mostra um **balão de prévia** com o texto (truncado) ao lado do botão flutuante;
   - aplica **animação** no launcher (pulso, anel e badge vermelho);
   - reproduz o **som de notificação** (mesmo das novas mensagens com o chat fechado).
2. **Ao abrir o chat**, o visitante vê a mensagem completa no histórico (suporta Markdown leve: `**negrito**`, links).

- A entrega proativa na carga da página usa `sessionStorage` por canal (`xbot_welcome_delivered_<channelId>`), para não repetir o alerta a cada navegação interna na mesma aba.
- Para disparar mensagens depois (ex.: promo), use `window.sendXBotMessage("...")` (ver abaixo).

---

## Integração no Next.js (ex.: xbot-site-v1)

O site já inclui o componente no layout. Basta configurar o `.env`:

```env
XBOT_XCHAT_CHANNEL_ID=uuid-do-canal
XBOT_XCHAT_CLIENT_ID=seu_client_id
XBOT_XCHAT_SECRET=seu_client_secret
XBOT_XCHAT_API_BASE_URL=https://api.xbotone.com
# Opcional — padrão é https://xbotone.com/xchat/xbot.min.js
# XBOT_XCHAT_SCRIPT_CDN=https://xbotone.com/xchat/xbot.min.js
```

Opcional:

```env
XBOT_XCHAT_POSITION=right
XBOT_XCHAT_THEME_COLOR=#25D366
```

Na Vercel, defina as mesmas variáveis em **Production** e faça um novo deploy.

O painel XBot (**Conexões → XChat**) gera um snippet com a URL estável para copiar no seu site.

---

## Aparência (cor e avatares)

No painel: **Conexões → editar canal XChat** — defina nome exibido, cor do chat, ícone do botão (upload no bucket do tenant), avatares do assistente e do visitante.

Se alguma imagem não for enviada, o widget usa os **ícones padrão XBot** (`app.xbotone.com/workforce/…`).

### Visual (v1.0.3+)

- Cabeçalho escuro XBot com faixa na cor do tema
- Botão flutuante maior, com anel de destaque e ícone SVG ao fechar
- Ícones monocromáticos (anexo, microfone, enviar) — sem seletor de emoji
- Balões de mensagem e área de composição redesenhados

O widget carrega essas preferências com `GET /v1/xchat/widget-config?channel_id=<UUID>` (mesma autenticação de `POST /message`).

A API aceita CORS em `/v1/xchat/*` a partir de qualquer origem HTTPS (sites dos clientes com o embed).

---

## Entrega de respostas (operador / bot → visitante)

| Canal | Mecanismo |
|-------|-----------|
| **App** [app.xbotone.com/chat](https://app.xbotone.com/chat) | **SSE** (`GET /v1/events/stream` com JWT do tenant) |
| **Widget no site** | **SSE** `GET /v1/xchat/stream` (fetch + `Authorization`, ~300ms) com **fallback** poll `GET /v1/xchat/messages` (~3s) |

Operador ou bot grava resposta com `sender=bot` na sessão do visitante. O widget recebe pelo stream; se o SSE falhar (proxy antigo, rede), usa poll.

Endpoints extras (widget ≥ 1.0.6):

- `GET /v1/xchat/stream` — eventos SSE: `connected`, `message`, `heartbeat`, `timeout` (reconectar após timeout)
- `GET /v1/xchat/history` — restaura conversa ao recarregar a página
- `POST /v1/xchat/message` — não bloqueia mais ~18s; resposta vem pelo stream/poll

Requisitos em produção: API atualizada + widget **≥ 1.0.7** (URL oficial `https://xbotone.com/xchat/xbot.min.js`).

### Log de versão no console (debug)

Ao carregar o site hospedeiro, o widget escreve no **DevTools → Console**:

```text
[XBot Widget 1.0.7] init { channelId, apiBaseUrl, ... }
[XBot Widget 1.0.7] UI pronta { visitorId, transporte: "sse+poll" }
[XBot Widget 1.0.7] poll ativo ...
[XBot Widget 1.0.7] mensagem recebida { via: "poll"|"sse", ... }
```

Se aparecer `poll falhou` com `status: 404`, a API em produção ainda não tem `/v1/xchat/messages` — faça deploy da API.

## API (referência)

O widget chama `POST /v1/xchat/message` com:

- `Authorization: Bearer <client_secret>`
- `X-XBot-Client-Id: <client_id>`
- Body: `{ "message", "channel_id", "visitor_id?", "user?", "context?" }`
  - `user`: `{ externalUserId, name?, email?, phone?, custom_fields? }` — contato identificado
  - `custom_fields`: chaves em **snake_case** (ex.: `company_name`), gravadas no metadata do contato
  - `context`: `{ pageUrl?, pageTitle?, notes? }` — follow-up no card Kanban

Poll (`GET /v1/xchat/messages`): `channel_id`, `visitor_id`, `after?` (ISO-8601).

SSE (`GET /v1/xchat/stream`): mesma auth; query `channel_id`, `visitor_id`, `last_message_id?`.

Histórico (`GET /v1/xchat/history`): `channel_id`, `visitor_id`, `limit?` (padrão 50).

---

## Desenvolvimento e release do widget

1. Edite `app/xbot.js`
2. Rode o build (gera `versions/{versão}/`, `versions/latest/` e copia para `xbot-site-v1/public/xchat/`):

```bash
npm run build
# ou: bash scripts/build-widget.sh 1.0.4
```

3. Na raiz do monorepo: `make git` — faz build, commit/push (chat + site), **tag + push** com a versão do `package.json` (fallback jsDelivr pinado) e purge jsDelivr opcional.

4. Quem usa a URL oficial (`https://xbotone.com/xchat/xbot.min.js`) passa a receber o novo JS após o deploy do site (cache ~5s). Hard refresh se ainda vir a versão antiga.

Tag manual (só se precisar): `git tag 1.0.8 && git push origin 1.0.8`

### Mensagem programática após o carregamento (opcional)

```js
window.sendXBotMessage("Você tem uma nova mensagem!");
```

Dispara animação de badge/som se o chat estiver fechado (comportamento igual a nova mensagem do bot).

---

## Legado

Canais antigos podem usar só `token` (segredo do canal), sem `clientId` / `channelId`. Prefira API Keys com escopo `xchat:widget`.
