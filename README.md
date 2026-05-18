# XChat (xbot-chat-v1)

Widget de chat para colar em qualquer site. Conecta à API do XBot.

Repositório: [github.com/BTBW-Co/xbot-chat-v1](https://github.com/BTBW-Co/xbot-chat-v1)

---

## Antes de integrar

1. No painel XBot: **Configurações → API Keys** → crie uma chave com escopo **`xchat:widget`** (guarde `client_id` e `client_secret` — o secret só aparece uma vez).
2. **Configurações → Conexões** → crie um canal **XChat** e associe uma **pipeline** (nome do bot, boas-vindas e tom vêm da pipeline).
3. Anote o **UUID do canal** (`channelId`).

---

## CDN (jsDelivr) — URL do script

O widget é servido pelo [jsDelivr](https://www.jsdelivr.com/) a partir deste repositório GitHub (`BTBW-Co/xbot-chat-v1`).

### URL oficial (recomendada)

Use **sempre** esta URL no `<script src="...">`. Ela **não muda** entre releases: após cada `npm run build` e push em `main`, o arquivo `versions/latest/xbot.min.js` é atualizado e os sites passam a carregar o JS novo (o cache do jsDelivr pode levar alguns minutos).

**CDN estável:**

[https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js](https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js)

```text
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js
```

| Item | Valor |
|------|--------|
| Provedor | [jsDelivr](https://cdn.jsdelivr.net/) (GitHub) |
| Repositório | `BTBW-Co/xbot-chat-v1` |
| Branch / ref | `main` |
| Caminho no repo | `versions/latest/xbot.min.js` |
| Atualização | Automática após push em `main` com novo build em `versions/latest/` |

A API também expõe essa URL em `GET /v1/xchat/widget-config` no campo **`script_cdn_url`** (mesma autenticação de `POST /message`). Em produção, a API pode sobrescrever com a variável de ambiente `XCHAT_WIDGET_SCRIPT_CDN`.

**Ícones padrão** (quando o tenant não envia imagem no painel):

```
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/assets/default/launcher.svg
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/assets/default/bot-avatar.svg
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/assets/default/user-avatar.svg
```

### Congelar em uma versão (opcional)

Se precisar de **pin semver** (auditoria, rollback ou homologação), use tag Git + pasta da versão:

```
https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@1.0.3/versions/1.0.3/xbot.min.js
```

Substitua `1.0.3` pela tag desejada. Essa URL **não** se atualiza sozinha — só mude o embed se quiser travar o JS.

### O que evitar

- URLs com tag antiga no path (`@1.0.2/versions/1.0.2/...`) exigem troca manual a cada release.
- Repositório legado `btbw/xbot-chat` — use apenas `BTBW-Co/xbot-chat-v1`.

---

## Integração em qualquer site (HTML)

Cole antes de `</body>`:

```html
<script src="https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js"></script>
<script>
  window.initXBot({
    channelId: "UUID-DO-CANAL-XCHAT",
    clientId: "SEU_CLIENT_ID",
    token: "SEU_CLIENT_SECRET",
    apiBaseUrl: "https://api.xbotone.com",
    position: "right",
    themeColor: "#25D366"
  });
</script>
```

| Campo | Descrição |
|-------|-----------|
| `channelId` | UUID do canal XChat |
| `clientId` | Client ID da API Key |
| `token` | Client secret da API Key |
| `apiBaseUrl` | URL da API (produção: `https://api.xbotone.com`) |
| `position` | `right` ou `left` |
| `themeColor` | Cor do botão (ex.: `#25D366`) |
| `welcomeMessage` | *(opcional)* Texto de boas-vindas exibido ao carregar o site (balão ao lado do botão + animação no launcher; mensagem completa ao abrir o chat) |

**Não commite o `client_secret` em repositório público.** Em apps com build (Next, Vite), use variáveis de ambiente.

### Mensagem de boas-vindas (`welcomeMessage`)

Parâmetro **opcional** no `initXBot`. Quando definido:

1. **Ao carregar a página** do site hospedeiro (uma vez por aba/sessão do navegador), o widget:
   - mostra um **balão de prévia** com o texto (truncado) ao lado do botão flutuante;
   - aplica **animação** no launcher (pulso, anel e badge vermelho);
   - reproduz o **som de notificação** (mesmo das novas mensagens com o chat fechado).
2. **Ao abrir o chat**, o visitante vê a mensagem completa no histórico (suporta Markdown leve: `**negrito**`, links).

```html
<script>
  window.initXBot({
    channelId: "UUID-DO-CANAL-XCHAT",
    clientId: "SEU_CLIENT_ID",
    token: "SEU_CLIENT_SECRET",
    apiBaseUrl: "https://api.xbotone.com",
    position: "right",
    themeColor: "#25D366",
    welcomeMessage: "Olá! 👋 Sou o assistente da sua loja. Em que posso ajudar?"
  });
</script>
```

- O valor definido no **embed do site** tem prioridade sobre `welcome_message` da API (quando a API não envia texto).
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
# Opcional — padrão é a URL estável @main/versions/latest:
# XBOT_XCHAT_SCRIPT_CDN=https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js
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

Se alguma imagem não for enviada, o widget usa os **ícones padrão XBot** (`assets/default/` no repositório, servidos via jsDelivr `@main`).

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

Requisitos em produção: API atualizada + widget **≥ 1.0.7** (ou `@main/versions/latest`).

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
2. Rode o build (gera `versions/{versão}/` e copia para `versions/latest/`):

```bash
npm run build
# ou: bash scripts/build-widget.sh 1.0.4
```

3. Na raiz do monorepo: `make git` — faz build, commit/push em `main` e **tag + push** com a versão do `package.json` (ex.: `1.0.8` → jsDelivr `@1.0.8/versions/1.0.8/...`)

4. Quem usa a URL estável (`@main/versions/latest/xbot.min.js`) passa a receber o novo JS após o push (cache do jsDelivr pode levar alguns minutos)

Tag manual (só se precisar): `git tag 1.0.8 && git push origin 1.0.8`

### Mensagem programática após o carregamento (opcional)

```js
window.sendXBotMessage("Você tem uma nova mensagem!");
```

Dispara animação de badge/som se o chat estiver fechado (comportamento igual a nova mensagem do bot).

---

## Legado

Canais antigos podem usar só `token` (segredo do canal), sem `clientId` / `channelId`. Prefira API Keys com escopo `xchat:widget`.
