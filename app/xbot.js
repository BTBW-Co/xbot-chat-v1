(function () {
    
    window.__xbotConfig = null;
  
    window.initXBot = function (config) {
      window.__xbotConfig = config;
    };
  
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(markedScript);
  
    const purifyScript = document.createElement('script');
    purifyScript.src = 'https://cdn.jsdelivr.net/npm/dompurify@2.4.4/dist/purify.min.js';
    document.head.appendChild(purifyScript);

    const notificationSound = new Audio('https://notificationsounds.com/soundfiles/b9ece18c950afbfa6b0fdbfa4ff731d3/file-sounds-1102-eventually.mp3');
    notificationSound.volume = 0.5;

    function waitForLibs(callback) {
      const interval = setInterval(() => {
        // && window.EmojiButton        
        if (window.marked && window.DOMPurify && window.__xbotConfig) {
          clearInterval(interval);
          callback();
        }
      }, 200);
    }
  
    waitForLibs(() => {
        const config = window.__xbotConfig || {};
        const {
            botName = 'XBot',
            botAvatar = '',
            launcherIcon = '',
            themeColor = '#25D366',
            position = 'right',
            welcomeMessage = 'Olá! Como posso te ajudar?',
            token = '',
            apiBaseUrl = '',
            offsetBottom = 20
        } = config;
        function getMessageUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '/api/xbot/message';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/message';
        }
        function getUploadUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '/api/xbot/upload';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/upload';
        }
        function getVisitorId() {
            try {
                var key = 'xbot_visitor_id';
                var id = typeof localStorage !== 'undefined' && localStorage.getItem(key);
                if (!id) {
                    id = 'v_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
                    if (typeof localStorage !== 'undefined') localStorage.setItem(key, id);
                }
                return id;
            } catch (e) { return null; }
        }
    
        const closeIcon = "https://cdn-icons-png.flaticon.com/512/1828/1828843.png";
        const offset = offsetBottom || 20;

        let unreadCount = 0;
        let welcomeShown = false;
        

        const style = document.createElement('style');
        style.innerHTML = `
            .xbot-button {
            position: fixed;
            bottom: 20px;            
            ${position === 'left' ? 'left: 20px;' : 'right: 20px;'}
            width: 60px;
            height: 60px;
            background-color: ${themeColor};
            border-radius: 50%;
            border: none;
            background-image: url('${launcherIcon}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            cursor: pointer;
            z-index: 9999;
            }
    
            .xbot-chatbox {
            position: fixed;
            bottom: 90px;
            ${position === 'left' ? 'left: 20px;' : 'right: 20px;'}
            width: 320px;
            min-height: 300px;
            max-height: 500px;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 9999;
            font-family: Arial, sans-serif;
            }
    
            .xbot-header {
            background-color: ${themeColor};
            color: white;
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: bold;
            }
    
            .xbot-header img {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            }
    
            .xbot-messages {
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            scroll-behavior: smooth;
            }
    
            .xbot-message-content {
            display: flex;
            flex-direction: column;
            align-items: flex-end; /* empurra a hora pra direita */
            gap: 4px;
            }

            .xbot-text {
            display: block;
            word-wrap: break-word;
            }

            .xbot-time {
            font-size: 10px;
            font-weight: 300;
            color: rgba(0, 0, 0, 0.5);
            align-self: flex-end;
            }         

            .xbot-input-area {
            display: flex;
            border-top: 1px solid #ccc;
            align-items: center;
            padding: 5px;
            }
    
            .xbot-input {
            flex: 1;
            border: none;
            padding: 10px;
            font-size: 14px;
            resize: none;
            overflow: hidden;
            line-height: 1.4;
            }
    
            .xbot-send {
            background: ${themeColor};
            color: white;
            border-radius: 5px;
            padding: 0 15px;
            cursor: pointer;
            margin-left: 5px;
            height: 35px;
            }

            .xbot-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 10px;
            border-top: 1px solid #eee;
            }

            .xbot-icons {
            display: flex;
            gap: 10px;
            }

            .xbot-toolbar button {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #888;
            }

            .xbot-powered {
            font-size: 10px;
            color: #aaa;
            font-style: italic;
            white-space: nowrap;
            }
    
            .xbot-message {
            margin: 5px 0;
            padding: 8px 12px;
            border-radius: 18px;
            max-width: 80%;
            font-size: 14px;
            line-height: 1.4;
            opacity: 0;
            transform: translateY(10px);
            animation: fadeInUp 0.3s ease forwards;
            }

            .xbot-input {
            flex: 1;
            border: 1px solid #ccc; /* borda padrão */
            padding: 10px;
            font-size: 14px;
            resize: none;
            overflow: hidden;
            line-height: 1.4;
            border-radius: 6px;
            outline: none; /* remove o azul padrão */
            }

            .xbot-notification {
            position: absolute;
            top: -6px;
            right: -6px;
            background-color: red;
            color: white;
            font-size: 12px;
            font-weight: bold;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: none;
            align-items: center;
            justify-content: center;
            }

            .xbot-input:focus-visible {
            border-color: ${themeColor}; 
            box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05); /* opcional */
            }
    
            @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
            }
    
            .xbot-message.user {
            background-color: #dcf8c6;
            align-self: flex-end;
            border-radius: 10px 10px 0px 10px;
            }
    
            .xbot-message.bot {
            background-color: #f1f0f0;
            align-self: flex-start;
            border-radius: 10px 10px 0px 10px;
            }
    
            .xbot-message a {
            color:rgb(246, 60, 147);
            text-decoration: underline;
            word-break: break-word;
            }
    
            .xbot-typing {
            font-size: 12px;
            color: gray;
            margin: 4px;
            font-style: italic;
            }
    
            @media screen and (max-width: 600px) {
            .xbot-chatbox {
                width: 100vw;
                height: 100vh;
                bottom: 0;
                right: 0;
                border-radius: 0;
            }
            }
        `;

        document.head.appendChild(style);
    
        const button = document.createElement('button');
        button.className = 'xbot-button';
                
        const chatbox = document.createElement('div');
        chatbox.className = 'xbot-chatbox';
        chatbox.style.display = 'none'; 
        chatbox.innerHTML = `
            <div class="xbot-header">
            <img src="${botAvatar}" alt="avatar" />
            <span>${botName}</span>
            </div>
            <div class="xbot-messages" id="xbot-messages"></div>            
            <div class="xbot-input-area">
                <textarea class="xbot-input" id="xbot-input" placeholder="Escreva sua mensagem..." rows="1"></textarea>
                <button class="xbot-send" id="xbot-send">Enviar</button>
            </div>
            <div class="xbot-toolbar">
                <div class="xbot-icons">                    
                    <button id="xbot-emoji">😊</button>    
                    <button id="xbot-upload">📎</button>
                    <button id="xbot-audio">🎤</button>
                </div>
                <a class="xbot-powered" href="https://xbot.digital" target="_blank" rel="noopener noreferrer">
                    powered by <strong>XBot</strong>
                </a>
            </div>            
        `;

        const emojiPopup = document.createElement('div');
        emojiPopup.className = 'xbot-emoji-popup';
        emojiPopup.style.display = 'none';
        emojiPopup.style.position = 'absolute';
        emojiPopup.style.bottom = '60px'; // altura do input
        emojiPopup.style.left = '10px';
        emojiPopup.style.right = '10px';
        emojiPopup.style.background = '#fff';
        emojiPopup.style.border = '1px solid #ddd';
        emojiPopup.style.borderRadius = '8px';
        emojiPopup.style.padding = '8px';
        emojiPopup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        emojiPopup.style.zIndex = '2';
        emojiPopup.style.display = 'flex';
        emojiPopup.style.flexWrap = 'nowrap';
        emojiPopup.style.overflowX = 'auto';
        emojiPopup.style.maxWidth = '100%';
        emojiPopup.style.gap = '10px';
        emojiPopup.style.fontSize = '22px';
        emojiPopup.style.scrollBehavior = 'smooth';
        emojiPopup.style.alignItems = 'center';
        emojiPopup.style.backgroundClip = 'padding-box';
        
        const emojis = ['😂','😍','🥰','🤣','😊','😭','😘','😎','😁','😉','👍','🙏'];
        
        emojis.forEach(emoji => {
          const btn = document.createElement('button');
          btn.textContent = emoji;
          btn.style.border = 'none';
          btn.style.background = 'transparent';
          btn.style.cursor = 'pointer';
          btn.onclick = () => {
            input.value += emoji;
            input.focus();
            emojiPopup.style.display = 'none';
          };
          emojiPopup.appendChild(btn);
        });
        
        const notification = document.createElement('div');
        notification.className = 'xbot-notification';
        notification.textContent = '1';

        document.body.appendChild(emojiPopup);
        document.body.appendChild(button);
        button.style.bottom = `${offsetBottom || 20}px`;  
        button.appendChild(notification);   

        document.body.appendChild(chatbox);
        chatbox.style.bottom = `${(offsetBottom || 20) + 70}px`;

        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });

        button.addEventListener('click', () => {
            const isOpen = chatbox.style.display === 'flex';
            chatbox.style.display = isOpen ? 'none' : 'flex';
            chatbox.style.flexDirection = 'column';

            if (!isOpen) {
                unreadCount = 0;
                emojiPopup.style.display = 'none';                
                notification.style.display = 'none';
                button.style.backgroundImage = `url(${closeIcon})`;

                // Mostrar mensagem de boas-vindas apenas uma vez
                if (!welcomeShown && welcomeMessage) {
                  appendMessage(welcomeMessage, 'bot');
                  welcomeShown = true;
                }
            } else {
                button.style.backgroundImage = `url(${launcherIcon})`;                
            }       
        });

        // As próximas etapas incluem: handlers de emoji, upload, e gravação de áudio...
        const emojiBtn = document.getElementById('xbot-emoji');
        const uploadBtn = document.getElementById('xbot-upload');
        const audioBtn = document.getElementById('xbot-audio');
        const input = document.getElementById('xbot-input');
        const messages = document.getElementById('xbot-messages');
        
        const send = chatbox.querySelector('#xbot-send');        
        send.addEventListener('click', handleSendMessage);

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
        });        


        function appendMessage(text, from = 'user') {
            const msg = document.createElement('div');
            msg.className = `xbot-message ${from}`;
            const unsafeHTML = window.marked.parse(text);
            const sanitized = window.DOMPurify.sanitize(unsafeHTML);
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            msg.innerHTML = `
                <div class="xbot-message-content">
                    <div class="xbot-text">${sanitized}</div>
                    <div class="xbot-time">${timestamp}</div>
                </div>
            `;
            
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;

            if (from === 'bot' && chatbox.style.display === 'none') {
                unreadCount++;
                notification.textContent = unreadCount;
                notification.style.display = 'flex';
                notificationSound.play().catch(() => {});
            }            
        }     
        
        async function handleSendMessage() {
            const text = input.value.trim();
            if (!text) return;
          
            appendMessage(text, 'user');
            input.value = '';
          
            const typing = document.createElement('div');
            typing.className = 'xbot-typing';
            typing.textContent = `${botName} está digitando...`;
            messages.appendChild(typing);
            messages.scrollTop = messages.scrollHeight;
          
            try {
                const visitorId = getVisitorId();
                const response = await fetch(getMessageUrl(), {
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ message: text, visitor_id: visitorId || undefined })
                });
                const data = await response.json();
                if (data.visitor_id && visitorId !== data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                setTimeout(() => {
                    if (data.reply) {
                        appendMessage(data.reply, 'bot');
                    }
                    messages.removeChild(typing);
                }, 1000);

            } catch (err) {
                setTimeout(() => {
                    messages.removeChild(typing);
                    appendMessage('Sua configuração está **muito próxima de ser concluída** 😊. Verifique seu **token** e tente novamente. Caso precise de ajuda estamos *[aqui](https://xbot.digital/suporte)* para auxilia-lo..', 'bot');
                }, 1000);
            }
        }     

        window.sendXBotMessage = function(message) {
            if (typeof appendMessage !== 'function') return;
          
            appendMessage(message, 'bot');
          
            if (chatbox.style.display === 'none') {
              unreadCount++;
              notification.textContent = unreadCount;
              notification.style.display = 'flex';
          
              notificationSound?.play().catch(() => {});
            }
        };        
        
        chatbox.appendChild(emojiPopup);

        emojiBtn.addEventListener('click', () => {            
            emojiPopup.style.display = emojiPopup.style.display === 'none' ? 'flex' : 'none';
        });        
        
        // Upload de Arquivos (pdf, imagens)
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.jpg,.jpeg,.png,.gif';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
        
            const formData = new FormData();
            formData.append('file', file);
            var vid = getVisitorId();
            if (vid) formData.append('visitor_id', vid);
        
            const preview = document.createElement('div');
            preview.className = 'xbot-message user';
            if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '100%';
            img.style.borderRadius = '10px';
            preview.appendChild(img);
            } else {
            preview.innerHTML = `📎 ${file.name}`;
            }
            messages.appendChild(preview);
            messages.scrollTop = messages.scrollHeight;
        
            try {
            const res = await fetch(getUploadUrl(), {
                method: 'POST',
                headers: { Authorization: `Bearer ${window.__xbotConfig.token}` },
                body: formData
            });
            const data = await res.json();
            const msg = document.createElement('div');
            msg.className = 'xbot-message bot';
            msg.innerHTML = `Arquivo recebido: <a href="${data.url}" target="_blank">${file.name}</a>`;
            messages.appendChild(msg);
            } catch (err) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'xbot-message bot';
            errorMsg.textContent = 'Erro ao enviar o arquivo.';
            messages.appendChild(errorMsg);
            }
            messages.scrollTop = messages.scrollHeight;
        });
        
        // Gravação de Áudio
        let mediaRecorder;
        let chunks = [];
        let isRecording = false;
        
        audioBtn.addEventListener('click', async () => {
            if (isRecording) {
            mediaRecorder.stop();
            audioBtn.textContent = '🎤';
            isRecording = false;
            return;
            }
        
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Seu navegador não suporta gravação de áudio.');
            return;
            }
        
            try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            chunks = [];
        
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', blob, 'audio.webm');
        
                const audioPreview = document.createElement('audio');
                audioPreview.controls = true;
                audioPreview.src = URL.createObjectURL(blob);
                const audioMsg = document.createElement('div');
                audioMsg.className = 'xbot-message user';
                audioMsg.appendChild(audioPreview);
                messages.appendChild(audioMsg);
                messages.scrollTop = messages.scrollHeight;
        
                try {
                const res = await fetch('/api/xbot/upload', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${window.__xbotConfig.token}` },
                    body: formData
                });
                const data = await res.json();
                const reply = document.createElement('div');
                reply.className = 'xbot-message bot';
                reply.innerHTML = `Áudio recebido: <a href="${data.url}" target="_blank">Ouvir</a>`;
                messages.appendChild(reply);
                } catch (err) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'xbot-message bot';
                errorMsg.textContent = 'Erro ao enviar o áudio.';
                messages.appendChild(errorMsg);
                }
                messages.scrollTop = messages.scrollHeight;
            };
        
            mediaRecorder.start();
            isRecording = true;
            audioBtn.textContent = '⏹️';
            } catch (err) {
            alert('Erro ao iniciar gravação de áudio.');
            }
        });
        
    });


  })();

 