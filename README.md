# xbot-widget (XChat)

Widget de chat para embed em sites. Conecta à API do XBot.

## Autenticação (recomendado)

1. No painel XBot, crie um **API Client** em **Configurações → API Keys** com o escopo **`xchat:widget`** (guarde `client_id` e `client_secret` — o secret só aparece na criação).
2. Crie um canal **XChat** em **Configurações → Conexões** e associe uma **pipeline** (comportamento do bot vem da pipeline).
3. No site, use `channelId` (UUID do canal XChat), `clientId` e `token` (**client_secret**) via variáveis de ambiente no build — **não** commite o secret em repositório público.

```html
<script src="https://cdn.jsdelivr.net/gh/ORGANIZACAO/REPO@1.0.2/versions/1.0.2/xbot.min.js"></script>
<script>
  window.initXBot({
    channelId: "UUID-DO-CANAL-XCHAT",
    clientId: "SEU_CLIENT_ID",
    token: "SEU_CLIENT_SECRET",
    apiBaseUrl: "https://api.xbot.digital",
    position: "right",
    themeColor: "#25D366"
  });
</script>
```

O widget envia `channel_id` no JSON de `/v1/xchat/message` e os cabeçalhos `Authorization: Bearer <client_secret>` e `X-XBot-Client-Id: <client_id>`.

## Legado

Canais antigos podem ainda usar apenas `token` igual ao segredo do canal (sem `clientId` / `channelId`). Prefira migrar para API Keys.

## Desenvolvimento

- Fonte: `app/xbot.js`
- Build minificado (exemplo): `npx terser app/xbot.js -c -m -o versions/1.0.2/xbot.min.js`

## Mensagens do sistema

```js
window.sendXBotMessage("Você tem uma nova mensagem!");
```
