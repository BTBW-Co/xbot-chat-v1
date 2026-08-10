# XChat (xbot-chat-v1)

Widget de chat para colar em qualquer site. Conecta à API do XBot.

Repositório: [github.com/BTBW-Co/xbot-chat-v1](https://github.com/BTBW-Co/xbot-chat-v1)

---

## Antes de integrar

1. No painel XBot: **Configurações → API Keys** → crie uma chave com escopo **`xchat:widget`** (guarde `client_id` e `client_secret` — o secret só aparece uma vez).
2. **Configurações → Conexões** → crie um canal **XChat** e associe uma **pipeline** (nome do bot, boas-vindas e tom vêm da pipeline).
3. Anote o **UUID do canal** (`channelId`).

---

## CDN — URL do script

### URL oficial (recomendada)

Use **sempre** esta URL no `<script src="...">`. Ela **não muda** entre releases: o artefato vive em `xbot-site-v1/public/xchat/xbot.min.js` e é sincronizado a cada `npm run build` do chat / `make git`. Cache curto no CloudFront (`max-age=5`).

**CDN estável (first-party):**

[https://xbotone.com/xchat/xbot.min.js](https://xbotone.com/xchat/xbot.min.js)

```text
https://xbotone.com/xchat/xbot.min.js
```

| Item | Valor |
|------|--------|
| Provedor | Site oficial (`xbotone.com` / CloudFront) |
| Artefato | `xbot-site-v1/public/xchat/xbot.min.js` |
| Atualização | Automática após build do chat + deploy do site |

A API também expõe essa URL em `GET /v1/xchat/widget-config` no campo **`script_cdn_url`**. Em produção, pode sobrescrever com `XCHAT_WIDGET_SCRIPT_CDN`.

**Ícones padrão** (quando o tenant não envia imagem no painel) vêm do app (`app.xbotone.com/workforce/…`).

### Congelar em uma versão (opcional, jsDelivr)

Se precisar de **pin semver** (auditoria, rollback ou homologação):

```
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@1.0.25/versions/1.0.25/xbot.min.js
```

Substitua pela tag desejada. Essa URL **não** se atualiza sozinha.

### O que evitar

- `cdn.jsdelivr.net/...@main/versions/latest/...` — cache inconsistente entre edges.
- Repositório legado `btbw/xbot-chat` — use apenas `BTBW-Co/xbot-chat-v1`.

---

## Integração em qualquer site (HTML)

### Lazy-load (recomendado)

Não baixa o JS nem chama a API até o visitante clicar. Cole **um** bloco antes de `</body>` (substitua credenciais):

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

Botão próprio do site: `data-xbot-open` ou `id="xbot-open-chat"` também dispara o load. Ou chame `window.loadXBot()`.

### Carga imediata (opcional)

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
| `channelId` | UUID do canal XChat |
| `clientId` | Client ID da API Key |
| `token` | Client secret da API Key |
| `apiBaseUrl` | URL da API (produção: `https://api.xbotone.com`) |

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
- Body: `{ "message", "channel_id", "visitor_id?" }`

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
