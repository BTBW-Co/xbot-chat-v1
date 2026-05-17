(function () {

    var XBOT_DEFAULT_ASSETS_BASE =
      'https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/assets/default';

    function xbotDefaultAssetUrl(file) {
      return XBOT_DEFAULT_ASSETS_BASE + '/' + file;
    }

    function applyXbotAssetDefaults(cfg) {
      cfg = cfg || {};
      var launcher = (cfg.launcherIcon || '').trim();
      var bot = (cfg.botAvatar || '').trim();
      var user = (cfg.userAvatar || '').trim();
      return Object.assign({}, cfg, {
        launcherIcon: launcher || xbotDefaultAssetUrl('launcher.svg'),
        botAvatar: bot || xbotDefaultAssetUrl('bot-avatar.svg'),
        userAvatar: user || xbotDefaultAssetUrl('user-avatar.svg'),
      });
    }
    
    window.__xbotConfig = null;
    window.__xbotAppearanceReady = true;

    function fetchWidgetAppearance() {
      const cfg = window.__xbotConfig || {};
      const base = (cfg.apiBaseUrl || '').replace(/\/$/, '');
      if (!base || !cfg.channelId) {
        return Promise.resolve();
      }
      const url = base + '/v1/xchat/widget-config?channel_id=' + encodeURIComponent(cfg.channelId);
      const headers = {};
      if (cfg.clientId && cfg.channelId && cfg.token) {
        headers['Authorization'] = 'Bearer ' + cfg.token;
        headers['X-XBot-Client-Id'] = cfg.clientId;
      } else if (cfg.token) {
        headers['Authorization'] = 'Bearer ' + cfg.token;
      }
      return fetch(url, { headers })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (!data) return;
          window.__xbotConfig = applyXbotAssetDefaults(
            Object.assign({}, cfg, {
              themeColor: data.theme_color || cfg.themeColor,
              botAvatar: data.bot_avatar_url || cfg.botAvatar,
              userAvatar: data.user_avatar_url || cfg.userAvatar,
              botName: data.bot_name || cfg.botName,
              welcomeMessage:
                (cfg.welcomeMessage != null && String(cfg.welcomeMessage).trim())
                  ? cfg.welcomeMessage
                  : (data.welcome_message != null ? data.welcome_message : cfg.welcomeMessage),
              launcherIcon: data.launcher_icon_url || cfg.launcherIcon,
            })
          );
        })
        .catch(function () {
          window.__xbotConfig = applyXbotAssetDefaults(window.__xbotConfig || {});
        });
    }

    window.initXBot = function (config) {
      window.__xbotConfig = applyXbotAssetDefaults(config || {});
      window.__xbotAppearanceReady = false;
      fetchWidgetAppearance().finally(function () {
        window.__xbotAppearanceReady = true;
      });
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
        if (window.marked && window.DOMPurify && window.__xbotConfig && window.__xbotAppearanceReady) {
          clearInterval(interval);
          callback();
        }
      }, 200);
    }
  
    waitForLibs(() => {
        const config = applyXbotAssetDefaults(window.__xbotConfig || {});
        const {
            botName = 'XBot',
            botAvatar = '',
            userAvatar = '',
            launcherIcon = '',
            themeColor = '#25D366',
            position = 'right',
            welcomeMessage = null,
            token = '',
            clientId = '',
            channelId = '',
            apiBaseUrl = '',
            offsetBottom = 20
        } = config;

        function buildAuthHeaders(extra) {
            const h = Object.assign({}, extra || {});
            if (clientId && channelId && token) {
                h['Authorization'] = 'Bearer ' + token;
                h['X-XBot-Client-Id'] = clientId;
                return h;
            }
            if (token) {
                h['Authorization'] = 'Bearer ' + token;
                return h;
            }
            return h;
        }

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

        function getMessagesPollUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/messages';
        }

        function getStreamUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/stream';
        }

        function getHistoryUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/history';
        }

        var lastBotPollAt = null;
        var lastBotMessageId = null;
        var seenBotMessageKeys = {};
        var pollTimer = null;
        var XCHAT_POLL_MS = 3000;
        var sseAbortController = null;
        var sseActive = false;
        var sseFailCount = 0;
        var pendingTypingEl = null;

        function pollStorageKey() {
            var vid = getVisitorId();
            if (!channelId || !vid) return null;
            return 'xbot_last_bot_poll_' + channelId + '_' + vid;
        }

        function formatPollAfter(value) {
            if (!value) return null;
            try {
                var d = value instanceof Date ? value : new Date(value);
                if (isNaN(d.getTime())) return null;
                return d.toISOString();
            } catch (e) {
                return null;
            }
        }

        function loadLastBotPollAt() {
            try {
                var key = pollStorageKey();
                if (!key || typeof sessionStorage === 'undefined') return null;
                return sessionStorage.getItem(key);
            } catch (e) {
                return null;
            }
        }

        function saveLastBotPollAt(iso) {
            var normalized = formatPollAfter(iso);
            if (!normalized) return;
            lastBotPollAt = normalized;
            try {
                var key = pollStorageKey();
                if (key && typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(key, normalized);
                }
            } catch (e) { /* ignore */ }
        }

        function lastBotMessageIdKey() {
            var vid = getVisitorId();
            if (!channelId || !vid) return null;
            return 'xbot_last_bot_msg_id_' + channelId + '_' + vid;
        }

        function saveLastBotMessageId(id) {
            if (!id) return;
            lastBotMessageId = String(id);
            try {
                var key = lastBotMessageIdKey();
                if (key && typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(key, lastBotMessageId);
                }
            } catch (e) { /* ignore */ }
        }

        function loadLastBotMessageId() {
            try {
                var key = lastBotMessageIdKey();
                if (!key || typeof sessionStorage === 'undefined') return null;
                return sessionStorage.getItem(key);
            } catch (e) {
                return null;
            }
        }

        function clearPendingTyping() {
            if (pendingTypingEl && pendingTypingEl.parentNode) {
                pendingTypingEl.parentNode.removeChild(pendingTypingEl);
            }
            pendingTypingEl = null;
        }

        function ingestBotPayload(item, content) {
            var body = (content || '').trim();
            if (!body) return;
            if (item && item.id && seenBotMessageKeys['id:' + item.id]) return;
            if (seenBotMessageKeys['c:' + body]) return;
            clearPendingTyping();
            appendMessage(body, 'bot');
            rememberBotMessage(item, body);
            if (item && item.id) saveLastBotMessageId(item.id);
        }

        function rememberBotMessage(item, content) {
            if (item && item.id) seenBotMessageKeys['id:' + item.id] = true;
            var body = (content || '').trim();
            if (body) seenBotMessageKeys['c:' + body] = true;
            if (item && item.created_at) saveLastBotPollAt(item.created_at);
        }

        function parseSseFrames(buffer) {
            var events = [];
            var parts = buffer.split('\n\n');
            var rest = parts.pop() || '';
            for (var i = 0; i < parts.length; i++) {
                var block = parts[i].trim();
                if (!block || block.indexOf(':') === 0) continue;
                var ev = 'message';
                var dataLines = [];
                block.split('\n').forEach(function (line) {
                    if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
                    else if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).trim());
                });
                events.push({ event: ev, data: dataLines.join('\n') });
            }
            return { events: events, rest: rest };
        }

        function stopBotPoll() {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }

        function stopXchatSse() {
            if (sseAbortController) {
                try { sseAbortController.abort(); } catch (e) { /* ignore */ }
                sseAbortController = null;
            }
            sseActive = false;
        }

        async function runXchatSse() {
            if (!apiBaseUrl || !channelId || typeof fetch === 'undefined') return;
            while (apiBaseUrl && channelId) {
                var vid = getVisitorId();
                if (!vid) return;
                var url = getStreamUrl()
                    + '?channel_id=' + encodeURIComponent(channelId)
                    + '&visitor_id=' + encodeURIComponent(vid);
                var lastId = lastBotMessageId || loadLastBotMessageId();
                if (lastId) url += '&last_message_id=' + encodeURIComponent(lastId);

                stopXchatSse();
                sseAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
                try {
                    var fetchOpts = {
                        headers: buildAuthHeaders({ Accept: 'text/event-stream' }),
                    };
                    if (sseAbortController) fetchOpts.signal = sseAbortController.signal;
                    var res = await fetch(url, fetchOpts);
                    if (!res.ok || !res.body || !res.body.getReader) {
                        throw new Error('sse_unavailable');
                    }
                    sseActive = true;
                    sseFailCount = 0;
                    stopBotPoll();

                    var reader = res.body.getReader();
                    var decoder = new TextDecoder();
                    var buffer = '';
                    while (true) {
                        var chunk = await reader.read();
                        if (chunk.done) break;
                        buffer += decoder.decode(chunk.value, { stream: true });
                        var parsed = parseSseFrames(buffer);
                        buffer = parsed.rest;
                        parsed.events.forEach(function (frame) {
                            if (frame.event === 'message' && frame.data) {
                                try {
                                    var payload = JSON.parse(frame.data);
                                    ingestBotPayload(payload, payload.content);
                                } catch (e) { /* ignore */ }
                            } else if (frame.event === 'timeout') {
                                throw new Error('sse_timeout');
                            }
                        });
                    }
                    throw new Error('sse_closed');
                } catch (err) {
                    sseActive = false;
                    if (err && err.name === 'AbortError') return;
                    sseFailCount += 1;
                    if (sseFailCount >= 2) startBotPoll();
                    await new Promise(function (r) { setTimeout(r, 1500); });
                }
            }
        }

        async function loadChatHistory() {
            if (!apiBaseUrl || !channelId) return;
            var vid = getVisitorId();
            if (!vid) return;
            var url = getHistoryUrl()
                + '?channel_id=' + encodeURIComponent(channelId)
                + '&visitor_id=' + encodeURIComponent(vid)
                + '&limit=50';
            try {
                var res = await fetch(url, { headers: buildAuthHeaders({}) });
                if (!res.ok) return;
                var data = await res.json();
                var list = data.messages || [];
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var body = (item.content || '').trim();
                    if (!body) continue;
                    if ((item.sender || 'bot') === 'user') {
                        appendMessage(body, 'user');
                    } else {
                        ingestBotPayload(item, body);
                    }
                }
            } catch (e) { /* ignore */ }
        }

        async function pollBotMessages() {
            if (!apiBaseUrl || !channelId) return;
            var vid = getVisitorId();
            if (!vid) return;
            var url = getMessagesPollUrl()
                + '?channel_id=' + encodeURIComponent(channelId)
                + '&visitor_id=' + encodeURIComponent(vid);
            var afterIso = formatPollAfter(lastBotPollAt);
            if (afterIso) {
                url += '&after=' + encodeURIComponent(afterIso);
            }
            try {
                var res = await fetch(url, { headers: buildAuthHeaders({}) });
                if (!res.ok) return;
                var data = await res.json();
                if (data.visitor_id && vid !== data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                var list = data.messages || [];
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var body = (item.content || '').trim();
                    if (!body) continue;
                    ingestBotPayload(item, body);
                }
            } catch (e) { /* poll silencioso */ }
        }

        function startBotPoll() {
            if (pollTimer || !apiBaseUrl || !channelId || sseActive) return;
            if (!lastBotPollAt) {
                lastBotPollAt = loadLastBotPollAt();
            }
            pollBotMessages();
            pollTimer = setInterval(pollBotMessages, XCHAT_POLL_MS);
        }
    
        const offset = offsetBottom || 20;

        function hexToRgb(hex) {
            var h = (hex || '#22c55e').replace('#', '').trim();
            if (h.length === 3) {
                h = h.split('').map(function (c) { return c + c; }).join('');
            }
            return {
                r: parseInt(h.slice(0, 2), 16) || 34,
                g: parseInt(h.slice(2, 4), 16) || 197,
                b: parseInt(h.slice(4, 6), 16) || 94,
            };
        }
        var rgb = hexToRgb(themeColor);
        var themeRgb = rgb.r + ', ' + rgb.g + ', ' + rgb.b;

        var XBOT_ICONS = {
            close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
            send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
            attach: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
            mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>',
            stop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
        };

        let unreadCount = 0;
        let welcomeShown = false;
        let pendingWelcomeText = null;
        let welcomeTeaserEl = null;

        function getWelcomeText() {
            var cfg = window.__xbotConfig || config || {};
            var raw = cfg.welcomeMessage;
            if (raw == null || raw === '') return '';
            return String(raw).trim();
        }

        function welcomeSessionKey() {
            return channelId ? 'xbot_welcome_delivered_' + channelId : 'xbot_welcome_delivered';
        }

        function wasWelcomeDeliveredThisSession() {
            try {
                return typeof sessionStorage !== 'undefined' &&
                    sessionStorage.getItem(welcomeSessionKey()) === '1';
            } catch (e) {
                return false;
            }
        }

        function markWelcomeDeliveredThisSession() {
            try {
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(welcomeSessionKey(), '1');
                }
            } catch (e) { /* ignore */ }
        }

        function clearWelcomeAlertUi() {
            launcher.classList.remove('has-welcome-alert');
            hideWelcomeTeaser();
        }

        function hideWelcomeTeaser() {
            if (!welcomeTeaserEl || !welcomeTeaserEl.parentNode) return;
            welcomeTeaserEl.style.animation = 'xbotTeaserOut 0.22s ease forwards';
            var el = welcomeTeaserEl;
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 220);
            welcomeTeaserEl = null;
        }

        function showWelcomeTeaser(text) {
            hideWelcomeTeaser();
            var teaser = document.createElement('button');
            teaser.type = 'button';
            teaser.className = 'xbot-welcome-teaser xbot-root';
            teaser.setAttribute('aria-label', 'Abrir mensagem de boas-vindas');

            var headWrap = document.createElement('div');
            headWrap.className = 'xbot-welcome-teaser__head';
            if (botAvatar) {
                var img = document.createElement('img');
                img.className = 'xbot-welcome-teaser__avatar';
                img.src = botAvatar;
                img.alt = '';
                headWrap.appendChild(img);
            }
            var nameEl = document.createElement('span');
            nameEl.className = 'xbot-welcome-teaser__name';
            nameEl.textContent = botName;
            headWrap.appendChild(nameEl);
            teaser.appendChild(headWrap);

            var plain = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            var body = document.createElement('p');
            body.className = 'xbot-welcome-teaser__text';
            body.textContent = plain.length > 160 ? plain.slice(0, 157) + '…' : plain;
            teaser.appendChild(body);

            var cta = document.createElement('span');
            cta.className = 'xbot-welcome-teaser__cta';
            cta.textContent = 'Toque para responder';
            teaser.appendChild(cta);

            teaser.addEventListener('click', function () {
                setChatOpen(true);
            });

            document.body.appendChild(teaser);
            welcomeTeaserEl = teaser;
        }

        function notifyWelcomeArrival() {
            launcher.classList.add('has-welcome-alert');
            unreadCount = Math.max(unreadCount, 1);
            notification.textContent = String(unreadCount);
            notification.style.display = 'flex';
            notificationSound.play().catch(function () {});
        }

        function deliverWelcomeOnPageLoad() {
            if (welcomeShown || wasWelcomeDeliveredThisSession()) return;
            var text = getWelcomeText();
            if (!text) return;
            if (chatbox.style.display === 'flex') return;

            pendingWelcomeText = text;
            markWelcomeDeliveredThisSession();
            showWelcomeTeaser(text);
            notifyWelcomeArrival();
        }

        const posH = position === 'left' ? 'left' : 'right';

        const style = document.createElement('style');
        style.innerHTML = `
            .xbot-root, .xbot-root * { box-sizing: border-box; }
            .xbot-launcher {
                position: fixed;
                bottom: ${offset}px;
                ${posH}: 20px;
                width: 64px;
                height: 64px;
                padding: 0;
                border: 3px solid #fff;
                border-radius: 50%;
                cursor: pointer;
                z-index: 2147483000;
                background: ${themeColor};
                box-shadow: 0 12px 40px rgba(15, 23, 42, 0.28), 0 0 0 6px rgba(${themeRgb}, 0.22);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: visible;
            }
            .xbot-launcher:hover { transform: scale(1.06); }
            .xbot-launcher__face {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
            .xbot-launcher__close {
                display: none;
                color: #fff;
                align-items: center;
                justify-content: center;
            }
            .xbot-launcher.is-open {
                background: #0f172a;
                box-shadow: 0 12px 40px rgba(15, 23, 42, 0.35), 0 0 0 6px rgba(${themeRgb}, 0.15);
            }
            .xbot-launcher.is-open .xbot-launcher__face { display: none; }
            .xbot-launcher.is-open .xbot-launcher__close { display: flex; }

            .xbot-notification {
                position: absolute;
                top: -4px;
                right: -4px;
                min-width: 20px;
                height: 20px;
                padding: 0 6px;
                background: #ef4444;
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                border-radius: 999px;
                border: 2px solid #fff;
                display: none;
                align-items: center;
                justify-content: center;
                font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                animation: xbotBadgePop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
            }
            @keyframes xbotBadgePop {
                0% { transform: scale(0); opacity: 0; }
                70% { transform: scale(1.15); }
                100% { transform: scale(1); opacity: 1; }
            }

            .xbot-launcher.has-welcome-alert {
                animation: xbotLauncherPulse 1.8s ease-in-out infinite;
            }
            .xbot-launcher.has-welcome-alert::before {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 50%;
                border: 2px solid rgba(${themeRgb}, 0.65);
                animation: xbotLauncherRing 1.8s ease-out infinite;
                pointer-events: none;
            }
            @keyframes xbotLauncherPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 12px 40px rgba(15, 23, 42, 0.28), 0 0 0 6px rgba(${themeRgb}, 0.22); }
                50% { transform: scale(1.07); box-shadow: 0 16px 48px rgba(15, 23, 42, 0.32), 0 0 0 10px rgba(${themeRgb}, 0.35); }
            }
            @keyframes xbotLauncherRing {
                0% { transform: scale(0.92); opacity: 0.85; }
                100% { transform: scale(1.35); opacity: 0; }
            }

            .xbot-welcome-teaser {
                position: fixed;
                bottom: ${offset + 8}px;
                ${posH}: 96px;
                max-width: min(280px, calc(100vw - 120px));
                padding: 12px 14px;
                background: #fff;
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: 16px;
                border-bottom-${posH === 'left' ? 'right' : 'left'}-radius: 6px;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
                z-index: 2147482998;
                cursor: pointer;
                font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                opacity: 0;
                transform: translateY(10px) scale(0.96);
                animation: xbotTeaserIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            .xbot-welcome-teaser::after {
                content: '';
                position: absolute;
                bottom: 18px;
                ${posH === 'left' ? 'left' : 'right'}: -7px;
                width: 14px;
                height: 14px;
                background: #fff;
                border-right: 1px solid rgba(15, 23, 42, 0.08);
                border-bottom: 1px solid rgba(15, 23, 42, 0.08);
                transform: rotate(-45deg);
            }
            .xbot-welcome-teaser__head {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }
            .xbot-welcome-teaser__avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
                background: #e2e8f0;
                flex-shrink: 0;
            }
            .xbot-welcome-teaser__name {
                font-size: 13px;
                font-weight: 600;
                color: #0f172a;
            }
            .xbot-welcome-teaser__text {
                font-size: 13px;
                line-height: 1.45;
                color: #475569;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .xbot-welcome-teaser__cta {
                margin-top: 8px;
                font-size: 11px;
                font-weight: 600;
                color: ${themeColor};
            }
            @keyframes xbotTeaserIn {
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes xbotTeaserOut {
                to { opacity: 0; transform: translateY(8px) scale(0.96); }
            }

            .xbot-chatbox {
                position: fixed;
                bottom: ${offset + 84}px;
                ${posH}: 20px;
                width: 380px;
                max-width: calc(100vw - 24px);
                height: min(560px, calc(100vh - ${offset + 100}px));
                background: #fff;
                border-radius: 20px;
                border: 1px solid rgba(15, 23, 42, 0.08);
                box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.04);
                display: none;
                flex-direction: column;
                overflow: hidden;
                z-index: 2147482999;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                animation: xbotSlideIn 0.28s ease;
            }
            @keyframes xbotSlideIn {
                from { opacity: 0; transform: translateY(12px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .xbot-header {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #fff;
                padding: 14px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 3px solid ${themeColor};
                flex-shrink: 0;
            }
            .xbot-header img {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                object-fit: cover;
                border: 2px solid rgba(255,255,255,0.15);
            }
            .xbot-header-text { flex: 1; min-width: 0; }
            .xbot-header-name {
                display: block;
                font-size: 15px;
                font-weight: 600;
                letter-spacing: -0.02em;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .xbot-header-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: rgba(255,255,255,0.72);
                margin-top: 2px;
            }
            .xbot-status-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.35);
            }
            .xbot-header-minimize {
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 10px;
                background: rgba(255,255,255,0.08);
                color: #fff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s;
            }
            .xbot-header-minimize:hover { background: rgba(255,255,255,0.16); }

            .xbot-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
                scroll-behavior: smooth;
                background: linear-gradient(180deg, #f8fafc 0%, #fff 48px);
            }

            .xbot-message-row {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                max-width: 92%;
            }
            .xbot-message-row.user { align-self: flex-end; flex-direction: row-reverse; }
            .xbot-message-row.bot { align-self: flex-start; }
            .xbot-msg-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                background: #e2e8f0;
            }

            .xbot-message {
                padding: 10px 14px;
                border-radius: 16px;
                font-size: 14px;
                line-height: 1.45;
                opacity: 0;
                transform: translateY(8px);
                animation: xbotFadeIn 0.28s ease forwards;
            }
            @keyframes xbotFadeIn {
                to { opacity: 1; transform: translateY(0); }
            }
            .xbot-message.user {
                background: rgba(${themeRgb}, 0.12);
                border: 1px solid rgba(${themeRgb}, 0.22);
                color: #0f172a;
                border-bottom-right-radius: 4px;
            }
            .xbot-message.bot {
                background: #fff;
                border: 1px solid #e2e8f0;
                color: #334155;
                border-bottom-left-radius: 4px;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
            }
            .xbot-message-content {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .xbot-message.user .xbot-message-content { align-items: flex-end; }
            .xbot-text { display: block; word-wrap: break-word; }
            .xbot-text p { margin: 0 0 0.35em; }
            .xbot-text p:last-child { margin-bottom: 0; }
            .xbot-time {
                font-size: 10px;
                color: #94a3b8;
            }
            .xbot-message a {
                color: ${themeColor};
                font-weight: 500;
                text-decoration: none;
                border-bottom: 1px solid rgba(${themeRgb}, 0.4);
            }
            .xbot-message a:hover { opacity: 0.85; }

            .xbot-typing {
                font-size: 12px;
                color: #64748b;
                padding: 4px 8px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .xbot-typing-dots span {
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: ${themeColor};
                display: inline-block;
                animation: xbotDot 1.2s infinite ease-in-out;
            }
            .xbot-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
            .xbot-typing-dots span:nth-child(3) { animation-delay: 0.3s; }
            @keyframes xbotDot {
                0%, 80%, 100% { opacity: 0.35; transform: scale(0.85); }
                40% { opacity: 1; transform: scale(1); }
            }

            .xbot-compose {
                padding: 12px 14px 10px;
                border-top: 1px solid #e2e8f0;
                background: #fff;
                flex-shrink: 0;
            }
            .xbot-compose-inner {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                padding: 6px 6px 6px 10px;
                transition: border-color 0.15s, box-shadow 0.15s;
            }
            .xbot-compose-inner:focus-within {
                border-color: rgba(${themeRgb}, 0.55);
                box-shadow: 0 0 0 3px rgba(${themeRgb}, 0.12);
                background: #fff;
            }
            .xbot-compose-tools {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding-bottom: 2px;
            }
            .xbot-icon-btn {
                width: 32px;
                height: 32px;
                border: none;
                border-radius: 8px;
                background: transparent;
                color: #64748b;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s;
            }
            .xbot-icon-btn:hover {
                background: rgba(15, 23, 42, 0.06);
                color: #0f172a;
            }
            .xbot-icon-btn.is-recording {
                color: #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }
            .xbot-input {
                flex: 1;
                border: none;
                background: transparent;
                padding: 8px 4px;
                font-size: 14px;
                line-height: 1.45;
                resize: none;
                max-height: 120px;
                outline: none;
                font-family: inherit;
                color: #0f172a;
            }
            .xbot-input::placeholder { color: #94a3b8; }
            .xbot-send {
                width: 40px;
                height: 40px;
                flex-shrink: 0;
                border: none;
                border-radius: 12px;
                background: ${themeColor};
                color: #fff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.15s, filter 0.15s;
            }
            .xbot-send:hover { filter: brightness(1.06); transform: scale(1.04); }
            .xbot-send:active { transform: scale(0.96); }

            .xbot-footer {
                padding: 6px 14px 12px;
                text-align: center;
                background: #fff;
                flex-shrink: 0;
            }
            .xbot-powered {
                font-size: 11px;
                color: #94a3b8;
                text-decoration: none;
                letter-spacing: 0.02em;
            }
            .xbot-powered strong {
                color: #0f172a;
                font-weight: 600;
            }
            .xbot-powered:hover strong { color: ${themeColor}; }

            @media screen and (max-width: 600px) {
                .xbot-chatbox {
                    width: 100vw;
                    max-width: 100vw;
                    height: 100vh;
                    bottom: 0 !important;
                    ${posH}: 0 !important;
                    border-radius: 0;
                }
                .xbot-launcher { bottom: 16px; ${posH}: 16px; }
            }
        `;

        document.head.appendChild(style);
    
        const launcher = document.createElement('button');
        launcher.className = 'xbot-launcher xbot-root';
        launcher.type = 'button';
        launcher.setAttribute('aria-label', 'Abrir chat');
        launcher.innerHTML =
            '<span class="xbot-launcher__face"></span>' +
            '<span class="xbot-launcher__close">' + XBOT_ICONS.close + '</span>';
        launcher.querySelector('.xbot-launcher__face').style.backgroundImage =
            "url('" + launcherIcon.replace(/'/g, "%27") + "')";

        const notification = document.createElement('div');
        notification.className = 'xbot-notification';
        notification.textContent = '1';
        launcher.appendChild(notification);

        const chatbox = document.createElement('div');
        chatbox.className = 'xbot-chatbox xbot-root';
        chatbox.style.display = 'none';
        chatbox.innerHTML =
            '<div class="xbot-header">' +
            (botAvatar ? '<img src="' + botAvatar + '" alt="" />' : '') +
            '<div class="xbot-header-text">' +
            '<span class="xbot-header-name"></span>' +
            '<span class="xbot-header-status"><span class="xbot-status-dot"></span>Online agora</span>' +
            '</div>' +
            '<button type="button" class="xbot-header-minimize" aria-label="Minimizar">' +
            XBOT_ICONS.close +
            '</button></div>' +
            '<div class="xbot-messages" id="xbot-messages"></div>' +
            '<div class="xbot-compose">' +
            '<div class="xbot-compose-inner">' +
            '<div class="xbot-compose-tools">' +
            '<button type="button" class="xbot-icon-btn" id="xbot-upload" aria-label="Anexar arquivo">' +
            XBOT_ICONS.attach +
            '</button>' +
            '<button type="button" class="xbot-icon-btn" id="xbot-audio" aria-label="Gravar áudio">' +
            XBOT_ICONS.mic +
            '</button></div>' +
            '<textarea class="xbot-input" id="xbot-input" placeholder="Escreva sua mensagem…" rows="1"></textarea>' +
            '<button type="button" class="xbot-send" id="xbot-send" aria-label="Enviar">' +
            XBOT_ICONS.send +
            '</button></div></div>' +
            '<div class="xbot-footer">' +
            '<a class="xbot-powered" href="https://www.xbotone.com" target="_blank" rel="noopener noreferrer">' +
            'Powered by <strong>XBot</strong></a></div>';

        chatbox.querySelector('.xbot-header-name').textContent = botName;

        document.body.appendChild(launcher);
        document.body.appendChild(chatbox);

        function setChatOpen(open) {
            chatbox.style.display = open ? 'flex' : 'none';
            chatbox.style.flexDirection = 'column';
            launcher.classList.toggle('is-open', open);
            launcher.setAttribute('aria-label', open ? 'Fechar chat' : 'Abrir chat');
            if (open) {
                unreadCount = 0;
                notification.style.display = 'none';
                clearWelcomeAlertUi();
                if (!welcomeShown) {
                    var welcomeText = pendingWelcomeText || getWelcomeText();
                    if (welcomeText) {
                        appendMessage(welcomeText, 'bot');
                        rememberBotMessage(null, welcomeText);
                        welcomeShown = true;
                        pendingWelcomeText = null;
                    }
                }
                input.focus();
            }
        }

        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });

        launcher.addEventListener('click', function () {
            setChatOpen(chatbox.style.display !== 'flex');
        });

        chatbox.querySelector('.xbot-header-minimize').addEventListener('click', function () {
            setChatOpen(false);
        });

        const uploadBtn = document.getElementById('xbot-upload');
        const audioBtn = document.getElementById('xbot-audio');
        const input = document.getElementById('xbot-input');
        const messages = document.getElementById('xbot-messages');

        const send = chatbox.querySelector('#xbot-send');
        send.addEventListener('click', handleSendMessage);

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        input.addEventListener('input', function () {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        function appendMessage(text, from = 'user') {
            const row = document.createElement('div');
            row.className = `xbot-message-row ${from}`;
            const avatarUrl = from === 'user' ? userAvatar : botAvatar;
            if (avatarUrl) {
              const av = document.createElement('img');
              av.className = 'xbot-msg-avatar';
              av.src = avatarUrl;
              av.alt = '';
              row.appendChild(av);
            }
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
            row.appendChild(msg);
            messages.appendChild(row);
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
            typing.innerHTML = botName + ' está digitando <span class="xbot-typing-dots"><span></span><span></span><span></span></span>';
            messages.appendChild(typing);
            messages.scrollTop = messages.scrollHeight;
            pendingTypingEl = typing;
          
            try {
                const visitorId = getVisitorId();
                const msgBody = { message: text };
                if (visitorId) msgBody.visitor_id = visitorId;
                if (channelId) msgBody.channel_id = channelId;
                const response = await fetch(getMessageUrl(), {
                    method: 'POST',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(msgBody)
                });
                const data = await response.json();
                if (data.visitor_id && visitorId !== data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                if (data.reply) {
                    var replyText = String(data.reply).trim();
                    if (replyText) ingestBotPayload(null, replyText);
                    else clearPendingTyping();
                } else {
                    setTimeout(function () { clearPendingTyping(); }, 25000);
                }

            } catch (err) {
                clearPendingTyping();
                var errText = 'Não foi possível enviar sua mensagem. Verifique seu **token** e tente novamente. Caso precise de ajuda estamos *[aqui](https://xbot.digital/suporte)* para auxilia-lo..';
                appendMessage(errText, 'bot');
                rememberBotMessage(null, errText);
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
            preview.textContent = 'Anexo: ' + file.name;
            }
            messages.appendChild(preview);
            messages.scrollTop = messages.scrollHeight;
        
            try {
            if (window.__xbotConfig.channelId) {
                formData.append('channel_id', window.__xbotConfig.channelId);
            }
            const res = await fetch(getUploadUrl(), {
                method: 'POST',
                headers: buildAuthHeaders({}),
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
            audioBtn.classList.remove('is-recording');
            audioBtn.innerHTML = XBOT_ICONS.mic;
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
                if (window.__xbotConfig.channelId) {
                    formData.append('channel_id', window.__xbotConfig.channelId);
                }
                const res = await fetch(getUploadUrl(), {
                    method: 'POST',
                    headers: buildAuthHeaders({}),
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
            audioBtn.classList.add('is-recording');
            audioBtn.innerHTML = XBOT_ICONS.stop;
            } catch (err) {
            alert('Erro ao iniciar gravação de áudio.');
            }
        });

        setTimeout(function () {
            deliverWelcomeOnPageLoad();
        }, 500);

        lastBotMessageId = loadLastBotMessageId();
        loadChatHistory().finally(function () {
            runXchatSse();
            setTimeout(function () {
                if (!sseActive) startBotPoll();
            }, 2500);
        });
        
    });


  })();

 