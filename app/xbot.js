(function () {

    var XBOT_WIDGET_VERSION = '__XBOT_WIDGET_VERSION__';
    window.__XBOT_WIDGET_VERSION = XBOT_WIDGET_VERSION;

    var XBOT_DEFAULT_ASSETS_BASE =
      'https://app.xbotone.com';
    var XBOT_WORKFORCE_ICON_KEYS = ['bb8', 'obiwan', 'threepio', 'r2d2'];

    function xbotDefaultAssetUrl(file) {
      if (file === 'user-avatar.svg') {
        return XBOT_DEFAULT_ASSETS_BASE + '/xchat-defaults/' + file;
      }
      return XBOT_DEFAULT_ASSETS_BASE + '/workforce/' + file;
    }

    function xbotWorkforceIconKey(channelId) {
      if (!channelId) return 'bb8';
      var hex = String(channelId).replace(/-/g, '').slice(0, 8);
      var n = parseInt(hex, 16);
      if (isNaN(n)) return 'bb8';
      return XBOT_WORKFORCE_ICON_KEYS[n % XBOT_WORKFORCE_ICON_KEYS.length];
    }

    function xbotWorkforceAssetUrl(iconKey) {
      var key = iconKey || 'bb8';
      if (XBOT_WORKFORCE_ICON_KEYS.indexOf(key) < 0) key = 'bb8';
      return XBOT_DEFAULT_ASSETS_BASE + '/workforce/' + key + '.svg';
    }

    function applyXbotAssetDefaults(cfg) {
      cfg = cfg || {};
      var launcher = (cfg.launcherIcon || '').trim();
      var bot = (cfg.botAvatar || '').trim();
      var user = (cfg.userAvatar || '').trim();
      var workforceKey = xbotWorkforceIconKey(cfg.channelId);
      var workforceUrl = xbotWorkforceAssetUrl(workforceKey);
      return Object.assign({}, cfg, {
        launcherIcon: launcher || workforceUrl,
        botAvatar: bot || workforceUrl,
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
                (data.welcome_message != null && String(data.welcome_message).trim())
                  ? data.welcome_message
                  : cfg.welcomeMessage,
              launcherIcon: data.launcher_icon_url || cfg.launcherIcon,
              position: data.position || cfg.position,
              offsetBottom:
                data.offset_bottom != null ? data.offset_bottom : cfg.offsetBottom,
              botReplyEnabled:
                typeof data.bot_reply_enabled === 'boolean'
                  ? data.bot_reply_enabled
                  : cfg.botReplyEnabled,
            })
          );
        })
        .catch(function () {
          window.__xbotConfig = applyXbotAssetDefaults(window.__xbotConfig || {});
        });
    }

    function widgetLog() {
      if (typeof console === 'undefined' || !console.log) return;
      var args = ['[XBot Widget ' + XBOT_WIDGET_VERSION + ']'];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.log.apply(console, args);
    }

    window.initXBot = function (config) {
      config = config || {};
      window.__xbotConfig = applyXbotAssetDefaults(config);
      window.__xbotAppearanceReady = false;
      widgetLog(
        'init',
        {
          channelId: config.channelId || null,
          apiBaseUrl: config.apiBaseUrl || null,
          hasClientId: !!(config.clientId && String(config.clientId).trim()),
        }
      );
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

        function getSessionStatusUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/session-status';
        }

        function getKeepAliveUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/keep-alive';
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
        var sessionStatusTimer = null;
        var SESSION_STATUS_POLL_MS = 2000;
        var keepAliveInFlight = false;
        var inactivityBar = null;
        var inactivityCountdownEl = null;
        var inactivityKeepBtn = null;

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

        var sessionEndedNoticeShown = false;
        var sessionEpisodeEnded = false;
        var closureNoticeRendered = false;

        function isSessionClosurePayload(item, body) {
            var meta = (item && item.metadata && typeof item.metadata === 'object') ? item.metadata : {};
            if (meta.session_closed) return true;
            var text = (body || '').trim();
            return text.indexOf('Sua conversa foi encerrada') === 0;
        }

        function resetXchatEpisodeLocalState(clearUi) {
            lastBotPollAt = null;
            lastBotMessageId = null;
            seenBotMessageKeys = {};
            closureNoticeRendered = false;
            try {
                var pollKey = pollStorageKey();
                var msgKey = lastBotMessageIdKey();
                if (typeof sessionStorage !== 'undefined') {
                    if (pollKey) sessionStorage.removeItem(pollKey);
                    if (msgKey) sessionStorage.removeItem(msgKey);
                }
            } catch (e) { /* ignore */ }
            if (clearUi) {
                var container = document.getElementById('xbot-messages');
                if (container) {
                    container.innerHTML = '';
                    sessionEndedNoticeShown = false;
                }
            }
        }

        function pauseRealtimeTransportAfterClosure() {
            stopBotPoll();
            stopXchatSse();
            stopSessionStatusPoll();
        }

        function finalizeSessionEndedState() {
            sessionEpisodeEnded = true;
            sessionEndedNoticeShown = true;
            closureNoticeRendered = true;
            pauseRealtimeTransportAfterClosure();
        }

        function resumeRealtimeAfterUserSend() {
            sessionEpisodeEnded = false;
            closureNoticeRendered = false;
            sessionEndedNoticeShown = false;
            if (!pollTimer) startBotPoll();
            if (!sseActive && !sseAbortController) runXchatSse();
        }

        function beginNewEpisodeFromUserMessage() {
            if (!sessionEpisodeEnded && !closureNoticeRendered) return;
            resetXchatEpisodeLocalState(true);
            sessionEpisodeEnded = false;
            sessionEndedNoticeShown = false;
            closureNoticeRendered = false;
            welcomeShown = false;
            startSessionStatusPoll();
        }

        function formatInactivityCountdown(totalSec) {
            var sec = Math.max(0, parseInt(totalSec, 10) || 0);
            var m = Math.floor(sec / 60);
            var s = sec % 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        function updateInactivityBarUI(status) {
            if (!inactivityBar) return;
            if (!status || !status.inactivity_enabled) {
                inactivityBar.hidden = true;
                return;
            }
            if (!status.session_active) {
                inactivityBar.hidden = true;
                handleSessionExpiredByInactivity();
                return;
            }
            var sec = status.seconds_until_close;
            var threshold = status.warning_threshold_seconds || 60;
            if (sec == null || sec > threshold) {
                inactivityBar.hidden = true;
                return;
            }
            if (sec <= 0) {
                inactivityBar.hidden = true;
                handleSessionExpiredByInactivity();
                return;
            }
            inactivityBar.hidden = false;
            if (inactivityCountdownEl) {
                inactivityCountdownEl.textContent = formatInactivityCountdown(sec);
            }
        }

        function handleSessionExpiredByInactivity() {
            if (sessionEpisodeEnded && closureNoticeRendered) return;
            sessionEpisodeEnded = true;
            welcomeShown = false;
            lastBotMessageId = null;
            try {
                var msgKey = lastBotMessageIdKey();
                if (msgKey && typeof sessionStorage !== 'undefined') sessionStorage.removeItem(msgKey);
            } catch (e) { /* ignore */ }
            if (!closureNoticeRendered) {
                pollBotMessages();
            } else {
                finalizeSessionEndedState();
            }
        }

        async function pollSessionInactivity() {
            if (!apiBaseUrl || !channelId || chatbox.style.display !== 'flex') return;
            var vid = getVisitorId();
            if (!vid) return;
            var url =
                getSessionStatusUrl() +
                '?channel_id=' +
                encodeURIComponent(channelId) +
                '&visitor_id=' +
                encodeURIComponent(vid);
            try {
                var res = await fetch(url, { headers: buildAuthHeaders({}) });
                if (!res.ok) return;
                var status = await res.json();
                updateInactivityBarUI(status);
            } catch (e) {
                widgetLog('session-status erro', e && e.message);
            }
        }

        function startSessionStatusPoll() {
            stopSessionStatusPoll();
            if (!apiBaseUrl || !channelId) return;
            pollSessionInactivity();
            sessionStatusTimer = setInterval(pollSessionInactivity, SESSION_STATUS_POLL_MS);
        }

        function stopSessionStatusPoll() {
            if (sessionStatusTimer) {
                clearInterval(sessionStatusTimer);
                sessionStatusTimer = null;
            }
            if (inactivityBar) inactivityBar.hidden = true;
        }

        async function keepSessionAlive() {
            if (keepAliveInFlight || !apiBaseUrl || !channelId) return;
            var vid = getVisitorId();
            if (!vid) return;
            keepAliveInFlight = true;
            if (inactivityKeepBtn) {
                inactivityKeepBtn.disabled = true;
                inactivityKeepBtn.textContent = 'Renovando…';
            }
            try {
                var res = await fetch(getKeepAliveUrl(), {
                    method: 'POST',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        visitor_id: vid,
                        channel_id: channelId,
                    }),
                });
                if (!res.ok) {
                    widgetLog('keep-alive falhou', { status: res.status });
                    return;
                }
                var status = await res.json();
                updateInactivityBarUI(status);
                widgetLog('sessão renovada', { seconds_until_close: status.seconds_until_close });
            } catch (e) {
                widgetLog('keep-alive erro', e && e.message);
            } finally {
                keepAliveInFlight = false;
                if (inactivityKeepBtn) {
                    inactivityKeepBtn.disabled = false;
                    inactivityKeepBtn.textContent = 'Manter conversa ativa';
                }
            }
        }

        var pendingSendCount = 0;

        function clearPendingTyping() {
            // Remove TODOS os indicadores de "digitando" (envios rápidos podem criar mais de um).
            var container = document.getElementById('xbot-messages');
            if (container && container.querySelectorAll) {
                var nodes = container.querySelectorAll('.xbot-typing');
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
                }
            } else if (pendingTypingEl && pendingTypingEl.parentNode) {
                pendingTypingEl.parentNode.removeChild(pendingTypingEl);
            }
            pendingTypingEl = null;
        }

        // Move o indicador existente para o final (sem piscar) ou cria um novo se não existir.
        function _moveOrShowTyping() {
            var container = document.getElementById('xbot-messages');
            if (!container) return;
            // Remover duplicatas espúrias (nunca deve haver mais de um)
            var all = container.querySelectorAll ? container.querySelectorAll('.xbot-typing') : [];
            for (var i = 0; i < all.length; i++) {
                if (all[i] !== pendingTypingEl && all[i].parentNode) all[i].parentNode.removeChild(all[i]);
            }
            if (pendingTypingEl && pendingTypingEl.parentNode) {
                container.appendChild(pendingTypingEl); // reposiciona no final
            } else {
                var el = document.createElement('div');
                el.className = 'xbot-typing';
                el.innerHTML = botName + ' está digitando <span class="xbot-typing-dots"><span></span><span></span><span></span></span>';
                container.appendChild(el);
                pendingTypingEl = el;
            }
            container.scrollTop = container.scrollHeight;
        }

        function ingestBotPayload(item, content, source) {
            var body = (content || '').trim();
            var meta = (item && item.metadata && typeof item.metadata === 'object') ? item.metadata : {};
            var ct = (item && item.content_type ? String(item.content_type) : 'text').toLowerCase();
            var mediaUrl = meta.media_url || '';
            var isMedia = !!mediaUrl && (ct === 'image' || ct === 'file' || ct === 'video' || ct === 'audio');
            if (!body && !isMedia) return;
            if (sessionEpisodeEnded && source !== 'history' && !meta.session_closed) return;
            if (item && item.id && seenBotMessageKeys['id:' + item.id]) return;
            var dedupKey = isMedia ? ('media:' + mediaUrl + '|' + body) : body;
            if (seenBotMessageKeys['c:' + dedupKey]) return;
            if (isSessionClosurePayload(item, body)) {
                if (closureNoticeRendered || pendingSendCount > 0) return;
            }
            if (meta.session_closed || isSessionClosurePayload(item, body)) {
                finalizeSessionEndedState();
            }
            clearPendingTyping();
            if (isMedia) {
                appendBotMedia(ct, mediaUrl, body, meta, { countUnread: source !== 'history' });
            } else {
                appendMessage(body, 'bot', { countUnread: source !== 'history' });
            }
            rememberBotMessage(item, dedupKey);
            if (item && item.id) saveLastBotMessageId(item.id);
            widgetLog('mensagem recebida', { via: source || 'unknown', id: item && item.id, tipo: ct, len: body.length });
        }

        function _escHtml(s) {
            return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        // Renderiza mensagem do bot com mídia (imagem do produto, arquivo, etc.)
        function appendBotMedia(ct, url, caption, meta, opts) {
            var cap = (caption || '').trim();
            if (ct === 'image') {
                var lines = cap ? cap.split('\n') : [];
                // Constrói DOM diretamente para poder anexar onerror —
                // DOMPurify remove event handlers de strings HTML (onerror seria stripped).
                var row = document.createElement('div');
                row.className = 'xbot-message-row bot';
                if (botAvatar) {
                    var av = document.createElement('img');
                    av.className = 'xbot-msg-avatar';
                    av.src = botAvatar;
                    av.alt = '';
                    row.appendChild(av);
                }
                var msgDiv = document.createElement('div');
                msgDiv.className = 'xbot-message bot';
                var contentDiv = document.createElement('div');
                contentDiv.className = 'xbot-message-content';
                var textDiv = document.createElement('div');
                textDiv.className = 'xbot-text';
                // Imagem com onerror: se a URL (ex: presigned S3) falhar, esconde silenciosamente
                var img = document.createElement('img');
                img.src = url;
                img.alt = lines[0] || 'imagem';
                img.loading = 'lazy';
                img.style.cssText = 'max-width:100%;height:auto;border-radius:12px;display:block;margin:2px 0 6px';
                img.onerror = function() { this.style.display = 'none'; };
                textDiv.appendChild(img);
                if (lines.length > 0) {
                    var p1 = document.createElement('p');
                    p1.style.margin = '2px 0 0';
                    var strong = document.createElement('strong');
                    strong.textContent = lines[0];
                    p1.appendChild(strong);
                    textDiv.appendChild(p1);
                }
                if (lines.length > 1) {
                    var p2 = document.createElement('p');
                    // pre-line preserva as quebras de linha do bloco de descrição (desc + variações)
                    p2.style.cssText = 'margin:2px 0 0;white-space:pre-line';
                    p2.textContent = lines.slice(1).join('\n');
                    textDiv.appendChild(p2);
                }
                var timeDiv = document.createElement('div');
                timeDiv.className = 'xbot-time';
                timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                contentDiv.appendChild(textDiv);
                contentDiv.appendChild(timeDiv);
                msgDiv.appendChild(contentDiv);
                row.appendChild(msgDiv);
                messages.appendChild(row);
                scrollMessagesToBottom();
                var countUnread = !opts || opts.countUnread !== false;
                if (countUnread && chatbox.style.display === 'none') {
                    unreadCount++;
                    notification.textContent = String(unreadCount);
                    notification.style.display = 'flex';
                    notificationSound.play().catch(function() {});
                }
                return;
            } else if (ct === 'video') {
                var vlabel = cap || 'vídeo';
                var vhtml =
                    '<video controls playsinline preload="metadata" style="max-width:100%;border-radius:12px;margin:4px 0 8px">' +
                    '<source src="' + url.replace(/"/g, '&quot;') + '"></video>';
                if (cap) vhtml += '<p>' + cap.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
                appendMessage(vhtml, 'bot', Object.assign({}, opts, { rawHtml: true }));
            } else if (ct === 'audio') {
                var alabel = cap || 'áudio';
                var ahtml =
                    '<audio controls preload="metadata" style="max-width:100%;min-width:220px;margin:4px 0 8px">' +
                    '<source src="' + url.replace(/"/g, '&quot;') + '"></audio>';
                if (cap && cap.indexOf('🎵') !== 0) ahtml += '<p class="text-xs opacity-80 mt-1">' + cap.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
                appendMessage(ahtml, 'bot', Object.assign({}, opts, { rawHtml: true }));
            } else {
                var label = cap || (meta && meta.filename) || 'Arquivo';
                appendMessage('[📎 ' + label + '](' + url + ')', 'bot', opts);
            }
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
            if (sessionEpisodeEnded && closureNoticeRendered) return;
            while (apiBaseUrl && channelId) {
                if (sessionEpisodeEnded && closureNoticeRendered) break;
                var vid = getVisitorId();
                if (!vid) return;
                var url = getStreamUrl()
                    + '?channel_id=' + encodeURIComponent(channelId)
                    + '&visitor_id=' + encodeURIComponent(vid);
                if (sessionEpisodeEnded) {
                    var afterEnded = formatPollAfter(lastBotPollAt);
                    if (afterEnded) url += '&after=' + encodeURIComponent(afterEnded);
                } else {
                    var lastId = lastBotMessageId || loadLastBotMessageId();
                    if (lastId) url += '&last_message_id=' + encodeURIComponent(lastId);
                    var afterActive = formatPollAfter(lastBotPollAt);
                    if (afterActive) url += '&after=' + encodeURIComponent(afterActive);
                }

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
                    widgetLog('SSE conectado');

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
                            if (frame.event === 'connected' && frame.data) {
                                try {
                                    var conn = JSON.parse(frame.data);
                                    if (conn.session_active === false) {
                                        sessionEpisodeEnded = true;
                                        if (!closureNoticeRendered) {
                                            pollBotMessages();
                                        } else {
                                            finalizeSessionEndedState();
                                        }
                                    }
                                } catch (e) { /* ignore */ }
                            } else if (frame.event === 'message' && frame.data) {
                                try {
                                    var payload = JSON.parse(frame.data);
                                    ingestBotPayload(payload, payload.content, 'sse');
                                } catch (e) { /* ignore */ }
                            } else if (frame.event === 'timeout') {
                                widgetLog('SSE timeout — reconectando');
                                throw new Error('sse_timeout');
                            }
                        });
                    }
                    throw new Error('sse_closed');
                } catch (err) {
                    sseActive = false;
                    if (err && err.name === 'AbortError') return;
                    sseFailCount += 1;
                    widgetLog('SSE indisponível, usando poll', { erro: err && err.message, tentativa: sseFailCount });
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
                if (!res.ok) {
                    widgetLog('histórico falhou', { status: res.status });
                    return;
                }
                var data = await res.json();
                if (data.session_active === false) {
                    // Sessão anterior expirou: pageload recomeça com conversa limpa (welcome).
                    // O aviso de encerramento só aparece ao vivo, no momento da expiração.
                    resetXchatEpisodeLocalState(true);
                    sessionEpisodeEnded = false;
                    sessionEndedNoticeShown = false;
                    welcomeShown = false;
                    widgetLog('sessão anterior encerrada — conversa nova');
                    return;
                }
                sessionEndedNoticeShown = false;
                var list = data.messages || [];
                widgetLog('histórico carregado', { mensagens: list.length, session_active: data.session_active });
                // Histórico é a fonte única da render inicial: limpa o que estiver na tela e
                // reidrata, evitando duplicação/ordenação errada com o poll.
                var histContainer = document.getElementById('xbot-messages');
                if (histContainer) histContainer.innerHTML = '';
                seenBotMessageKeys = {};
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var body = (item.content || '').trim();
                    var histMeta = (item.metadata && typeof item.metadata === 'object') ? item.metadata : {};
                    var histMedia = histMeta.media_url || '';
                    if (!body && !histMedia) continue;
                    if ((item.sender || 'bot') === 'user') {
                        if (histMedia && String(item.content_type || '').toLowerCase() === 'image') {
                            appendMessage('![imagem](' + histMedia + ')' + (body ? '\n\n' + body : ''), 'user');
                        } else {
                            appendMessage(body, 'user');
                        }
                    } else {
                        ingestBotPayload(item, body, 'history');
                    }
                }
            } catch (e) {
                widgetLog('histórico erro', e && e.message);
            } finally {
                scheduleScrollMessagesToBottom();
            }
        }

        async function pollBotMessages() {
            if (sessionEpisodeEnded && closureNoticeRendered) return;
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
                if (!res.ok) {
                    widgetLog('poll falhou', { status: res.status, url: getMessagesPollUrl() });
                    return;
                }
                var data = await res.json();
                if (data.visitor_id && vid !== data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                var list = data.messages || [];
                if (list.length) widgetLog('poll', { novas: list.length });
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var body = (item.content || '').trim();
                    var hasMedia = item.metadata && typeof item.metadata === 'object' && item.metadata.media_url;
                    if (!body && !hasMedia) continue;
                    ingestBotPayload(item, body, 'poll');
                }
            } catch (e) {
                widgetLog('poll erro', e && e.message);
            }
        }

        function startBotPoll() {
            if (sessionEpisodeEnded && closureNoticeRendered) return;
            if (pollTimer || !apiBaseUrl || !channelId) return;
            if (!lastBotPollAt && !sessionEpisodeEnded) {
                lastBotPollAt = loadLastBotPollAt();
            }
            widgetLog('poll ativo (intervalo ' + XCHAT_POLL_MS + 'ms)');
            pollBotMessages();
            pollTimer = setInterval(pollBotMessages, XCHAT_POLL_MS);
        }
    
        const offset = offsetBottom || 20;
        const LAUNCHER_SIZE = 64;
        const LAUNCHER_GAP = 28;
        /** Base do painel acima do botão flutuante (launcher). */
        const chatboxStackBottom = offset + LAUNCHER_SIZE + LAUNCHER_GAP;
        const mobileLauncherOffset = 16;
        const mobileLauncherOpenSize = 44;
        const mobileStackBottom = mobileLauncherOffset + LAUNCHER_SIZE + LAUNCHER_GAP;
        const mobileOpenStackBottom = mobileLauncherOffset + mobileLauncherOpenSize + LAUNCHER_GAP;
        const MOBILE_LAYOUT_MQ = '(max-width: 600px)';

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
            /* Design tokens — base única de tema do widget (.xbot-root em launcher, teaser e chatbox) */
            .xbot-root {
                --xbot-theme: ${themeColor};
                --xbot-theme-rgb: ${themeRgb};
                --xbot-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                --xbot-ink: #0f172a;
                --xbot-text: #334155;
                --xbot-muted: #64748b;
                --xbot-subtle: #94a3b8;
                --xbot-surface: #fff;
                --xbot-surface-alt: #f8fafc;
                --xbot-field: #f1f5f9;
                --xbot-border: #e2e8f0;
                --xbot-border-soft: rgba(15, 23, 42, 0.08);
                --xbot-danger: #ef4444;
                --xbot-success: #22c55e;
                --xbot-warn-bg: linear-gradient(90deg, #fff7ed 0%, #ffedd5 100%);
                --xbot-warn-border: #fed7aa;
                --xbot-warn-text: #9a3412;
                --xbot-header-bg: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                --xbot-radius-xs: 8px;
                --xbot-radius-sm: 10px;
                --xbot-radius-md: 12px;
                --xbot-radius-lg: 16px;
                --xbot-radius-xl: 20px;
            }
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
                background: var(--xbot-theme);
                box-shadow: 0 12px 40px rgba(15, 23, 42, 0.28), 0 0 0 6px rgba(var(--xbot-theme-rgb), 0.22);
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
                width: 48px;
                height: 48px;
                background: var(--xbot-ink);
                border-width: 2px;
                box-shadow: 0 10px 28px rgba(15, 23, 42, 0.32), 0 0 0 4px rgba(var(--xbot-theme-rgb), 0.12);
            }
            .xbot-launcher.is-open:hover { transform: scale(1.04); }
            .xbot-launcher.is-open .xbot-launcher__face { display: none; }
            .xbot-launcher.is-open .xbot-launcher__close { display: flex; }
            .xbot-launcher.is-open .xbot-launcher__close svg {
                width: 16px;
                height: 16px;
            }
            html.xbot-chat-open {
                touch-action: manipulation;
                -webkit-text-size-adjust: 100%;
            }

            .xbot-notification {
                position: absolute;
                top: -4px;
                right: -4px;
                min-width: 20px;
                height: 20px;
                padding: 0 6px;
                background: var(--xbot-danger);
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                border-radius: 999px;
                border: 2px solid #fff;
                display: none;
                align-items: center;
                justify-content: center;
                font-family: var(--xbot-font);
                animation: xbotBadgePop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
            }
            @keyframes xbotBadgePop {
                0% { transform: scale(0); opacity: 0; }
                70% { transform: scale(1.15); }
                100% { transform: scale(1); opacity: 1; }
            }
            .xbot-launcher.is-open .xbot-notification {
                display: none !important;
            }

            .xbot-launcher.has-welcome-alert {
                animation: xbotLauncherPulse 1.8s ease-in-out infinite;
            }
            .xbot-launcher.has-welcome-alert::before {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 50%;
                border: 2px solid rgba(var(--xbot-theme-rgb), 0.65);
                animation: xbotLauncherRing 1.8s ease-out infinite;
                pointer-events: none;
            }
            @keyframes xbotLauncherPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 12px 40px rgba(15, 23, 42, 0.28), 0 0 0 6px rgba(var(--xbot-theme-rgb), 0.22); }
                50% { transform: scale(1.07); box-shadow: 0 16px 48px rgba(15, 23, 42, 0.32), 0 0 0 10px rgba(var(--xbot-theme-rgb), 0.35); }
            }
            @keyframes xbotLauncherRing {
                0% { transform: scale(0.92); opacity: 0.85; }
                100% { transform: scale(1.35); opacity: 0; }
            }

            .xbot-welcome-teaser {
                position: fixed;
                bottom: ${offset + LAUNCHER_SIZE + 12}px;
                ${posH}: 96px;
                max-width: min(280px, calc(100vw - 120px));
                padding: 12px 14px;
                background: var(--xbot-surface);
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: var(--xbot-radius-lg);
                border-bottom-${posH === 'left' ? 'right' : 'left'}-radius: 6px;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
                z-index: 2147482998;
                cursor: pointer;
                font-family: var(--xbot-font);
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
                background: var(--xbot-surface);
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
                background: var(--xbot-border);
                flex-shrink: 0;
            }
            .xbot-welcome-teaser__name {
                font-size: 13px;
                font-weight: 600;
                color: var(--xbot-ink);
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
                color: var(--xbot-theme);
            }
            @keyframes xbotTeaserIn {
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes xbotTeaserOut {
                to { opacity: 0; transform: translateY(8px) scale(0.96); }
            }

            .xbot-chatbox {
                position: fixed;
                bottom: ${chatboxStackBottom}px;
                ${posH}: 20px;
                width: 380px;
                max-width: calc(100vw - 24px);
                height: min(560px, calc(100vh - ${chatboxStackBottom + 16}px));
                background: var(--xbot-surface);
                border-radius: var(--xbot-radius-xl);
                border: 1px solid rgba(15, 23, 42, 0.08);
                box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.04);
                display: none;
                flex-direction: column;
                overflow: hidden;
                z-index: 2147482999;
                font-family: var(--xbot-font);
                animation: xbotSlideIn 0.28s ease;
            }
            @keyframes xbotSlideIn {
                from { opacity: 0; transform: translateY(12px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .xbot-header {
                background: var(--xbot-header-bg);
                color: #fff;
                padding: 14px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 3px solid var(--xbot-theme);
                flex-shrink: 0;
            }
            .xbot-header img {
                width: 40px;
                height: 40px;
                border-radius: var(--xbot-radius-md);
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
                background: var(--xbot-success);
                box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.35);
            }
            .xbot-header-minimize {
                width: 36px;
                height: 36px;
                border: none;
                border-radius: var(--xbot-radius-sm);
                background: rgba(255,255,255,0.08);
                color: #fff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s;
            }
            .xbot-header-minimize:hover { background: rgba(255,255,255,0.16); }

            .xbot-inactivity-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                flex-wrap: wrap;
                padding: 10px 14px;
                background: var(--xbot-warn-bg);
                border-bottom: 1px solid var(--xbot-warn-border);
                font-size: 12px;
                color: var(--xbot-warn-text);
                flex-shrink: 0;
            }
            .xbot-inactivity-bar[hidden] { display: none !important; }
            .xbot-inactivity-text {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1;
                min-width: 140px;
            }
            .xbot-inactivity-icon { font-size: 14px; }
            .xbot-inactivity-btn {
                border: none;
                border-radius: var(--xbot-radius-sm);
                padding: 8px 12px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                background: rgb(var(--xbot-theme-rgb));
                color: #fff;
                white-space: nowrap;
                transition: opacity 0.15s, transform 0.1s;
            }
            .xbot-inactivity-btn:hover:not(:disabled) { opacity: 0.92; }
            .xbot-inactivity-btn:disabled { opacity: 0.65; cursor: wait; }

            .xbot-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
                scroll-behavior: smooth;
                background: linear-gradient(180deg, var(--xbot-surface-alt) 0%, var(--xbot-surface) 48px);
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
                background: var(--xbot-border);
            }

            .xbot-message {
                padding: 10px 14px;
                border-radius: var(--xbot-radius-lg);
                font-size: 14px;
                line-height: 1.45;
                opacity: 0;
                transform: translateY(8px);
                animation: xbotFadeIn 0.28s ease forwards;
            }
            @keyframes xbotFadeIn {
                to { opacity: 1; transform: translateY(0); }
            }
            .xbot-message img {
                max-width: 100%;
                height: auto;
                border-radius: var(--xbot-radius-md);
                display: block;
                margin: 2px 0 6px;
            }
            .xbot-message.user {
                background: rgba(var(--xbot-theme-rgb), 0.12);
                border: 1px solid rgba(var(--xbot-theme-rgb), 0.22);
                color: var(--xbot-ink);
                border-bottom-right-radius: 4px;
            }
            .xbot-message.bot {
                background: var(--xbot-surface);
                border: 1px solid var(--xbot-border);
                color: var(--xbot-text);
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
            .xbot-text p { margin: 0 0 0.55em; line-height: 1.5; }
            .xbot-text p:last-child { margin-bottom: 0; }
            .xbot-text ul, .xbot-text ol { margin: 0.35em 0 0.55em 1.1em; padding: 0; }
            .xbot-text li { margin-bottom: 0.25em; }
            .xbot-text strong { font-weight: 600; }
            .xbot-message video {
                max-width: 100%;
                border-radius: var(--xbot-radius-md);
                display: block;
                margin: 4px 0 8px;
            }
            .xbot-time {
                font-size: 10px;
                color: var(--xbot-subtle);
            }
            .xbot-message a {
                color: var(--xbot-theme);
                font-weight: 500;
                text-decoration: none;
                border-bottom: 1px solid rgba(var(--xbot-theme-rgb), 0.4);
            }
            .xbot-message a:hover { opacity: 0.85; }

            .xbot-typing {
                font-size: 12px;
                color: var(--xbot-muted);
                padding: 4px 8px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .xbot-typing-dots span {
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: var(--xbot-theme);
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
                border-top: 1px solid var(--xbot-border);
                background: var(--xbot-surface);
                flex-shrink: 0;
            }
            .xbot-compose-inner {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                background: var(--xbot-field);
                border: 1px solid var(--xbot-border);
                border-radius: 14px;
                padding: 6px 6px 6px 10px;
                transition: border-color 0.15s, box-shadow 0.15s;
            }
            .xbot-compose-inner:focus-within {
                border-color: rgba(var(--xbot-theme-rgb), 0.55);
                box-shadow: 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.12);
                background: var(--xbot-surface);
            }
            .xbot-compose-tools {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 0;
                flex-shrink: 0;
            }
            .xbot-icon-btn {
                width: 30px;
                height: 30px;
                border: none;
                border-radius: var(--xbot-radius-xs);
                background: transparent;
                color: var(--xbot-muted);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s;
            }
            .xbot-icon-btn:hover {
                background: rgba(15, 23, 42, 0.06);
                color: var(--xbot-ink);
            }
            .xbot-icon-btn.is-recording {
                color: var(--xbot-danger);
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
                color: var(--xbot-ink);
            }
            .xbot-input::placeholder { color: var(--xbot-subtle); }
            .xbot-send {
                width: 40px;
                height: 40px;
                flex-shrink: 0;
                border: none;
                border-radius: var(--xbot-radius-md);
                background: var(--xbot-theme);
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
                background: var(--xbot-surface);
                flex-shrink: 0;
            }
            .xbot-powered {
                font-size: 11px;
                color: var(--xbot-subtle);
                text-decoration: none;
                letter-spacing: 0.02em;
            }
            .xbot-powered strong {
                color: var(--xbot-ink);
                font-weight: 600;
            }
            .xbot-powered:hover strong { color: var(--xbot-theme); }

            @media screen and (max-width: 600px) {
                .xbot-chatbox {
                    width: 100vw;
                    max-width: 100vw;
                    bottom: ${mobileStackBottom}px !important;
                    ${posH}: 0 !important;
                    border-radius: var(--xbot-radius-lg) var(--xbot-radius-lg) 0 0;
                }
                .xbot-chatbox.is-open:not(.xbot-keyboard-open) {
                    top: env(safe-area-inset-top, 0px);
                    bottom: calc(${mobileOpenStackBottom}px + env(safe-area-inset-bottom, 0px)) !important;
                    height: auto !important;
                    max-height: none !important;
                    border-radius: var(--xbot-radius-lg) var(--xbot-radius-lg) 0 0;
                }
                .xbot-chatbox.xbot-keyboard-open {
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    border-radius: 0 !important;
                    z-index: 2147483001;
                }
                .xbot-launcher.xbot-launcher--hidden {
                    visibility: hidden;
                    pointer-events: none;
                }
                .xbot-launcher {
                    bottom: calc(${mobileLauncherOffset}px + env(safe-area-inset-bottom, 0px));
                    ${posH}: 16px;
                }
                .xbot-launcher.is-open {
                    width: ${mobileLauncherOpenSize}px;
                    height: ${mobileLauncherOpenSize}px;
                }
                .xbot-launcher.is-open .xbot-launcher__close svg {
                    width: 14px;
                    height: 14px;
                }
                .xbot-welcome-teaser {
                    bottom: calc(${mobileStackBottom + 8}px + env(safe-area-inset-bottom, 0px));
                    ${posH}: 16px;
                    max-width: min(280px, calc(100vw - 96px));
                }
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
            '<div class="xbot-inactivity-bar" id="xbot-inactivity-bar" hidden role="status" aria-live="polite">' +
            '<div class="xbot-inactivity-text">' +
            '<span class="xbot-inactivity-icon" aria-hidden="true">⏱</span>' +
            '<span>A sessão encerra em <strong id="xbot-inactivity-countdown">1:00</strong></span>' +
            '</div>' +
            '<button type="button" class="xbot-inactivity-btn" id="xbot-inactivity-keep">' +
            'Manter conversa ativa' +
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

        var savedViewportContent = null;

        function setViewportZoomLocked(locked) {
            var meta = document.querySelector('meta[name="viewport"]');
            if (!meta) {
                if (!locked) return;
                meta = document.createElement('meta');
                meta.name = 'viewport';
                document.head.appendChild(meta);
            }
            if (locked) {
                if (savedViewportContent === null) {
                    savedViewportContent = meta.getAttribute('content') || 'width=device-width, initial-scale=1';
                }
                var base = savedViewportContent;
                var next = base;
                if (/maximum-scale/i.test(base)) {
                    next = base.replace(/maximum-scale\s*=\s*[^,]+/gi, 'maximum-scale=1');
                } else {
                    next = base + ', maximum-scale=1';
                }
                if (/user-scalable/i.test(next)) {
                    next = next.replace(/user-scalable\s*=\s*[^,]+/gi, 'user-scalable=no');
                } else {
                    next = next + ', user-scalable=no';
                }
                meta.setAttribute('content', next);
                document.documentElement.classList.add('xbot-chat-open');
            } else {
                if (savedViewportContent !== null) {
                    meta.setAttribute('content', savedViewportContent);
                    savedViewportContent = null;
                }
                document.documentElement.classList.remove('xbot-chat-open');
            }
        }

        function scrollMessagesToBottom() {
            var el = document.getElementById('xbot-messages');
            if (!el) return;
            el.scrollTop = el.scrollHeight;
        }

        function scheduleScrollMessagesToBottom() {
            requestAnimationFrame(function () {
                requestAnimationFrame(scrollMessagesToBottom);
            });
        }

        function setChatOpen(open) {
            chatbox.style.display = open ? 'flex' : 'none';
            chatbox.style.flexDirection = 'column';
            chatbox.classList.toggle('is-open', open);
            launcher.classList.toggle('is-open', open);
            setViewportZoomLocked(!!open);
            launcher.setAttribute('aria-label', open ? 'Fechar chat' : 'Abrir chat');
            if (open) {
                startSessionStatusPoll();
                unreadCount = 0;
                notification.textContent = '';
                notification.style.display = 'none';
                clearWelcomeAlertUi();
                if (!welcomeShown) {
                    var welcomeText = pendingWelcomeText || getWelcomeText();
                    if (welcomeText) {
                        appendMessage(welcomeText, 'bot', { countUnread: false });
                        rememberBotMessage(null, welcomeText);
                        welcomeShown = true;
                        pendingWelcomeText = null;
                    }
                }
                scheduleScrollMessagesToBottom();
                if (isMobileLayout()) {
                    requestAnimationFrame(applyMobileKeyboardLayout);
                }
                input.focus();
            } else {
                stopSessionStatusPoll();
                clearMobilePanelStyles();
            }
        }

        inactivityBar = document.getElementById('xbot-inactivity-bar');
        inactivityCountdownEl = document.getElementById('xbot-inactivity-countdown');
        inactivityKeepBtn = document.getElementById('xbot-inactivity-keep');
        if (inactivityKeepBtn) {
            inactivityKeepBtn.addEventListener('click', function () {
                keepSessionAlive();
            });
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

        var mobileViewportListenersBound = false;

        function isMobileLayout() {
            return !!(window.matchMedia && window.matchMedia(MOBILE_LAYOUT_MQ).matches);
        }

        function clearMobilePanelStyles() {
            chatbox.classList.remove('xbot-keyboard-open');
            chatbox.style.top = '';
            chatbox.style.left = '';
            chatbox.style.right = '';
            chatbox.style.width = '';
            chatbox.style.height = '';
            chatbox.style.maxHeight = '';
            chatbox.style.bottom = '';
            chatbox.style.borderRadius = '';
            launcher.classList.remove('xbot-launcher--hidden');
        }

        function applyMobileKeyboardLayout() {
            if (!isMobileLayout() || chatbox.style.display !== 'flex') {
                clearMobilePanelStyles();
                return;
            }

            var vv = window.visualViewport;
            var inputFocused = document.activeElement === input;
            var keyboardLikely = false;
            if (vv && inputFocused) {
                keyboardLikely = vv.height < window.innerHeight * 0.92;
            }

            if (!inputFocused && !keyboardLikely) {
                clearMobilePanelStyles();
                return;
            }

            if (!vv) {
                chatbox.classList.add('xbot-keyboard-open');
                launcher.classList.add('xbot-launcher--hidden');
                return;
            }

            chatbox.classList.add('xbot-keyboard-open');
            var top = Math.max(0, vv.offsetTop);
            chatbox.style.top = top + 'px';
            chatbox.style.bottom = 'auto';
            chatbox.style.left = '0';
            chatbox.style.right = '0';
            chatbox.style.width = '100%';
            chatbox.style.maxWidth = '100%';
            chatbox.style.height = vv.height + 'px';
            chatbox.style.maxHeight = vv.height + 'px';
            chatbox.style.borderRadius = '0';
            launcher.classList.add('xbot-launcher--hidden');
            scheduleScrollMessagesToBottom();
        }

        function bindMobileViewportListeners() {
            if (mobileViewportListenersBound) return;
            mobileViewportListenersBound = true;
            var vv = window.visualViewport;
            if (vv) {
                vv.addEventListener('resize', applyMobileKeyboardLayout);
                vv.addEventListener('scroll', applyMobileKeyboardLayout);
            }
            window.addEventListener('resize', applyMobileKeyboardLayout);
            input.addEventListener('focus', function () {
                requestAnimationFrame(applyMobileKeyboardLayout);
                setTimeout(applyMobileKeyboardLayout, 50);
                setTimeout(applyMobileKeyboardLayout, 150);
                setTimeout(applyMobileKeyboardLayout, 350);
            });
            input.addEventListener('blur', function () {
                setTimeout(applyMobileKeyboardLayout, 120);
            });
        }

        bindMobileViewportListeners();

        function appendMessage(text, from, opts) {
            if (from === undefined) from = 'user';
            opts = opts || {};
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
            var unsafeHTML;
            if (opts.rawHtml) {
                unsafeHTML = text;
            } else {
                unsafeHTML = window.marked.parse(text);
            }
            var sanitized = window.DOMPurify.sanitize(unsafeHTML, {
                ADD_TAGS: ['video', 'source'],
                ADD_ATTR: ['controls', 'playsinline', 'preload', 'src', 'style', 'loading', 'alt']
            });
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            msg.innerHTML = `
                <div class="xbot-message-content">
                    <div class="xbot-text">${sanitized}</div>
                    <div class="xbot-time">${timestamp}</div>
                </div>
            `;
            row.appendChild(msg);
            messages.appendChild(row);
            if (opts.scroll !== false) {
                scrollMessagesToBottom();
            }

            var countUnread = opts.countUnread !== false;
            if (from === 'bot' && countUnread && chatbox.style.display === 'none') {
                unreadCount++;
                notification.textContent = String(unreadCount);
                notification.style.display = 'flex';
                notificationSound.play().catch(function () {});
            }
        }     
        
        async function handleSendMessage() {
            const text = input.value.trim();
            if (!text) return;

            resumeRealtimeAfterUserSend();
            beginNewEpisodeFromUserMessage();
            appendMessage(text, 'user');
            input.value = '';
            pollSessionInactivity();

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
                    if (replyText) ingestBotPayload(null, replyText, 'post');
                    else clearPendingTyping();
                } else if (data.bot_reply_enabled) {
                    // Só mostra "digitando" quando a API confirma que o agente vai responder.
                    pendingSendCount++;
                    _moveOrShowTyping();
                    pendingSendCount = Math.max(0, pendingSendCount - 1);
                    setTimeout(function () {
                        if (pendingSendCount === 0) clearPendingTyping();
                    }, 30000);
                } else {
                    clearPendingTyping();
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
        };        
        
        // Upload de Arquivos (pdf, imagens)
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov';
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
            } else if (file.type.startsWith('video/')) {
            const vid = document.createElement('video');
            vid.src = URL.createObjectURL(file);
            vid.controls = true;
            vid.style.maxWidth = '100%';
            vid.style.borderRadius = '10px';
            preview.appendChild(vid);
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
                resumeRealtimeAfterUserSend();
                beginNewEpisodeFromUserMessage();
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', blob, 'audio.webm');

                const audioPreview = document.createElement('audio');
                audioPreview.controls = true;
                audioPreview.src = URL.createObjectURL(blob);
                const audioRow = document.createElement('div');
                audioRow.className = 'xbot-message-row user';
                const audioMsg = document.createElement('div');
                audioMsg.className = 'xbot-message user';
                audioMsg.appendChild(audioPreview);
                audioRow.appendChild(audioMsg);
                messages.appendChild(audioRow);
                messages.scrollTop = messages.scrollHeight;

                try {
                if (window.__xbotConfig.channelId) {
                    formData.append('channel_id', window.__xbotConfig.channelId);
                }
                var vid = getVisitorId();
                if (vid) formData.append('visitor_id', vid);
                const res = await fetch(getUploadUrl(), {
                    method: 'POST',
                    headers: buildAuthHeaders({}),
                    body: formData
                });
                if (!res.ok) throw new Error('upload failed');
                const data = await res.json();
                if (data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                if (data.bot_reply_enabled) {
                    pendingSendCount++;
                    _moveOrShowTyping();
                    pendingSendCount = Math.max(0, pendingSendCount - 1);
                    setTimeout(function () {
                        if (pendingSendCount === 0) clearPendingTyping();
                    }, 30000);
                } else {
                    clearPendingTyping();
                }
                pollSessionInactivity();
                } catch (err) {
                clearPendingTyping();
                appendMessage('Erro ao enviar o áudio.', 'bot');
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

        widgetLog('UI pronta', {
            visitorId: getVisitorId(),
            channelId: channelId,
            transporte: 'sse+poll',
        });
        // Carrega o histórico PRIMEIRO (fonte única da render inicial); só então inicia poll/SSE,
        // evitando duplicação/ordenação errada entre poll e histórico.
        loadChatHistory().finally(function () {
            if (sessionEpisodeEnded && closureNoticeRendered) {
                widgetLog('transporte pausado — sessão encerrada');
                return;
            }
            startBotPoll();
            runXchatSse();
        });
        
    });


  })();

 