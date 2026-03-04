# xbot-widget (XChat)

Widget de chat para embed em sites. Conecta à API do XBot via **API key** (token com permissão XChat).

## Instalação (sem npm)

Inclua o script no seu site e chame `initXBot`. O script pode ser servido via **jsDelivr** (GitHub) ou outro CDN.

### 1. Inclua o script (jsDelivr – GitHub)

Substitua `ORGANIZACAO/REPO` e a tag `1.0.1` pela versão desejada:

```html
<script src="https://cdn.jsdelivr.net/gh/ORGANIZACAO/REPO@1.0.1/versions/1.0.1/xbot.min.js"></script>
```

### 2. Instancie o widget

Para sites em **outro domínio** (fora do XBot), use `apiBaseUrl` apontando para a API do XBot. O `token` é a **API key** com permissão XChat.

```js
window.initXBot({
  token: "SUA_API_KEY_XCHAT",
  apiBaseUrl: "https://api.xbot.digital",
  botName: "Atendimento",
  botAvatar: "",
  launcherIcon: "https://xbot.digital/lovable-uploads/bb25477e-ad2b-4098-8918-19310f719890.png",
  themeColor: "#25D366",
  welcomeMessage: "Olá! Como posso te ajudar?",
  position: "right"
});
```

- **token**: API key com permissão XChat (obtida no painel ao criar o inbound XChat).
- **apiBaseUrl**: URL base da API (ex.: `https://api.xbot.digital`). Quando informada, o widget chama `/v1/xchat/message` e `/v1/xchat/upload` nessa base.

O XBot será exibido como um botão flutuante no canto da tela, e ao clicar, abrirá o chat com seu bot personalizado.

🔔 3. Enviar mensagens do sistema:

Você pode disparar mensagens diretamente via JavaScript:

``` js
window.sendXBotMessage("Você tem uma nova mensagem!");
```
Essa chamada simula uma mensagem enviada pelo bot e ativa a notificação visual no botão flutuante.

⚛️ **React**:

Você pode criar o componente XbotWidget e importar normalmente em qualquer página da aplicação:
```js
import { useEffect } from 'react';

export function XBotWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://xbot-app.s3.us-east-1.amazonaws.com/cdn/1.0.0/xbot.min.js';
    script.async = true;

    script.onload = () => {
      window.initXBot?.({
        botName: 'nome desejado',
        botAvatar: 'url da foto desejada',
        launcherIcon: 'https://xbot.digital/lovable-uploads/bb25477e-ad2b-4098-8918-19310f719890.png',
        themeColor: 'black',
        welcomeMessage: 'Olá! Como posso te ajudar com o XBot?',
        position: 'right',
        token: 'xbot_token_abc123',
      });
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
```

