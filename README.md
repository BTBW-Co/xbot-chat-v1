# XChat (xbot-chat-v1)

Widget de chat para colar em qualquer site. Conecta à API do XBot.

Repositório: [github.com/BTBW-Co/xbot-chat-v1](https://github.com/BTBW-Co/xbot-chat-v1)

---

## Antes de integrar

1. No painel XBot: **Configurações → API Keys** → crie uma chave com escopo **`xchat:widget`** (guarde `client_id` e `client_secret` — o secret só aparece uma vez).
2. **Configurações → Conexões** → crie um canal **XChat** e associe uma **pipeline** (nome do bot, boas-vindas e tom vêm da pipeline).
3. Anote o **UUID do canal** (`channelId`).

---

## Integração em qualquer site (HTML)

Cole antes de `</body>`:

```html
<script src="https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@1.0.2/versions/1.0.2/xbot.min.js"></script>
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

**Não commite o `client_secret` em repositório público.** Em apps com build (Next, Vite), use variáveis de ambiente.

### URL do script

| Fonte | URL |
|-------|-----|
| jsDelivr (padrão) | `https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@1.0.2/versions/1.0.2/xbot.min.js` |
| GitHub raw | `https://raw.githubusercontent.com/BTBW-Co/xbot-chat-v1/1.0.2/versions/1.0.2/xbot.min.js` |

---

## Integração no Next.js (ex.: xbot-site-v1)

O site já inclui o componente no layout. Basta configurar o `.env`:

```env
XBOT_XCHAT_CHANNEL_ID=uuid-do-canal
XBOT_XCHAT_CLIENT_ID=seu_client_id
XBOT_XCHAT_SECRET=seu_client_secret
XBOT_XCHAT_API_BASE_URL=https://api.xbotone.com
XBOT_XCHAT_SCRIPT_CDN=https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@1.0.2/versions/1.0.2/xbot.min.js
```

Opcional:

```env
XBOT_XCHAT_POSITION=right
XBOT_XCHAT_THEME_COLOR=#25D366
```

Na Vercel, defina as mesmas variáveis em **Production** e faça um novo deploy.

O painel XBot (**Conexões → XChat**) gera um snippet igual ao HTML acima para copiar no seu site.

---

## Aparência (cor e avatares)

No painel: **Conexões → editar canal XChat** — defina nome exibido, cor do chat, ícone do botão (upload no bucket do tenant), avatares do assistente e do visitante.

Se alguma imagem não for enviada, o widget usa os **ícones padrão XBot** (`assets/default/` no repositório, servidos via jsDelivr `@main`).

O widget carrega essas preferências com `GET /v1/xchat/widget-config?channel_id=<UUID>` (mesma autenticação de `POST /message`).

---

## API (referência)

O widget chama `POST /v1/xchat/message` com:

- `Authorization: Bearer <client_secret>`
- `X-XBot-Client-Id: <client_id>`
- Body: `{ "message", "channel_id", "visitor_id?" }`

---

## Desenvolvimento do widget

- Fonte: `app/xbot.js`
- Build: `npx terser app/xbot.js -c -m -o versions/1.0.3/xbot.min.js`

### Mensagem do sistema (opcional)

```js
window.sendXBotMessage("Você tem uma nova mensagem!");
```

---

## Legado

Canais antigos podem usar só `token` (segredo do canal), sem `clientId` / `channelId`. Prefira API Keys com escopo `xchat:widget`.
