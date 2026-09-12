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

    var XBOT_CHANNEL_UUID_RE =
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

    /**
     * Extrai UUID canônico do channelId.
     * Evita 422 quando o embed/env concatena lixo ao UUID (ex.: sufixo do client secret).
     */
    function normalizeXbotChannelId(value) {
      var raw = String(value == null ? '' : value).trim();
      if (!raw) return '';
      var match = raw.match(XBOT_CHANNEL_UUID_RE);
      return match ? match[0] : raw;
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
      var channelId = normalizeXbotChannelId(cfg.channelId);
      var workforceKey = xbotWorkforceIconKey(channelId);
      var workforceUrl = xbotWorkforceAssetUrl(workforceKey);
      return Object.assign({}, cfg, {
        channelId: channelId || cfg.channelId,
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
      if (XBOT_WIDGET_VERSION && XBOT_WIDGET_VERSION.indexOf('__XBOT_WIDGET_VERSION__') !== 0) {
        headers['X-XBot-Widget-Version'] = XBOT_WIDGET_VERSION;
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
              offsetSide:
                data.offset_side != null ? data.offset_side : cfg.offsetSide,
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
      var rawChannelId = config.channelId;
      var normalizedChannelId = normalizeXbotChannelId(rawChannelId);
      if (
        rawChannelId &&
        normalizedChannelId &&
        String(rawChannelId).trim() !== normalizedChannelId
      ) {
        widgetLog('channelId sanitizado (removido sufixo inválido)', {
          recebido: String(rawChannelId).trim(),
          usando: normalizedChannelId,
        });
      }
      window.__xbotConfig = applyXbotAssetDefaults(
        Object.assign({}, config, { channelId: normalizedChannelId || rawChannelId })
      );
      window.__xbotAppearanceReady = false;
      widgetLog(
        'init',
        {
          channelId: (window.__xbotConfig && window.__xbotConfig.channelId) || null,
          apiBaseUrl: config.apiBaseUrl || null,
          hasClientId: !!(config.clientId && String(config.clientId).trim()),
          hasExternalUserId: !!(
            config.user &&
            config.user.externalUserId &&
            String(config.user.externalUserId).trim()
          ),
          hasContext: !!(config.context && typeof config.context === 'object'),
        }
      );
      fetchWidgetAppearance().finally(function () {
        window.__xbotAppearanceReady = true;
      });
    };

    /** Atualiza identidade do visitante (ex.: após login no site hospedeiro). */
    window.setXBotUser = function (user) {
      var cfg = window.__xbotConfig || {};
      cfg.user = user && typeof user === 'object' ? user : null;
      window.__xbotConfig = cfg;
      widgetLog('setXBotUser', {
        hasExternalUserId: !!(user && user.externalUserId && String(user.externalUserId).trim()),
      });
    };

    /** Atualiza contexto da página (URL/obs.) antes do envio — útil em SPAs. */
    window.setXBotContext = function (context) {
      var cfg = window.__xbotConfig || {};
      cfg.context = context && typeof context === 'object' ? context : null;
      window.__xbotConfig = cfg;
    };
  
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(markedScript);
  
    const purifyScript = document.createElement('script');
    purifyScript.src = 'https://cdn.jsdelivr.net/npm/dompurify@2.4.4/dist/purify.min.js';
    document.head.appendChild(purifyScript);

    const notificationSound = new Audio('https://notificationsounds.com/soundfiles/b9ece18c950afbfa6b0fdbfa4ff731d3/file-sounds-1102-eventually.mp3');
    notificationSound.volume = 0.5;

    /** Mesmo beep do sino em app.xbotone.com (Web Audio). */
    var xbotNotifyAudioCtx = null;
    var xbotNotifyAudioUnlockInstalled = false;
    function installXbotNotifyAudioUnlock() {
        if (xbotNotifyAudioUnlockInstalled || typeof window === 'undefined') return;
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        xbotNotifyAudioUnlockInstalled = true;
        var unlock = function () {
            try {
                xbotNotifyAudioCtx = xbotNotifyAudioCtx || new AudioContextClass();
                if (xbotNotifyAudioCtx.state === 'suspended') {
                    xbotNotifyAudioCtx.resume().catch(function () {});
                }
            } catch (e) { /* áudio bloqueado */ }
        };
        window.addEventListener('pointerdown', unlock, { once: true, passive: true });
        window.addEventListener('keydown', unlock, { once: true });
    }
    function playAppNotificationSound() {
        if (typeof window === 'undefined') return;
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        try {
            installXbotNotifyAudioUnlock();
            xbotNotifyAudioCtx = xbotNotifyAudioCtx || new AudioContextClass();
            var context = xbotNotifyAudioCtx;
            if (context.state === 'suspended') context.resume().catch(function () {});
            var now = context.currentTime;
            var gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
            gain.connect(context.destination);
            ;[880, 1174.66].forEach(function (frequency, index) {
                var oscillator = context.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(frequency, now + index * 0.12);
                oscillator.connect(gain);
                oscillator.start(now + index * 0.12);
                oscillator.stop(now + 0.28 + index * 0.12);
            });
        } catch (e) { /* ignore */ }
    }

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
            offsetBottom = 20,
            offsetSide = 20,
            browserNotify = false,
        } = config;
        var browserNotifyEnabled = !!browserNotify;

        function buildAuthHeaders(extra) {
            const h = Object.assign({}, extra || {});
            if (XBOT_WIDGET_VERSION && String(XBOT_WIDGET_VERSION).indexOf('__XBOT_WIDGET_VERSION__') !== 0) {
                h['X-XBot-Widget-Version'] = XBOT_WIDGET_VERSION;
            }
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
                var liveCfg = window.__xbotConfig || config || {};
                var user = liveCfg.user && typeof liveCfg.user === 'object' ? liveCfg.user : null;
                var extRaw = user && user.externalUserId != null ? String(user.externalUserId).trim() : '';
                if (extRaw) {
                    var safe = extRaw.replace(/[^\w.@+-]/g, '_').replace(/^ext_/i, '');
                    if (safe) {
                        var extId = ('ext_' + safe).slice(0, 50);
                        if (typeof localStorage !== 'undefined') {
                            try { localStorage.setItem('xbot_visitor_id', extId); } catch (e) {}
                        }
                        return extId;
                    }
                }
                var key = 'xbot_visitor_id';
                var id = typeof localStorage !== 'undefined' && localStorage.getItem(key);
                if (!id) {
                    id = 'v_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
                    if (typeof localStorage !== 'undefined') localStorage.setItem(key, id);
                }
                return id;
            } catch (e) { return null; }
        }

        function getXbotUserPayload() {
            var liveCfg = window.__xbotConfig || config || {};
            var user = liveCfg.user && typeof liveCfg.user === 'object' ? liveCfg.user : null;
            if (!user) return null;
            var out = {};
            if (user.externalUserId != null && String(user.externalUserId).trim()) {
                out.externalUserId = String(user.externalUserId).trim();
            }
            if (user.name != null && String(user.name).trim()) out.name = String(user.name).trim();
            if (user.email != null && String(user.email).trim()) out.email = String(user.email).trim();
            if (user.phone != null && String(user.phone).trim()) out.phone = String(user.phone).trim();
            var rawCustom = user.custom_fields || user.customFields;
            if (rawCustom && typeof rawCustom === 'object') {
                var custom = {};
                Object.keys(rawCustom).forEach(function (k) {
                    var sk = toSnakeCaseFieldKey(k);
                    if (!sk) return;
                    var v = rawCustom[k];
                    if (v == null) return;
                    if (typeof v === 'boolean' || typeof v === 'number') {
                        custom[sk] = v;
                        return;
                    }
                    var text = String(v).trim();
                    if (text) custom[sk] = text.slice(0, 2000);
                });
                if (Object.keys(custom).length) out.custom_fields = custom;
            }
            return Object.keys(out).length ? out : null;
        }

        function toSnakeCaseFieldKey(raw) {
            var s = String(raw == null ? '' : raw).trim();
            if (!s) return '';
            s = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
            s = s.replace(/[-\s]+/g, '_');
            s = s.replace(/[^a-zA-Z0-9_]/g, '_');
            s = s.replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
            if (!s || /^[0-9]/.test(s)) return '';
            return s.slice(0, 64);
        }

        function getXbotContextPayload() {
            var liveCfg = window.__xbotConfig || config || {};
            var ctx = liveCfg.context && typeof liveCfg.context === 'object' ? liveCfg.context : null;
            var out = {};
            if (ctx) {
                if (ctx.pageUrl != null && String(ctx.pageUrl).trim()) out.pageUrl = String(ctx.pageUrl).trim();
                if (ctx.pageTitle != null && String(ctx.pageTitle).trim()) out.pageTitle = String(ctx.pageTitle).trim();
                if (ctx.notes != null && String(ctx.notes).trim()) out.notes = String(ctx.notes).trim();
            }
            // Fallback: URL atual da página hospedeira se o site não passou context.pageUrl
            if (!out.pageUrl && typeof window !== 'undefined' && window.location && window.location.href) {
                try {
                    out.pageUrl = String(window.location.href).slice(0, 2000);
                    if (!out.pageTitle && typeof document !== 'undefined' && document.title) {
                        out.pageTitle = String(document.title).slice(0, 255);
                    }
                } catch (e) { /* ignore */ }
            }
            return Object.keys(out).length ? out : null;
        }

        function attachIdentityToMessageBody(msgBody) {
            var user = getXbotUserPayload();
            var ctx = getXbotContextPayload();
            if (user) msgBody.user = user;
            if (ctx) msgBody.context = ctx;
            return msgBody;
        }

        function attachIdentityToFormData(formData) {
            var user = getXbotUserPayload();
            var ctx = getXbotContextPayload();
            if (user) {
                try { formData.append('user', JSON.stringify(user)); } catch (e) {}
            }
            if (ctx) {
                try { formData.append('context', JSON.stringify(ctx)); } catch (e) {}
            }
            return formData;
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

        function getPresenceUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/presence';
        }

        var lastBotPollAt = null;
        var lastBotMessageId = null;
        var seenBotMessageKeys = {};
        var pollTimer = null;
        /** Poll HTTP só como fallback quando SSE cair (evita dobrar carga na API). */
        var XCHAT_POLL_MS = 8000;
        var sseAbortController = null;
        var sseActive = false;
        var sseFailCount = 0;
        var sseLoopRunning = false;
        var pendingTypingEl = null;
        var sessionStatusTimer = null;
        /** Barra de inatividade: 10s basta; 2s gerava storm desnecessário. */
        var SESSION_STATUS_POLL_MS = 10000;
        var keepAliveInFlight = false;
        var inactivityBar = null;
        var inactivityCountdownEl = null;
        var inactivityKeepBtn = null;
        var historyLoadedOnce = false;
        var realtimeDesired = false;
        var presenceTimer = null;
        var presenceInFlight = false;
        var lastPresenceSignature = '';
        /** Heartbeat de presença do visitante para o Chat do operador (~TTL Redis 90s). */
        var PRESENCE_HEARTBEAT_MS = 30000;

        function isWindowFocused() {
            if (typeof document === 'undefined') return true;
            if (typeof document.hasFocus === 'function') {
                try {
                    return !!document.hasFocus();
                } catch (e) {
                    return true;
                }
            }
            return true;
        }

        function buildPresencePayload(overrides) {
            overrides = overrides || {};
            var vid = getVisitorId();
            if (!vid || !channelId) return null;
            var chatOpen = overrides.chat_open != null ? !!overrides.chat_open : isChatOpen();
            var pageVisible =
                overrides.page_visible != null ? !!overrides.page_visible : isPageVisible();
            var windowFocused =
                overrides.window_focused != null ? !!overrides.window_focused : isWindowFocused();
            var status =
                overrides.status != null
                    ? overrides.status
                    : chatOpen && pageVisible
                      ? 'online'
                      : 'away';
            return {
                visitor_id: vid,
                channel_id: channelId,
                chat_open: chatOpen,
                page_visible: pageVisible,
                window_focused: windowFocused,
                status: status,
            };
        }

        function presenceSignature(payload) {
            if (!payload) return '';
            return [
                payload.status,
                payload.chat_open ? '1' : '0',
                payload.page_visible ? '1' : '0',
                payload.window_focused ? '1' : '0',
            ].join('|');
        }

        async function sendVisitorPresence(overrides, opts) {
            opts = opts || {};
            var url = getPresenceUrl();
            var payload = buildPresencePayload(overrides);
            if (!url || !payload) return;
            var sig = presenceSignature(payload);
            if (!opts.force && sig === lastPresenceSignature) return;
            if (presenceInFlight && !opts.force) return;
            presenceInFlight = true;
            try {
                var res = await fetch(url, {
                    method: 'POST',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(payload),
                    keepalive: !!opts.keepalive,
                });
                if (res.ok) lastPresenceSignature = sig;
            } catch (e) {
                widgetLog('presence erro', e && e.message);
            } finally {
                presenceInFlight = false;
            }
        }

        function startPresenceHeartbeat() {
            stopPresenceHeartbeat();
            sendVisitorPresence(null, { force: true });
            presenceTimer = setInterval(function () {
                sendVisitorPresence(null, { force: true });
            }, PRESENCE_HEARTBEAT_MS);
        }

        function stopPresenceHeartbeat() {
            if (presenceTimer) {
                clearInterval(presenceTimer);
                presenceTimer = null;
            }
        }

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
                clearMessageRows(container);
                ensureEmptyStateEl();
                sessionEndedNoticeShown = false;
                syncEmptyState();
            }
        }

        function pauseRealtimeTransportAfterClosure() {
            realtimeDesired = false;
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
            ensureRealtimeTransport();
        }

        function beginNewEpisodeFromUserMessage() {
            if (!sessionEpisodeEnded && !closureNoticeRendered) return;
            resetXchatEpisodeLocalState(true);
            sessionEpisodeEnded = false;
            sessionEndedNoticeShown = false;
            closureNoticeRendered = false;
            welcomeShown = false;
            startSessionStatusPoll();
            ensureRealtimeTransport();
        }

        function isChatOpen() {
            return !!(chatbox && chatbox.classList.contains('is-open'));
        }

        function isPageVisible() {
            return typeof document === 'undefined' || document.visibilityState !== 'hidden';
        }

        /** Com browserNotify (ex.: MOBA), mantém SSE mesmo com aba em background. */
        function isRealtimeAllowed() {
            return isChatOpen() && (isPageVisible() || browserNotifyEnabled);
        }

        function previewTextForNotify(text) {
            var raw = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!raw) return 'Nova mensagem';
            return raw.length > 140 ? raw.slice(0, 137) + '…' : raw;
        }

        function requestBrowserNotifyPermission() {
            if (!browserNotifyEnabled || typeof Notification === 'undefined') return;
            if (Notification.permission !== 'default') return;
            try {
                var p = Notification.requestPermission();
                if (p && typeof p.then === 'function') p.catch(function () {});
            } catch (e) { /* ignore */ }
        }

        function installBrowserNotifyPermissionPrompt() {
            if (!browserNotifyEnabled || typeof window === 'undefined') return;
            if (typeof Notification === 'undefined') return;
            if (Notification.permission !== 'default') return;
            var ask = function () {
                requestBrowserNotifyPermission();
            };
            window.addEventListener('pointerdown', ask, { once: true, passive: true });
            window.addEventListener('keydown', ask, { once: true });
        }

        /**
         * Som do app (sino) + notificação nativa do browser.
         * Usado no MOBA mesmo com o chat aberto.
         */
        function notifyBrowserIncoming(bodyText) {
            if (!browserNotifyEnabled) return;
            playAppNotificationSound();
            if (typeof Notification === 'undefined') return;
            if (Notification.permission !== 'granted') return;
            try {
                var n = new Notification(botName || 'Xbot', {
                    body: previewTextForNotify(bodyText),
                    tag: 'xbot-browser-message',
                    // Som customizado já tocado (mesmo do app); evita bip duplo do SO.
                    silent: true,
                });
                n.onclick = function () {
                    try { window.focus(); } catch (e) { /* ignore */ }
                    try { n.close(); } catch (e2) { /* ignore */ }
                };
            } catch (e) { /* Safari/iOS podem bloquear */ }
        }

        function maybeShowWelcomeMessage() {
            if (!isChatOpen() || welcomeShown) return;
            var welcomeText = pendingWelcomeText || getWelcomeText();
            if (!welcomeText) return;
            appendMessage(welcomeText, 'bot', {
                countUnread: false,
                animateTyping: true,
            });
            rememberBotMessage(null, welcomeText);
            welcomeShown = true;
            pendingWelcomeText = null;
            scheduleScrollMessagesToBottom();
        }

        function ensureRealtimeTransport() {
            if (sessionEpisodeEnded && closureNoticeRendered) return;
            if (!isRealtimeAllowed()) return;
            realtimeDesired = true;
            function startTransports() {
                if (!realtimeDesired || !isRealtimeAllowed()) return;
                maybeShowWelcomeMessage();
                if (!sseLoopRunning) runXchatSse();
                // Dá ~2.5s para o SSE subir antes de ligar o poll HTTP.
                setTimeout(function () {
                    if (!realtimeDesired || sseActive || pollTimer) return;
                    if (!isRealtimeAllowed()) return;
                    startBotPoll();
                }, 2500);
            }
            if (!historyLoadedOnce) {
                historyLoadedOnce = true;
                loadChatHistory().finally(startTransports);
            } else {
                startTransports();
            }
        }

        function pauseRealtimeTransportIdle() {
            realtimeDesired = false;
            stopBotPoll();
            stopXchatSse();
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
            if (!apiBaseUrl || !channelId || !isChatOpen()) return;
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
                    stopThinkingFaceAnimation(nodes[i]);
                    if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
                }
            } else if (pendingTypingEl && pendingTypingEl.parentNode) {
                stopThinkingFaceAnimation(pendingTypingEl);
                pendingTypingEl.parentNode.removeChild(pendingTypingEl);
            }
            pendingTypingEl = null;
        }

        function formatMessageTime(date) {
            return (date || new Date()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
        }

        function lastMessageRow() {
            var container = document.getElementById('xbot-messages');
            if (!container || !container.children) return null;
            for (var i = container.children.length - 1; i >= 0; i--) {
                var el = container.children[i];
                if (el && el.classList && el.classList.contains('xbot-message-row')) return el;
            }
            return null;
        }

        function shouldShowBotAvatar() {
            var last = lastMessageRow();
            return !(last && last.classList.contains('bot'));
        }

        function _randRange(min, max) {
            return min + Math.random() * (max - min);
        }

        /** Rostinho animado (respira, balança, pisca e olha) enquanto o bot pensa. */
        function buildThinkingFaceHtml(sizePx) {
            var size = sizePx || 36;
            return (
                '<svg class="xbot-think-face" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' +
                size +
                '" height="' +
                size +
                '" aria-hidden="true">' +
                '<g class="xbot-think-root">' +
                '<g class="xbot-think-spin">' +
                '<g class="xbot-think-breathe">' +
                '<g class="xbot-think-bob">' +
                '<g class="xbot-think-head" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M42 22 L50 32 L58 22"></path>' +
                '<rect x="20" y="34" width="60" height="46" rx="14"></rect>' +
                '</g>' +
                '<g class="xbot-think-eyes" fill="currentColor">' +
                '<g class="xbot-think-eye xbot-think-eye--l">' +
                '<g class="xbot-think-lid">' +
                '<rect x="32" y="48" width="11" height="11" rx="2.5"></rect>' +
                '</g></g>' +
                '<g class="xbot-think-eye xbot-think-eye--r">' +
                '<g class="xbot-think-lid">' +
                '<rect x="57" y="48" width="11" height="11" rx="2.5"></rect>' +
                '</g></g>' +
                '</g></g></g></g></g></svg>'
            );
        }

        /**
         * CSS transform em <g> SVG costuma ficar parado em vários browsers.
         * Anima via atributo transform + rAF (sempre funciona).
         * Olhos olham/piscam + giro 360° periódico.
         */
        function startThinkingFaceAnimation(svg) {
            if (!svg || svg.getAttribute('data-xb-anim') === '1') return;
            svg.setAttribute('data-xb-anim', '1');
            var spin = svg.querySelector('.xbot-think-spin');
            var breathe = svg.querySelector('.xbot-think-breathe');
            var bob = svg.querySelector('.xbot-think-bob');
            var eyeL = svg.querySelector('.xbot-think-eye--l');
            var eyeR = svg.querySelector('.xbot-think-eye--r');
            var lidL = eyeL && eyeL.querySelector('.xbot-think-lid');
            var lidR = eyeR && eyeR.querySelector('.xbot-think-lid');
            var lookAmpX = _randRange(1.6, 3.2) * (Math.random() < 0.5 ? -1 : 1);
            var lookAmpY = _randRange(1.0, 2.2) * (Math.random() < 0.5 ? -1 : 1);
            var rock = _randRange(0.6, 1.2);
            var phaseBreathe = _randRange(0, Math.PI * 2);
            var phaseBob = _randRange(0, Math.PI * 2);
            var phaseLook = _randRange(0, Math.PI * 2);
            var blinkPeriod = _randRange(3.2, 5.2);
            var blinkPhase = _randRange(0, blinkPeriod);
            var spinCycle = _randRange(3.6, 5.0);
            var spinDur = _randRange(0.75, 1.05);
            var spinPhase = _randRange(0.4, 1.2);
            var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            var rafId = 0;

            function around(cx, cy, sx, sy) {
                return (
                    'translate(' + cx + ' ' + cy + ') scale(' + sx + ' ' + sy + ') translate(' + (-cx) + ' ' + (-cy) + ')'
                );
            }

            function easeInOutCubic(p) {
                return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            }

            function blinkScale(tSec) {
                var u = ((tSec + blinkPhase) % blinkPeriod) / blinkPeriod;
                if (u > 0.42 && u < 0.48) {
                    var p = (u - 0.42) / 0.06;
                    var k = p < 0.5 ? p * 2 : (1 - p) * 2;
                    return { sx: 1 + 0.12 * k, sy: 1 - 0.92 * k };
                }
                return { sx: 1, sy: 1 };
            }

            function spinAngle(tSec) {
                var u = (tSec + spinPhase) % spinCycle;
                if (u >= spinDur) return 0;
                return easeInOutCubic(u / spinDur) * 360;
            }

            function tick(now) {
                if (!svg.isConnected) {
                    svg.removeAttribute('data-xb-anim');
                    return;
                }
                var t = ((now || Date.now()) - t0) / 1000;
                if (spin) {
                    spin.setAttribute('transform', 'rotate(' + spinAngle(t).toFixed(2) + ' 50 52)');
                }
                var breatheScale = 1 + 0.04 * Math.sin(t * ((Math.PI * 2) / 3.4) + phaseBreathe);
                if (breathe) {
                    breathe.setAttribute('transform', around(50, 52, breatheScale, breatheScale));
                }
                if (bob) {
                    var bobY = -1.4 + 0.45 * Math.sin(t * ((Math.PI * 2) / 2.6) + phaseBob);
                    var bobRot = rock * Math.sin(t * ((Math.PI * 2) / 2.6) + phaseBob);
                    bob.setAttribute(
                        'transform',
                        'translate(0 ' + bobY.toFixed(3) + ') rotate(' + bobRot.toFixed(3) + ' 50 52)'
                    );
                }
                var lookX =
                    lookAmpX * Math.sin(t * ((Math.PI * 2) / 5.8) + phaseLook) +
                    lookAmpX * 0.35 * Math.sin(t * ((Math.PI * 2) / 2.1) + phaseLook * 1.7);
                var lookY =
                    lookAmpY * Math.sin(t * ((Math.PI * 2) / 6.4) + phaseLook * 0.8) +
                    lookAmpY * 0.3 * Math.cos(t * ((Math.PI * 2) / 2.7) + phaseLook);
                if (eyeL) eyeL.setAttribute('transform', 'translate(' + lookX.toFixed(3) + ' ' + lookY.toFixed(3) + ')');
                if (eyeR) eyeR.setAttribute('transform', 'translate(' + lookX.toFixed(3) + ' ' + lookY.toFixed(3) + ')');
                var blink = blinkScale(t);
                if (lidL) lidL.setAttribute('transform', around(37.5, 53.5, blink.sx, blink.sy));
                if (lidR) lidR.setAttribute('transform', around(62.5, 53.5, blink.sx, blink.sy));
                rafId = requestAnimationFrame(tick);
            }

            rafId = requestAnimationFrame(tick);
            svg._xbThinkStop = function () {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = 0;
                svg.removeAttribute('data-xb-anim');
            };
        }

        function stopThinkingFaceAnimation(root) {
            if (!root) return;
            var svg = root.querySelector ? root.querySelector('.xbot-think-face') : null;
            if (svg && typeof svg._xbThinkStop === 'function') svg._xbThinkStop();
        }

        // Move o indicador existente para o final (sem piscar) ou cria um novo se não existir.
        function _moveOrShowTyping() {
            var container = document.getElementById('xbot-messages');
            if (!container) return;
            // Remover duplicatas espúrias (nunca deve haver mais de um)
            var all = container.querySelectorAll ? container.querySelectorAll('.xbot-typing') : [];
            for (var i = 0; i < all.length; i++) {
                if (all[i] !== pendingTypingEl && all[i].parentNode) {
                    stopThinkingFaceAnimation(all[i]);
                    all[i].parentNode.removeChild(all[i]);
                }
            }
            if (pendingTypingEl && pendingTypingEl.parentNode) {
                container.appendChild(pendingTypingEl); // reposiciona no final
            } else {
                var el = document.createElement('div');
                el.className = 'xbot-typing';
                el.setAttribute('aria-live', 'polite');
                el.setAttribute('aria-label', botName + ' está pensando');
                el.innerHTML = buildThinkingFaceHtml(36);
                container.appendChild(el);
                pendingTypingEl = el;
                var face = el.querySelector('.xbot-think-face');
                if (face) startThinkingFaceAnimation(face);
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
            // Dedup por conteúdo só para payloads sem id (otimista/local). Com id, mensagens
            // repetidas legítimas (ex.: "Como posso te ajudar?") precisam aparecer.
            if ((!item || !item.id) && seenBotMessageKeys['c:' + dedupKey]) return;
            if (isSessionClosurePayload(item, body)) {
                if (closureNoticeRendered || pendingSendCount > 0) return;
            }
            if (meta.session_closed || isSessionClosurePayload(item, body)) {
                finalizeSessionEndedState();
            }
            clearPendingTyping();
            var actions = extractReplyActions(meta);
            // history/hydrate: instantâneo; opening/sse/poll/post: typewriter
            var animateTyping = source !== 'history' && source !== 'hydrate';
            if (isMedia) {
                appendBotMedia(ct, mediaUrl, body, meta, {
                    countUnread: source !== 'history' && source !== 'opening',
                    actions: actions,
                    interactive: source !== 'history' && source !== 'opening',
                    animateTyping: false
                });
            } else {
                appendMessage(body, 'bot', {
                    countUnread: source !== 'history' && source !== 'opening',
                    actions: actions,
                    interactive: source !== 'history' && source !== 'opening',
                    animateTyping: animateTyping
                });
            }
            rememberBotMessage(item, dedupKey);
            if (item && item.id) saveLastBotMessageId(item.id);
            widgetLog('mensagem recebida', { via: source || 'unknown', id: item && item.id, tipo: ct, len: body.length });
        }

        function extractReplyActions(meta) {
            if (!meta || typeof meta !== 'object') return [];
            var raw = null;
            if (Array.isArray(meta.actions) && meta.actions.length) raw = meta.actions;
            else if (meta.channel_rendering && Array.isArray(meta.channel_rendering.actions)) {
                raw = meta.channel_rendering.actions;
            } else if (meta.content_envelope && Array.isArray(meta.content_envelope.actions)) {
                raw = meta.content_envelope.actions;
            }
            if (!raw || !raw.length) return [];
            var out = [];
            for (var i = 0; i < raw.length; i++) {
                var a = raw[i];
                if (!a || typeof a !== 'object') continue;
                var label = String(a.label || a.value || '').trim();
                var value = String(a.value || a.label || '').trim();
                var kind = String(a.kind || 'reply').trim().toLowerCase();
                var url = String(a.url || (kind === 'url' ? value : '') || '').trim();
                if (!label) continue;
                if (kind === 'url') {
                    if (!url) continue;
                    out.push({ id: a.id || ('action-' + i), label: label, value: value || url, kind: 'url', url: url });
                } else {
                    if (!value) continue;
                    out.push({ id: a.id || ('action-' + i), label: label, value: value, kind: 'reply' });
                }
            }
            return out;
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
                    if (shouldShowBotAvatar()) {
                        var av = document.createElement('img');
                        av.className = 'xbot-msg-avatar';
                        av.src = botAvatar;
                        av.alt = '';
                        row.appendChild(av);
                    } else {
                        row.classList.add('xbot-message-row--no-avatar');
                    }
                }
                var col = document.createElement('div');
                col.className = 'xbot-message-col';
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
                timeDiv.textContent = formatMessageTime();
                contentDiv.appendChild(textDiv);
                msgDiv.appendChild(contentDiv);
                mountReplyActions(contentDiv, (opts && opts.actions) || [], opts);
                col.appendChild(msgDiv);
                col.appendChild(timeDiv);
                row.appendChild(col);
                messages.appendChild(row);
                syncEmptyState();
                scrollMessagesToBottom();
                var countUnread = !opts || opts.countUnread !== false;
                if (countUnread && !isChatOpen()) {
                    unreadCount++;
                    notification.textContent = String(unreadCount);
                    notification.style.display = 'flex';
                    notificationSound.play().catch(function() {});
                }
                if (countUnread) {
                    notifyBrowserIncoming(cap || (ct === 'image' ? 'Imagem' : 'Nova mensagem'));
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
                var audioNode = createXbotAudioPlayer(url);
                if (cap && cap.indexOf('🎵') !== 0) {
                    var audioWrap = document.createElement('div');
                    audioWrap.appendChild(audioNode);
                    var audioCap = document.createElement('p');
                    audioCap.className = 'text-xs opacity-80 mt-1';
                    audioCap.textContent = cap;
                    audioWrap.appendChild(audioCap);
                    appendMessage('', 'bot', Object.assign({}, opts, { domNode: audioWrap, animateTyping: false }));
                } else {
                    appendMessage('', 'bot', Object.assign({}, opts, { domNode: audioNode, animateTyping: false }));
                }
            } else {
                var label = cap || (meta && meta.filename) || 'Arquivo';
                appendMessage('[📎 ' + label + '](' + url + ')', 'bot', opts);
            }
        }

        function rememberBotMessage(item, content) {
            if (item && item.id) {
                seenBotMessageKeys['id:' + item.id] = true;
                if (item.created_at) saveLastBotPollAt(item.created_at);
                return;
            }
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
            if (sseLoopRunning) return;
            if (sessionEpisodeEnded && closureNoticeRendered) return;
            sseLoopRunning = true;
            try {
                while (apiBaseUrl && channelId && realtimeDesired) {
                    if (sessionEpisodeEnded && closureNoticeRendered) break;
                    if (!isRealtimeAllowed()) break;
                    var vid = getVisitorId();
                    if (!vid) break;
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
                        stopBotPoll();
                        widgetLog('SSE conectado (poll pausado)');

                        var reader = res.body.getReader();
                        var decoder = new TextDecoder();
                        var buffer = '';
                        while (true) {
                            if (!realtimeDesired) {
                                stopXchatSse();
                                break;
                            }
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
                        if (!realtimeDesired) break;
                        throw new Error('sse_closed');
                    } catch (err) {
                        sseActive = false;
                        if (err && err.name === 'AbortError') break;
                        sseFailCount += 1;
                        widgetLog('SSE indisponível, usando poll', { erro: err && err.message, tentativa: sseFailCount });
                        if (realtimeDesired && isRealtimeAllowed()) {
                            if (!pollTimer) startBotPoll();
                        }
                        await new Promise(function (r) { setTimeout(r, Math.min(1500 * sseFailCount, 8000)); });
                    }
                }
            } finally {
                sseLoopRunning = false;
                sseActive = false;
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
                widgetLog('histórico carregado', {
                    mensagens: list.length,
                    session_active: data.session_active,
                    presentation_started: !!data.presentation_started,
                });
                // Histórico é a fonte única da render inicial: remove só as linhas de mensagem
                // (preserva #xbot-empty) e reidrata — evita tela branca quando a lista vem vazia.
                var histContainer = document.getElementById('xbot-messages');
                clearMessageRows(histContainer);
                ensureEmptyStateEl();
                seenBotMessageKeys = {};
                var hasUserInHistory = false;
                var botOnlyCount = 0;
                for (var h = 0; h < list.length; h++) {
                    if ((list[h].sender || 'bot') === 'user') hasUserInHistory = true;
                    else botOnlyCount += 1;
                }
                // Ao entrar (só abertura do bot, sem fala do visitante): typewriter na abertura.
                var animateOpening = !hasUserInHistory && botOnlyCount > 0 && botOnlyCount <= 3;
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var body = (item.content || '').trim();
                    var histMeta = (item.metadata && typeof item.metadata === 'object') ? item.metadata : {};
                    var histMedia = histMeta.media_url || '';
                    if (!body && !histMedia) continue;
                    if ((item.sender || 'bot') === 'user') {
                        var histCt = String(item.content_type || '').toLowerCase();
                        if (histMedia && (histCt === 'audio' || histCt === 'ptt')) {
                            appendMessage('', 'user', { domNode: createXbotAudioPlayer(histMedia) });
                        } else if (histMedia && histCt === 'video') {
                            var uVideo =
                                '<video controls playsinline preload="metadata" style="max-width:100%;border-radius:12px;margin:4px 0 8px">' +
                                '<source src="' + String(histMedia).replace(/"/g, '&quot;') + '"></video>';
                            appendMessage(uVideo, 'user', { rawHtml: true });
                        } else if (histMedia && histCt === 'image') {
                            appendMessage('![imagem](' + histMedia + ')' + (body ? '\n\n' + body : ''), 'user');
                        } else {
                            appendMessage(body, 'user');
                        }
                    } else {
                        ingestBotPayload(item, body, animateOpening ? 'opening' : 'history');
                    }
                }
                if (list.length) welcomeShown = true;
                syncEmptyState();
            } catch (e) {
                widgetLog('histórico erro', e && e.message);
            } finally {
                syncEmptyState();
                scheduleScrollMessagesToBottom();
            }
        }

        async function pollBotMessages() {
            if (sessionEpisodeEnded && closureNoticeRendered) return;
            if (sseActive) return;
            if (!realtimeDesired || !isRealtimeAllowed()) return;
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
            if (sseActive) return;
            if (!realtimeDesired || !isRealtimeAllowed()) return;
            if (pollTimer || !apiBaseUrl || !channelId) return;
            if (!lastBotPollAt && !sessionEpisodeEnded) {
                lastBotPollAt = loadLastBotPollAt();
            }
            widgetLog('poll fallback ativo (intervalo ' + XCHAT_POLL_MS + 'ms)');
            pollBotMessages();
            pollTimer = setInterval(pollBotMessages, XCHAT_POLL_MS);
        }
    
        const offset = offsetBottom != null ? offsetBottom : 20;
        const sideOffset = offsetSide != null ? offsetSide : 20;
        const LAUNCHER_SIZE = 64;
        const LAUNCHER_GAP = 28;
        const mobileLauncherOffset = 16;
        const mobileLauncherOpenSize = 44;
        const mobileStackBottom = mobileLauncherOffset + LAUNCHER_SIZE + LAUNCHER_GAP;
        const MOBILE_LAYOUT_MQ = '(max-width: 600px)';
        const teaserSideOffset = sideOffset + LAUNCHER_SIZE + 12;

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
            collapse: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.75 3.75V10.25M13.75 10.25H20.25M13.75 10.25L20.25 3.75M10.25 20.25V13.75M10.25 13.75H3.75M10.25 13.75L3.75 20.25"/></svg>',
            send: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1.468 6.058C.265 4.988 1.02 3 2.63 3H21.28c1.343 0 2.185 1.45 1.52 2.617l-9.146 16.038c-.789 1.383-2.864 1.08-3.225-.47l-2.062-8.853 6.608-3.677a.75.75 0 0 0-.729-1.31L7.276 11.22z"/></svg>',
            attach: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>',
            copy: '<svg class="xbot-copy-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
            mic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>',
            stop: '<span class="xbot-rec-dot" aria-hidden="true"></span><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
            spinner: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 019 9"/></svg>',
            play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
            pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
        };

        function formatAudioClock(seconds) {
            if (!isFinite(seconds) || seconds < 0) return '0:00';
            var total = Math.floor(seconds);
            var m = Math.floor(total / 60);
            var s = total % 60;
            return m + ':' + String(s).padStart(2, '0');
        }

        function probeHtmlAudioDuration(audio) {
            return new Promise(function (resolve) {
                var done = false;
                function finish(value) {
                    if (done) return;
                    done = true;
                    audio.removeEventListener('loadedmetadata', onMeta);
                    audio.removeEventListener('durationchange', onMeta);
                    audio.removeEventListener('timeupdate', onTime);
                    try { audio.currentTime = 0; } catch (e) { /* ignore */ }
                    resolve(isFinite(value) && value > 0 ? value : 0);
                }
                function onMeta() {
                    if (isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
                        finish(audio.duration);
                    }
                }
                function onTime() {
                    if (isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
                        finish(audio.duration);
                    }
                }
                if (isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
                    resolve(audio.duration);
                    return;
                }
                audio.addEventListener('loadedmetadata', onMeta);
                audio.addEventListener('durationchange', onMeta);
                audio.addEventListener('timeupdate', onTime);
                try { audio.currentTime = 1e101; } catch (e) { finish(0); }
                setTimeout(function () { finish(audio.duration); }, 1500);
            });
        }

        /** Player de áudio no estilo do Chat CRM: play + duração total + barra. */
        function createXbotAudioPlayer(url) {
            var wrap = document.createElement('div');
            wrap.className = 'xbot-audio-player';
            var audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.src = url;
            var playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'xbot-audio-play';
            playBtn.setAttribute('aria-label', 'Reproduzir áudio');
            playBtn.innerHTML = XBOT_ICONS.play;
            var timeEl = document.createElement('span');
            timeEl.className = 'xbot-audio-time';
            timeEl.textContent = '0:00';
            var track = document.createElement('div');
            track.className = 'xbot-audio-track';
            var trackBg = document.createElement('div');
            trackBg.className = 'xbot-audio-track-bg';
            var trackFill = document.createElement('div');
            trackFill.className = 'xbot-audio-track-fill';
            var range = document.createElement('input');
            range.type = 'range';
            range.min = '0';
            range.max = '1';
            range.step = '0.01';
            range.value = '0';
            range.setAttribute('aria-label', 'Posição do áudio');
            track.appendChild(trackBg);
            track.appendChild(trackFill);
            track.appendChild(range);
            wrap.appendChild(audio);
            wrap.appendChild(playBtn);
            wrap.appendChild(timeEl);
            wrap.appendChild(track);

            var duration = 0;
            var seeking = false;

            function syncUi() {
                var cur = audio.currentTime || 0;
                var show = (!audio.paused || cur > 0) ? cur : duration;
                timeEl.textContent = formatAudioClock(show);
                var max = duration > 0 ? duration : Math.max(cur, 0.1);
                range.max = String(max);
                if (!seeking) range.value = String(Math.min(cur, max));
                var pct = duration > 0 ? Math.min(100, (cur / duration) * 100) : 0;
                trackFill.style.width = pct + '%';
                playBtn.innerHTML = audio.paused ? XBOT_ICONS.play : XBOT_ICONS.pause;
                playBtn.setAttribute('aria-label', audio.paused ? 'Reproduzir áudio' : 'Pausar áudio');
            }

            playBtn.addEventListener('click', function () {
                if (!audio.paused) {
                    audio.pause();
                    return;
                }
                try { audio.currentTime = 0; } catch (e) { /* ignore */ }
                audio.play().catch(function () { /* ignore */ });
            });
            range.addEventListener('input', function () {
                seeking = true;
                timeEl.textContent = formatAudioClock(Number(range.value) || 0);
            });
            function commitSeek() {
                seeking = false;
                try {
                    audio.currentTime = Number(range.value) || 0;
                } catch (e) { /* ignore */ }
                syncUi();
            }
            range.addEventListener('change', commitSeek);
            range.addEventListener('mouseup', commitSeek);
            range.addEventListener('touchend', commitSeek);
            audio.addEventListener('timeupdate', syncUi);
            audio.addEventListener('play', syncUi);
            audio.addEventListener('pause', syncUi);
            audio.addEventListener('ended', function () {
                try { audio.currentTime = 0; } catch (e) { /* ignore */ }
                syncUi();
            });
            probeHtmlAudioDuration(audio).then(function (value) {
                duration = value || 0;
                syncUi();
            });
            audio.load();
            return wrap;
        }

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
            if (isChatOpen()) return;

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
                --xbot-header-bg: #fff;
                --xbot-compose-shadow: 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 1px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.04);
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
                ${posH}: ${sideOffset}px;
                width: 64px;
                height: 64px;
                padding: 0;
                border: 3px solid #fff;
                border-radius: 50%;
                cursor: pointer;
                z-index: 2147483000;
                background: var(--xbot-theme);
                box-shadow: 0 12px 40px rgba(15, 23, 42, 0.28), 0 0 0 6px rgba(var(--xbot-theme-rgb), 0.22);
                transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, visibility 0.2s;
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
            .xbot-launcher.xbot-launcher--hidden {
                visibility: hidden;
                pointer-events: none;
                opacity: 0;
                transform: scale(0.85);
                transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
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
                ${posH}: ${teaserSideOffset}px;
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
                bottom: ${offset}px;
                ${posH}: ${sideOffset}px;
                width: min(23.75rem, calc(100vw - 2rem));
                height: min(30rem, calc(100vh - ${offset + 24}px));
                height: min(30rem, calc(100dvh - ${offset + 24}px));
                background: var(--xbot-surface);
                border-radius: var(--xbot-radius-xl);
                border: 1px solid rgba(15, 23, 42, 0.06);
                box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.03);
                display: none;
                flex-direction: column;
                overflow: hidden;
                z-index: 2147482999;
                font-family: var(--xbot-font);
                opacity: 0;
                transform: translateY(14px) scale(0.98);
                transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
                pointer-events: none;
            }
            .xbot-chatbox.is-open {
                /* Acima do launcher (z 2147483000) para o botão recolher receber o clique. */
                z-index: 2147483001;
                pointer-events: auto;
            }
            .xbot-chatbox.is-visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            .xbot-header {
                background: var(--xbot-header-bg);
                color: var(--xbot-ink);
                padding: 12px 14px;
                padding-top: calc(12px + env(safe-area-inset-top, 0px));
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 1px solid var(--xbot-border);
                box-shadow: inset 0 -2px 0 rgba(var(--xbot-theme-rgb), 0.85);
                flex-shrink: 0;
            }
            .xbot-header img {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid var(--xbot-border);
            }
            .xbot-header-text { flex: 1; min-width: 0; }
            .xbot-header-name {
                display: block;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: -0.02em;
                color: var(--xbot-ink);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .xbot-header-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: var(--xbot-muted);
                margin-top: 2px;
            }
            .xbot-status-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: var(--xbot-success);
                box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.28);
            }
            .xbot-header-minimize {
                width: 40px;
                height: 40px;
                flex-shrink: 0;
                border: none;
                border-radius: 50%;
                background: var(--xbot-field);
                color: var(--xbot-muted);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s;
            }
            .xbot-header-minimize:hover {
                background: #e2e8f0;
                color: var(--xbot-ink);
            }
            .xbot-header-minimize:focus-visible {
                outline: 2px solid rgba(var(--xbot-theme-rgb), 0.55);
                outline-offset: 2px;
            }

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
                background: var(--xbot-surface);
                position: relative;
            }
            .xbot-empty {
                margin: auto;
                max-width: 18rem;
                padding: 28px 12px;
                text-align: center;
                pointer-events: none;
            }
            .xbot-empty[hidden] { display: none !important; }
            .xbot-empty-text {
                margin: 0;
                font-size: 13px;
                line-height: 1.5;
                color: var(--xbot-muted);
                text-wrap: balance;
            }

            .xbot-message-row {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                max-width: 92%;
            }
            .xbot-message-row.bot { align-self: flex-start; max-width: 92%; }
            .xbot-message-row.bot.xbot-message-row--catalog { max-width: 100%; width: 100%; }
            .xbot-message-row.user { align-self: flex-end; max-width: 85%; }
            .xbot-message-row.bot.xbot-message-row--no-avatar {
                padding-left: 36px;
            }
            .xbot-msg-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                background: var(--xbot-border);
            }
            .xbot-message-col {
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-width: 0;
                max-width: 100%;
            }
            .xbot-message-row.user .xbot-message-col { align-items: flex-end; }
            .xbot-message-row.bot .xbot-message-col { align-items: flex-start; }

            .xbot-message {
                padding: 10px 14px;
                border-radius: var(--xbot-radius-lg);
                font-size: 14px;
                line-height: 1.45;
                opacity: 0;
                transform: translateY(8px);
                animation: xbotFadeIn 0.28s ease forwards;
                min-width: 0;
                max-width: 100%;
                overflow: hidden;
                overflow-wrap: anywhere;
                word-break: break-word;
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
            .xbot-text { display: block; word-wrap: break-word; overflow-wrap: anywhere; min-width: 0; max-width: 100%; }
            .xbot-text pre {
                display: block;
                max-width: 100%;
                min-width: 0;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                word-break: break-all;
                overflow-x: hidden;
            }
            .xbot-code-box {
                position: relative;
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 16px 12px 12px;
                border-radius: 8px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                margin: 8px 0 4px;
            }
            .xbot-code-box pre {
                margin: 0;
                padding-right: 52px;
                background: transparent;
                color: inherit;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                word-break: break-all;
            }
            .xbot-copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: #2d2d2d;
                color: #fff;
                border: 1px solid #444;
                padding: 6px 8px;
                border-radius: 4px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                line-height: 1;
            }
            .xbot-copy-btn:hover { background: #3c3c3c; }
            .xbot-copy-tooltip { font-family: var(--xbot-font); }
            .xbot-text code {
                max-width: 100%;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                word-break: break-all;
            }
            .xbot-text a {
                overflow-wrap: anywhere;
                word-break: break-all;
            }
            .xbot-text p { margin: 0 0 0.55em; line-height: 1.5; }
            .xbot-text p:last-child { margin-bottom: 0; }
            .xbot-text ul, .xbot-text ol { margin: 0.35em 0 0.55em 1.1em; padding: 0; }
            .xbot-text li { margin-bottom: 0.25em; }
            .xbot-text strong { font-weight: 600; }
            .xbot-catalog-grid,
            .xbot-text [data-xbot="catalog-grid"] {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 10px;
                width: 100%;
                min-width: 0;
                margin: 10px 0;
            }
            .xbot-catalog-card,
            .xbot-text [data-xbot-card="catalog"] {
                display: flex;
                flex-direction: column;
                border: 1px solid var(--xbot-border);
                border-radius: 10px;
                overflow: hidden;
                background: var(--xbot-surface-alt);
                cursor: pointer;
                outline: none;
                -webkit-tap-highlight-color: transparent;
                transition: border-color .15s ease, box-shadow .15s ease;
                min-width: 0;
            }
            .xbot-catalog-card--hidden,
            .xbot-text [data-xbot-card="catalog"].xbot-catalog-card--hidden,
            .xbot-text [data-xbot-card="catalog"][data-xbot-catalog-hidden="1"],
            .xbot-catalog-card--pending {
                display: none !important;
            }
            .xbot-catalog-card--reveal {
                animation: xbotCatalogReveal 0.32s ease forwards;
            }
            @keyframes xbotCatalogReveal {
                from { opacity: 0; transform: translateY(10px) scale(0.98); }
                to { opacity: 1; transform: none; }
            }
            .xbot-catalog-ui--pending { display: none !important; }
            .xbot-catalog-is-typing {
                pointer-events: none;
            }
            .xbot-catalog-typecursor::after,
            .xbot-typecursor::after {
                content: '▋';
                margin-left: 1px;
                color: var(--xbot-theme);
                animation: xbotTypeBlink 0.75s step-end infinite;
            }
            @keyframes xbotTypeBlink {
                50% { opacity: 0; }
            }
            .xbot-catalog-live-typing {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 6px 0 8px;
                font-size: 12px;
                color: var(--xbot-muted);
            }
            .xbot-catalog-live-typing .xbot-think-face {
                width: 28px;
                height: 28px;
            }
            .xbot-catalog-live-typing-label {
                line-height: 1;
            }
            .xbot-catalog-live-typing .xbot-typing-dots span {
                width: 5px;
                height: 5px;
            }
            .xbot-catalog-img,
            .xbot-text [data-xbot="catalog-grid"] img {
                width: 100%;
                height: 110px;
                object-fit: cover;
                display: block;
                margin: 0;
                border-radius: 0;
                background: #e2e8f0;
                flex-shrink: 0;
            }
            .xbot-catalog-photo-fallback {
                width: 100%;
                height: 110px;
                flex-shrink: 0;
                background: #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #94a3b8;
                font-size: 11px;
            }
            .xbot-catalog-body {
                padding: 8px 10px;
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            .xbot-catalog-title {
                font-size: 13px;
                line-height: 1.3;
                color: var(--xbot-ink);
            }
            .xbot-catalog-price {
                margin-top: 4px;
                font-size: 13px;
                color: var(--xbot-ink);
            }
            .xbot-catalog-desc {
                margin-top: 4px;
                font-size: 11px;
                color: var(--xbot-muted);
                line-height: 1.35;
            }
            .xbot-catalog-select {
                margin-top: auto;
                padding-top: 8px;
                font-size: 11px;
                font-weight: 600;
                color: #2563eb;
            }
            .xbot-catalog-card:hover,
            .xbot-text [data-xbot-card="catalog"]:hover {
                border-color: rgba(var(--xbot-theme-rgb), 0.55);
                box-shadow: 0 0 0 2px rgba(var(--xbot-theme-rgb), 0.18);
            }
            .xbot-catalog-card:focus-visible,
            .xbot-text [data-xbot-card="catalog"]:focus-visible {
                border-color: rgba(var(--xbot-theme-rgb), 0.7);
                box-shadow: 0 0 0 2px rgba(var(--xbot-theme-rgb), 0.28);
            }
            .xbot-catalog-card.is-selected,
            .xbot-catalog-card.is-disabled,
            .xbot-text [data-xbot-card="catalog"].is-selected,
            .xbot-text [data-xbot-card="catalog"].is-disabled {
                opacity: 0.72;
                pointer-events: none;
            }
            .xbot-catalog-more,
            .xbot-text [data-xbot-catalog-more] {
                display: block;
                margin: 4px 0 10px;
                padding: 10px 12px;
                border: 1px dashed #cbd5e1;
                border-radius: 10px;
                background: #fff;
                color: #1d4ed8;
                font-size: 13px;
                font-weight: 600;
                text-align: center;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
            }
            .xbot-catalog-more:hover,
            .xbot-text [data-xbot-catalog-more]:hover {
                border-color: rgba(var(--xbot-theme-rgb), 0.55);
                background: rgba(var(--xbot-theme-rgb), 0.06);
            }
            .xbot-catalog-more.is-disabled,
            .xbot-text [data-xbot-catalog-more].is-disabled {
                opacity: 0.55;
                pointer-events: none;
            }
            .xbot-reply-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
            }
            .xbot-reply-action {
                appearance: none;
                border: 1px solid rgba(var(--xbot-theme-rgb), 0.35);
                background: rgba(var(--xbot-theme-rgb), 0.08);
                color: var(--xbot-ink);
                border-radius: 999px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 600;
                line-height: 1.2;
                cursor: pointer;
                max-width: 100%;
                text-align: left;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                box-sizing: border-box;
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
            }
            .xbot-reply-action:hover {
                background: rgba(var(--xbot-theme-rgb), 0.16);
                border-color: rgba(var(--xbot-theme-rgb), 0.55);
            }
            .xbot-reply-action:active { transform: scale(0.98); }
            .xbot-reply-action:disabled,
            .xbot-reply-action[aria-disabled="true"] {
                opacity: 0.55;
                cursor: default;
                transform: none;
                pointer-events: none;
            }
            .xbot-message video {
                max-width: 100%;
                border-radius: var(--xbot-radius-md);
                display: block;
                margin: 4px 0 8px;
            }
            .xbot-time {
                font-size: 10px;
                line-height: 1;
                color: var(--xbot-subtle);
                padding: 0 2px;
                letter-spacing: 0.01em;
            }
            .xbot-message a {
                color: var(--xbot-theme);
                font-weight: 500;
                text-decoration: none;
                border-bottom: 1px solid rgba(var(--xbot-theme-rgb), 0.4);
            }
            .xbot-message a:hover { opacity: 0.85; }

            .xbot-typing {
                padding: 2px 6px 6px;
                display: flex;
                align-items: center;
                gap: 8px;
                min-height: 40px;
            }
            .xbot-think-face {
                display: block;
                flex-shrink: 0;
                overflow: visible;
                color: #00cfe8;
                filter: drop-shadow(0 0 4px rgba(0, 207, 232, 0.4));
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
                padding: 10px 14px 8px;
                border-top: none;
                background: var(--xbot-surface);
                flex-shrink: 0;
            }
            .xbot-compose-inner {
                display: flex;
                align-items: flex-end;
                gap: 4px;
                background: var(--xbot-surface);
                border: none;
                border-radius: 24px;
                padding: 4px 6px 4px 10px;
                box-shadow: var(--xbot-compose-shadow);
                transition: box-shadow 0.15s;
            }
            .xbot-compose-inner:focus-within {
                box-shadow: var(--xbot-compose-shadow), 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.12);
            }
            .xbot-compose-tools {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 0;
                flex-shrink: 0;
            }
            .xbot-icon-btn {
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 50%;
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
                background: rgba(239, 68, 68, 0.14);
                animation: xbot-rec-pulse 1.15s ease-in-out infinite;
            }
            .xbot-icon-btn.is-recording .xbot-rec-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: currentColor;
                margin-right: 2px;
                animation: xbot-rec-dot 1.15s ease-in-out infinite;
            }
            .xbot-icon-btn.is-uploading {
                color: var(--xbot-theme);
                background: rgba(var(--xbot-theme-rgb), 0.12);
                pointer-events: none;
                opacity: 0.9;
            }
            .xbot-icon-btn.is-uploading svg {
                animation: xbot-rec-spin 0.85s linear infinite;
            }
            @keyframes xbot-rec-pulse {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45);
                    transform: scale(1);
                }
                50% {
                    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                    transform: scale(1.07);
                }
            }
            @keyframes xbot-rec-dot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.35; transform: scale(0.75); }
            }
            @keyframes xbot-rec-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .xbot-audio-player {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 220px;
                max-width: 280px;
                padding: 6px 8px;
                border-radius: 12px;
                background: rgba(15, 23, 42, 0.04);
            }
            .xbot-message.user .xbot-audio-player {
                background: rgba(255, 255, 255, 0.18);
            }
            .xbot-audio-player audio { display: none; }
            .xbot-audio-play {
                width: 28px;
                height: 28px;
                border: none;
                border-radius: 50%;
                background: rgba(15, 23, 42, 0.08);
                color: var(--xbot-ink);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .xbot-message.user .xbot-audio-play {
                background: rgba(255, 255, 255, 0.25);
                color: inherit;
            }
            .xbot-audio-time {
                font-size: 11px;
                font-variant-numeric: tabular-nums;
                font-weight: 600;
                min-width: 32px;
                opacity: 0.85;
            }
            .xbot-audio-track {
                position: relative;
                flex: 1;
                height: 28px;
                display: flex;
                align-items: center;
                min-width: 0;
            }
            .xbot-audio-track-bg,
            .xbot-audio-track-fill {
                position: absolute;
                left: 0;
                right: 0;
                height: 3px;
                border-radius: 99px;
                background: rgba(15, 23, 42, 0.18);
            }
            .xbot-message.user .xbot-audio-track-bg {
                background: rgba(255, 255, 255, 0.35);
            }
            .xbot-audio-track-fill {
                right: auto;
                width: 0%;
                background: rgba(15, 23, 42, 0.55);
            }
            .xbot-message.user .xbot-audio-track-fill {
                background: rgba(255, 255, 255, 0.9);
            }
            .xbot-audio-track input[type="range"] {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 28px;
                opacity: 0;
                cursor: pointer;
                margin: 0;
            }
            .xbot-input {
                flex: 1;
                border: none;
                background: transparent;
                padding: 10px 4px;
                font-size: 16px;
                line-height: 1.45;
                resize: none;
                max-height: 120px;
                outline: none;
                font-family: inherit;
                color: var(--xbot-ink);
            }
            .xbot-input::placeholder { color: var(--xbot-subtle); }
            .xbot-send {
                width: 36px;
                height: 36px;
                flex-shrink: 0;
                border: none;
                border-radius: 50%;
                background: transparent;
                color: var(--xbot-subtle);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s, transform 0.12s;
            }
            .xbot-send:hover {
                color: var(--xbot-ink);
                background: rgba(15, 23, 42, 0.06);
            }
            .xbot-send:active { transform: scale(0.94); }
            .xbot-send:focus-visible {
                outline: 2px solid rgba(var(--xbot-theme-rgb), 0.55);
                outline-offset: 2px;
            }

            .xbot-footer {
                padding: 6px 14px calc(12px + env(safe-area-inset-bottom, 0px));
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

            @media screen and (min-width: 601px) and (max-width: 900px) {
                .xbot-chatbox {
                    width: min(27.5rem, calc(100vw - 2rem));
                    height: min(32rem, calc(100vh - ${offset + 24}px));
                    height: min(32rem, calc(100dvh - ${offset + 24}px));
                }
            }

            @media screen and (max-width: 600px) {
                .xbot-chatbox {
                    width: 100vw;
                    max-width: 100vw;
                    bottom: 0 !important;
                    ${posH}: 0 !important;
                    border-radius: 0;
                }
                .xbot-chatbox.is-open:not(.xbot-keyboard-open) {
                    top: 0;
                    bottom: 0 !important;
                    height: auto !important;
                    max-height: none !important;
                    border-radius: 0;
                }
                .xbot-chatbox.xbot-keyboard-open {
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    border-radius: 0 !important;
                    z-index: 2147483001;
                }
                .xbot-chatbox.xbot-keyboard-open .xbot-footer {
                    display: none !important;
                }
                .xbot-chatbox.xbot-keyboard-open .xbot-compose {
                    padding-bottom: 8px;
                }
                .xbot-header {
                    padding: 12px 14px;
                    padding-top: calc(12px + env(safe-area-inset-top, 0px));
                }
                .xbot-header-minimize {
                    width: 44px;
                    height: 44px;
                }
                .xbot-messages {
                    padding: 14px 12px;
                }
                .xbot-message-row.user { max-width: 88%; }
                .xbot-compose {
                    padding: 10px 12px 8px;
                }
                .xbot-icon-btn {
                    width: 44px;
                    height: 44px;
                }
                .xbot-send {
                    width: 44px;
                    height: 44px;
                }
                .xbot-input {
                    font-size: 16px;
                    padding: 12px 4px;
                }
                .xbot-footer {
                    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
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
            '<button type="button" class="xbot-header-minimize" aria-label="Recolher">' +
            XBOT_ICONS.collapse +
            '</button></div>' +
            '<div class="xbot-inactivity-bar" id="xbot-inactivity-bar" hidden role="status" aria-live="polite">' +
            '<div class="xbot-inactivity-text">' +
            '<span class="xbot-inactivity-icon" aria-hidden="true">⏱</span>' +
            '<span>A sessão encerra em <strong id="xbot-inactivity-countdown">1:00</strong></span>' +
            '</div>' +
            '<button type="button" class="xbot-inactivity-btn" id="xbot-inactivity-keep">' +
            'Manter conversa ativa' +
            '</button></div>' +
            '<div class="xbot-messages" id="xbot-messages">' +
            '<div class="xbot-empty" id="xbot-empty">' +
            '<p class="xbot-empty-text" id="xbot-empty-text"></p>' +
            '</div></div>' +
            '<div class="xbot-compose">' +
            '<div class="xbot-compose-inner">' +
            '<div class="xbot-compose-tools">' +
            '<button type="button" class="xbot-icon-btn" id="xbot-upload" aria-label="Anexar arquivo">' +
            XBOT_ICONS.attach +
            '</button>' +
            '<button type="button" class="xbot-icon-btn" id="xbot-audio" aria-label="Gravar áudio">' +
            XBOT_ICONS.mic +
            '</button></div>' +
            '<textarea class="xbot-input" id="xbot-input" placeholder="Ou envie uma mensagem…" rows="1"></textarea>' +
            '<button type="button" class="xbot-send" id="xbot-send" aria-label="Enviar" tabindex="-1">' +
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

        var chatCloseTimer = null;

        function plainWelcomeSnippet(text) {
            var plain = String(text || '')
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/\s+/g, ' ')
                .trim();
            if (plain.length > 140) plain = plain.slice(0, 137) + '…';
            return plain;
        }

        function ensureEmptyStateEl() {
            var container = document.getElementById('xbot-messages');
            if (!container) return null;
            var emptyEl = document.getElementById('xbot-empty');
            if (emptyEl) return emptyEl;
            emptyEl = document.createElement('div');
            emptyEl.className = 'xbot-empty';
            emptyEl.id = 'xbot-empty';
            var textEl = document.createElement('p');
            textEl.className = 'xbot-empty-text';
            textEl.id = 'xbot-empty-text';
            emptyEl.appendChild(textEl);
            container.insertBefore(emptyEl, container.firstChild);
            return emptyEl;
        }

        function clearMessageRows(container) {
            if (!container) return;
            var kids = Array.prototype.slice.call(container.children || []);
            for (var i = 0; i < kids.length; i++) {
                var el = kids[i];
                if (!el || el.id === 'xbot-empty') continue;
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        }

        function syncEmptyState() {
            var emptyEl = ensureEmptyStateEl();
            var textEl = document.getElementById('xbot-empty-text');
            if (!emptyEl || !textEl) return;
            var hasMessages = !!lastMessageRow();
            if (hasMessages) {
                emptyEl.hidden = true;
                return;
            }
            var welcome = plainWelcomeSnippet(getWelcomeText());
            textEl.textContent = welcome || ('Olá! Envie uma mensagem para falar com ' + botName + '.');
            emptyEl.hidden = false;
        }

        function setChatOpen(open) {
            if (chatCloseTimer) {
                clearTimeout(chatCloseTimer);
                chatCloseTimer = null;
            }
            chatbox.style.flexDirection = 'column';
            launcher.classList.toggle('is-open', open);
            launcher.classList.toggle('xbot-launcher--hidden', open);
            setViewportZoomLocked(!!open);
            launcher.setAttribute('aria-label', open ? 'Recolher chat' : 'Abrir chat');

            if (open) {
                chatbox.style.display = 'flex';
                chatbox.classList.add('is-open');
                syncEmptyState();
                // Força reflow antes da transição de entrada
                void chatbox.offsetWidth;
                chatbox.classList.add('is-visible');
                startSessionStatusPoll();
                ensureRealtimeTransport();
                sendVisitorPresence({ chat_open: true }, { force: true });
                unreadCount = 0;
                notification.textContent = '';
                notification.style.display = 'none';
                clearWelcomeAlertUi();
                scheduleScrollMessagesToBottom();
                if (isMobileLayout()) {
                    requestAnimationFrame(applyMobileKeyboardLayout);
                }
                var openInput = document.getElementById('xbot-input');
                if (openInput && typeof openInput.focus === 'function') openInput.focus();
            } else {
                var closeInput = document.getElementById('xbot-input');
                if (closeInput && typeof closeInput.blur === 'function' && document.activeElement === closeInput) {
                    closeInput.blur();
                }
                chatbox.classList.remove('is-visible');
                chatbox.classList.remove('is-open');
                stopSessionStatusPoll();
                pauseRealtimeTransportIdle();
                sendVisitorPresence({ chat_open: false }, { force: true });
                clearMobilePanelStyles();
                chatCloseTimer = setTimeout(function () {
                    chatCloseTimer = null;
                    if (!chatbox.classList.contains('is-open')) {
                        chatbox.style.display = 'none';
                    }
                }, 220);
            }
        }

        /** API pública: abrir/fechar painel (útil no lazy-load). */
        window.openXBot = function () {
            setChatOpen(true);
        };
        window.closeXBot = function () {
            setChatOpen(false);
        };

        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'hidden') {
                    // MOBA (browserNotify): mantém SSE para notificar em background.
                    if (!browserNotifyEnabled) {
                        pauseRealtimeTransportIdle();
                        stopSessionStatusPoll();
                    } else {
                        stopSessionStatusPoll();
                    }
                    sendVisitorPresence(
                        { page_visible: false, chat_open: isChatOpen() },
                        { force: true, keepalive: true }
                    );
                    return;
                }
                sendVisitorPresence(
                    { page_visible: true, chat_open: isChatOpen() },
                    { force: true }
                );
                if (isChatOpen()) {
                    startSessionStatusPoll();
                    ensureRealtimeTransport();
                }
            });
            window.addEventListener('focus', function () {
                sendVisitorPresence({ window_focused: true }, { force: true });
            });
            window.addEventListener('blur', function () {
                sendVisitorPresence({ window_focused: false }, { force: true });
            });
            window.addEventListener('pagehide', function () {
                sendVisitorPresence(
                    {
                        status: 'offline',
                        chat_open: false,
                        page_visible: false,
                        window_focused: false,
                    },
                    { force: true, keepalive: true }
                );
                stopPresenceHeartbeat();
            });
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
            setChatOpen(!chatbox.classList.contains('is-open'));
        });

        var minimizeBtn = chatbox.querySelector('.xbot-header-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', function (ev) {
                if (ev) {
                    if (typeof ev.preventDefault === 'function') ev.preventDefault();
                    if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
                }
                setChatOpen(false);
            });
        }

        const uploadBtn = document.getElementById('xbot-upload');
        const audioBtn = document.getElementById('xbot-audio');
        const input = document.getElementById('xbot-input');
        const messages = document.getElementById('xbot-messages');

        function focusMessageInput() {
            if (!isChatOpen() || !input || typeof input.focus !== 'function') return;
            var keep = function () {
                if (isChatOpen() && input) input.focus({ preventScroll: true });
            };
            keep();
            requestAnimationFrame(keep);
            // iOS às vezes só reaplica o foco após o ciclo do teclado
            setTimeout(keep, 0);
            setTimeout(keep, 50);
        }

        const send = chatbox.querySelector('#xbot-send');
        // Evita blur do input ao enviar (mantém teclado aberto no mobile)
        var sendFromTouch = false;
        send.addEventListener('mousedown', function (e) {
            e.preventDefault();
        });
        send.addEventListener('touchend', function (e) {
            e.preventDefault();
            sendFromTouch = true;
            handleSendMessage();
            focusMessageInput();
        });
        send.addEventListener('click', function () {
            if (sendFromTouch) {
                sendFromTouch = false;
                return;
            }
            handleSendMessage();
        });

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
            [
                'top', 'left', 'right', 'bottom', 'width', 'max-width',
                'height', 'max-height', 'border-radius'
            ].forEach(function (prop) {
                chatbox.style.removeProperty(prop);
            });
            // Launcher fica oculto enquanto o chat estiver aberto (evita X duplo).
            if (!chatbox.classList.contains('is-open')) {
                launcher.classList.remove('xbot-launcher--hidden');
            }
        }

        function applyMobileKeyboardLayout() {
            if (!isMobileLayout() || !chatbox.classList.contains('is-open')) {
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
            var height = Math.max(0, vv.height);
            // !important para vencer CSS de hosts fullscreen (ex.: MOBA)
            chatbox.style.setProperty('top', top + 'px', 'important');
            chatbox.style.setProperty('bottom', 'auto', 'important');
            chatbox.style.setProperty('left', '0', 'important');
            chatbox.style.setProperty('right', '0', 'important');
            chatbox.style.setProperty('width', '100%', 'important');
            chatbox.style.setProperty('max-width', '100%', 'important');
            chatbox.style.setProperty('height', height + 'px', 'important');
            chatbox.style.setProperty('max-height', height + 'px', 'important');
            chatbox.style.setProperty('border-radius', '0', 'important');
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

        function copyPlainText(value) {
            var text = String(value || '');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise(function (resolve, reject) {
                try {
                    var area = document.createElement('textarea');
                    area.value = text;
                    area.setAttribute('readonly', '');
                    area.style.position = 'fixed';
                    area.style.left = '-9999px';
                    document.body.appendChild(area);
                    area.select();
                    document.execCommand('copy');
                    document.body.removeChild(area);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }

        /** WhatsApp/Instagram (* _ ~) → Markdown para marked.parse. */
        function whatsappToMarkdown(text) {
            var s = String(text || '');
            var placeholders = [];
            s = s.replace(/\*\*([^*\n]+)\*\*/g, function (_, inner) {
                var idx = placeholders.length;
                placeholders.push('**' + inner + '**');
                return '\x00MD' + idx + '\x00';
            });
            s = s.replace(/\*([^*\n]+)\*/g, '**$1**');
            s = s.replace(/\x00MD(\d+)\x00/g, function (_, idx) {
                return placeholders[Number(idx)] || '';
            });
            s = s.replace(/_([^_\n]+)_/g, '*$1*');
            s = s.replace(/~([^~\n]+)~/g, '~~$1~~');
            return s;
        }

        function enhanceCopyableCode(root) {
            if (!root || !root.querySelectorAll) return;
            var nodes = root.querySelectorAll('pre');
            for (var i = 0; i < nodes.length; i++) {
                var pre = nodes[i];
                if (pre.closest('.xbot-code-box')) continue;
                var code = pre.querySelector('code') || pre;
                var value = String(code.innerText || '').trim();
                if (!value) continue;
                var box = document.createElement('div');
                box.className = 'xbot-code-box';
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'xbot-copy-btn';
                btn.setAttribute('title', 'Copiar');
                btn.innerHTML = XBOT_ICONS.copy + '<span class="xbot-copy-tooltip">Copiar</span>';
                btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var button = ev.currentTarget;
                    var tip = button.querySelector('.xbot-copy-tooltip');
                    var payload = button.getAttribute('data-copy') || '';
                    copyPlainText(payload).then(function () {
                        button.setAttribute('title', 'Copiado!');
                        if (tip) tip.textContent = 'Copiado!';
                        setTimeout(function () {
                            button.setAttribute('title', 'Copiar');
                            if (tip) tip.textContent = 'Copiar';
                        }, 2000);
                    }).catch(function () {});
                });
                btn.setAttribute('data-copy', value);
                pre.parentNode.insertBefore(box, pre);
                box.appendChild(btn);
                box.appendChild(pre);
            }
        }

        function mountReplyActions(host, actions, opts) {
            if (!host || !Array.isArray(actions) || !actions.length) return;
            // Grid de catálogo já oferece as opções nos cards.
            if (host.querySelector && host.querySelector('[data-xbot="catalog-grid"]')) return;
            var interactive = !opts || opts.interactive !== false;
            var group = document.createElement('div');
            group.className = 'xbot-reply-actions';
            group.setAttribute('role', 'group');
            group.setAttribute('aria-label', 'Opções');
            actions.forEach(function (action) {
                var isUrl = action && action.kind === 'url' && action.url;
                if (isUrl) {
                    var link = document.createElement('a');
                    link.className = 'xbot-reply-action xbot-reply-action--url';
                    link.textContent = action.label;
                    link.href = action.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    if (!interactive || sessionEpisodeEnded) {
                        link.setAttribute('aria-disabled', 'true');
                        link.addEventListener('click', function (ev) { ev.preventDefault(); });
                    }
                    group.appendChild(link);
                    return;
                }
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'xbot-reply-action';
                btn.textContent = action.label;
                if (!interactive || sessionEpisodeEnded) {
                    btn.disabled = true;
                } else {
                    btn.addEventListener('click', function () {
                        if (sessionEpisodeEnded) return;
                        var buttons = group.querySelectorAll('.xbot-reply-action');
                        for (var i = 0; i < buttons.length; i++) {
                            if (buttons[i].tagName === 'BUTTON') buttons[i].disabled = true;
                            else buttons[i].setAttribute('aria-disabled', 'true');
                        }
                        sendUserText(action.value);
                    });
                }
                group.appendChild(btn);
            });
            host.appendChild(group);
        }

        function enhanceCatalogGrid(root, opts) {
            if (!root || !root.querySelectorAll) return;
            var grid = root.querySelector('.xbot-catalog-grid, [data-xbot="catalog-grid"]');
            var cards = root.querySelectorAll('.xbot-catalog-card, [data-xbot-card="catalog"]');
            if (!cards.length) return;
            var interactive = !opts || opts.interactive !== false;
            var animateTyping = !!(opts && opts.animateTyping) && interactive && !sessionEpisodeEnded;
            var typingLocked = false;

            if (grid && !grid.classList.contains('xbot-catalog-grid')) {
                grid.classList.add('xbot-catalog-grid');
            }

            for (var c = 0; c < cards.length; c++) {
                if (!cards[c].classList.contains('xbot-catalog-card')) {
                    cards[c].classList.add('xbot-catalog-card');
                }
                if (cards[c].getAttribute('data-xbot-catalog-hidden') === '1') {
                    cards[c].classList.add('xbot-catalog-card--hidden');
                }
            }

            var imgs = root.querySelectorAll('.xbot-catalog-img, [data-xbot-catalog-img], .xbot-catalog-grid img, [data-xbot="catalog-grid"] img');
            for (var i = 0; i < imgs.length; i++) {
                (function (img) {
                    img.onerror = function () {
                        var ph = document.createElement('div');
                        ph.className = 'xbot-catalog-photo-fallback';
                        ph.textContent = 'Sem foto';
                        if (img.parentNode) img.parentNode.replaceChild(ph, img);
                    };
                })(imgs[i]);
            }

            var moreBtn = root.querySelector('.xbot-catalog-more, [data-xbot-catalog-more]');
            var introEl = null;
            var footerEl = null;
            var paragraphs = root.querySelectorAll(':scope > p');
            if (paragraphs.length) {
                introEl = paragraphs[0];
                if (paragraphs.length > 1) footerEl = paragraphs[paragraphs.length - 1];
            }
            function hiddenCards() {
                return root.querySelectorAll(
                    '.xbot-catalog-card--hidden, [data-xbot-card="catalog"][data-xbot-catalog-hidden="1"]'
                );
            }
            function updateMoreButton() {
                if (!moreBtn) return;
                var left = hiddenCards().length;
                if (left <= 0) {
                    if (moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn);
                    moreBtn = null;
                    return;
                }
                moreBtn.textContent = 'Ver mais produtos (+' + left + ')';
            }
            function scrollCatalog() {
                if (typeof scrollMessagesToBottom === 'function') scrollMessagesToBottom();
            }
            function setTypingLock(on) {
                typingLocked = !!on;
                if (on) root.classList.add('xbot-catalog-is-typing');
                else root.classList.remove('xbot-catalog-is-typing');
            }
            function showLiveTyping(label) {
                var el = root.querySelector('.xbot-catalog-live-typing');
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'xbot-catalog-live-typing';
                    if (grid && grid.parentNode) grid.parentNode.insertBefore(el, grid);
                    else root.appendChild(el);
                }
                stopThinkingFaceAnimation(el);
                el.innerHTML =
                    buildThinkingFaceHtml(28) +
                    '<span class="xbot-catalog-live-typing-label">' +
                    (label || 'pensando') +
                    '</span>';
                var face = el.querySelector('.xbot-think-face');
                if (face) startThinkingFaceAnimation(face);
                scrollCatalog();
                return el;
            }
            function hideLiveTyping() {
                var el = root.querySelector('.xbot-catalog-live-typing');
                if (el && el.parentNode) {
                    stopThinkingFaceAnimation(el);
                    el.parentNode.removeChild(el);
                }
            }
            function typeText(el, fullText, done) {
                if (!el) {
                    if (done) done();
                    return;
                }
                var text = String(fullText || '');
                el.textContent = '';
                el.classList.add('xbot-catalog-typecursor');
                var idx = 0;
                var step = Math.max(1, Math.floor(text.length / 40));
                function tick() {
                    if (sessionEpisodeEnded) {
                        el.textContent = text;
                        el.classList.remove('xbot-catalog-typecursor');
                        if (done) done();
                        return;
                    }
                    idx = Math.min(text.length, idx + step);
                    el.textContent = text.slice(0, idx);
                    scrollCatalog();
                    if (idx >= text.length) {
                        el.classList.remove('xbot-catalog-typecursor');
                        if (done) done();
                        return;
                    }
                    setTimeout(tick, 18);
                }
                tick();
            }
            function revealCard(card) {
                card.classList.remove('xbot-catalog-card--pending');
                card.classList.remove('xbot-catalog-card--hidden');
                card.removeAttribute('data-xbot-catalog-hidden');
                card.style.display = '';
                card.classList.remove('xbot-catalog-card--reveal');
                // force reflow for animation restart
                void card.offsetWidth;
                card.classList.add('xbot-catalog-card--reveal');
                if (!card.hasAttribute('tabindex') && interactive) card.setAttribute('tabindex', '0');
                scrollCatalog();
            }
            function revealCardsSequentially(queue, onDone) {
                var list = Array.prototype.slice.call(queue || []);
                var n = 0;
                function next() {
                    if (sessionEpisodeEnded) {
                        for (var s = n; s < list.length; s++) revealCard(list[s]);
                        if (onDone) onDone();
                        return;
                    }
                    if (n >= list.length) {
                        if (onDone) onDone();
                        return;
                    }
                    showLiveTyping('montando opções');
                    setTimeout(function () {
                        hideLiveTyping();
                        revealCard(list[n]);
                        n += 1;
                        setTimeout(next, 120);
                    }, 220);
                }
                next();
            }
            function revealMore() {
                if (!interactive || sessionEpisodeEnded || typingLocked) return;
                var pageSize = parseInt(
                    (moreBtn && (moreBtn.getAttribute('data-xbot-page-size') || moreBtn.getAttribute('data-page-size'))) || '8',
                    10
                );
                if (!pageSize || pageSize < 1) pageSize = 8;
                var hidden = Array.prototype.slice.call(hiddenCards(), 0, pageSize);
                if (!hidden.length) {
                    updateMoreButton();
                    return;
                }
                setTypingLock(true);
                if (moreBtn) moreBtn.classList.add('xbot-catalog-ui--pending');
                revealCardsSequentially(hidden, function () {
                    if (moreBtn) moreBtn.classList.remove('xbot-catalog-ui--pending');
                    updateMoreButton();
                    setTypingLock(false);
                    scrollCatalog();
                });
            }
            function disableAll() {
                for (var j = 0; j < cards.length; j++) {
                    cards[j].classList.add('is-disabled');
                    cards[j].setAttribute('aria-disabled', 'true');
                    cards[j].removeAttribute('tabindex');
                }
                if (moreBtn) {
                    moreBtn.classList.add('is-disabled');
                    moreBtn.setAttribute('aria-disabled', 'true');
                    moreBtn.removeAttribute('tabindex');
                }
            }
            function selectCard(card) {
                if (!interactive || sessionEpisodeEnded || typingLocked) return;
                if (
                    card.classList.contains('xbot-catalog-card--hidden') ||
                    card.classList.contains('xbot-catalog-card--pending')
                ) {
                    return;
                }
                var value = (card.getAttribute('data-xbot-value') || '').trim();
                if (!value) {
                    var strong = card.querySelector('strong');
                    value = strong ? String(strong.textContent || '').trim() : '';
                }
                if (!value) return;
                card.classList.add('is-selected');
                disableAll();
                sendUserText(value);
            }

            root.addEventListener('click', function (ev) {
                if (!interactive || sessionEpisodeEnded || typingLocked || !ev || !ev.target) return;
                var more = ev.target.closest
                    ? ev.target.closest('.xbot-catalog-more, [data-xbot-catalog-more]')
                    : null;
                if (more && root.contains(more)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    revealMore();
                    return;
                }
                var card = ev.target.closest
                    ? ev.target.closest('.xbot-catalog-card, [data-xbot-card="catalog"]')
                    : null;
                if (card && root.contains(card)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    selectCard(card);
                }
            });
            root.addEventListener('keydown', function (ev) {
                if (!interactive || sessionEpisodeEnded || typingLocked || !ev || !ev.target) return;
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                var more = ev.target.closest
                    ? ev.target.closest('.xbot-catalog-more, [data-xbot-catalog-more]')
                    : null;
                if (more && root.contains(more)) {
                    ev.preventDefault();
                    revealMore();
                    return;
                }
                var card = ev.target.closest
                    ? ev.target.closest('.xbot-catalog-card, [data-xbot-card="catalog"]')
                    : null;
                if (card && root.contains(card)) {
                    ev.preventDefault();
                    selectCard(card);
                }
            });

            for (var k = 0; k < cards.length; k++) {
                cards[k].setAttribute('role', 'button');
                if (!cards[k].hasAttribute('tabindex') && !cards[k].classList.contains('xbot-catalog-card--hidden')) {
                    cards[k].setAttribute('tabindex', '0');
                }
                if (!interactive || sessionEpisodeEnded) {
                    cards[k].classList.add('is-disabled');
                    cards[k].setAttribute('aria-disabled', 'true');
                    cards[k].removeAttribute('tabindex');
                }
            }
            if (moreBtn) {
                if (!moreBtn.classList.contains('xbot-catalog-more')) {
                    moreBtn.classList.add('xbot-catalog-more');
                }
                moreBtn.setAttribute('role', 'button');
                if (!moreBtn.hasAttribute('tabindex')) moreBtn.setAttribute('tabindex', '0');
                if (!interactive || sessionEpisodeEnded) {
                    moreBtn.classList.add('is-disabled');
                    moreBtn.setAttribute('aria-disabled', 'true');
                    moreBtn.removeAttribute('tabindex');
                }
            }

            if (!animateTyping) return;

            var initialQueue = [];
            for (var q = 0; q < cards.length; q++) {
                if (cards[q].classList.contains('xbot-catalog-card--hidden')) continue;
                cards[q].classList.add('xbot-catalog-card--pending');
                cards[q].removeAttribute('tabindex');
                initialQueue.push(cards[q]);
            }
            if (moreBtn) moreBtn.classList.add('xbot-catalog-ui--pending');
            if (footerEl) footerEl.classList.add('xbot-catalog-ui--pending');

            setTypingLock(true);
            var introText = introEl ? String(introEl.textContent || '').trim() : '';
            showLiveTyping('digitando');
            typeText(introEl, introText || 'Encontrei estas opções no catálogo:', function () {
                hideLiveTyping();
                revealCardsSequentially(initialQueue, function () {
                    if (moreBtn) moreBtn.classList.remove('xbot-catalog-ui--pending');
                    if (footerEl) footerEl.classList.remove('xbot-catalog-ui--pending');
                    setTypingLock(false);
                    scrollCatalog();
                });
            });
        }

        function prefersReducedMotion() {
            try {
                return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            } catch (e) {
                return false;
            }
        }

        var botTypewriterQueue = [];
        var botTypewriterBusy = false;

        function enqueueBotTypewriter(task) {
            botTypewriterQueue.push(task);
            pumpBotTypewriterQueue();
        }

        function pumpBotTypewriterQueue() {
            if (botTypewriterBusy) return;
            var next = botTypewriterQueue.shift();
            if (!next) return;
            botTypewriterBusy = true;
            next(function () {
                botTypewriterBusy = false;
                pumpBotTypewriterQueue();
            });
        }

        /**
         * Digita texto plano no elemento e, ao terminar, troca pelo HTML final (markdown).
         * Usado no welcome/abertura MOBA e nas respostas do bot (não-catálogo).
         */
        function runBotTypewriter(textEl, plainText, finalHtml, onDone) {
            if (!textEl) {
                if (onDone) onDone();
                return;
            }
            var text = String(plainText || '');
            var html = String(finalHtml || '');
            function finish() {
                textEl.classList.remove('xbot-typecursor');
                textEl.innerHTML = html;
                if (typeof scrollMessagesToBottom === 'function') scrollMessagesToBottom();
                if (onDone) onDone();
            }
            if (!text || prefersReducedMotion() || sessionEpisodeEnded) {
                finish();
                return;
            }
            textEl.textContent = '';
            textEl.classList.add('xbot-typecursor');
            var idx = 0;
            // ~18ms/char, no máx. ~2.4s; mensagens longas avançam em blocos.
            var targetTicks = Math.max(12, Math.min(120, Math.ceil(text.length / 2)));
            var step = Math.max(1, Math.ceil(text.length / targetTicks));
            var delay = 18;
            function tick() {
                if (sessionEpisodeEnded) {
                    finish();
                    return;
                }
                idx = Math.min(text.length, idx + step);
                textEl.textContent = text.slice(0, idx);
                if (typeof scrollMessagesToBottom === 'function') scrollMessagesToBottom();
                if (idx >= text.length) {
                    finish();
                    return;
                }
                setTimeout(tick, delay);
            }
            tick();
        }

        function appendMessage(text, from, opts) {
            if (from === undefined) from = 'user';
            opts = opts || {};
            const row = document.createElement('div');
            row.className = `xbot-message-row ${from}`;
            var hasCatalogGrid = from === 'bot' && String(text || '').indexOf('data-xbot="catalog-grid"') !== -1;
            if (hasCatalogGrid) row.classList.add('xbot-message-row--catalog');
            if (from === 'bot' && botAvatar) {
                if (shouldShowBotAvatar()) {
                    const av = document.createElement('img');
                    av.className = 'xbot-msg-avatar';
                    av.src = botAvatar;
                    av.alt = '';
                    row.appendChild(av);
                } else {
                    row.classList.add('xbot-message-row--no-avatar');
                }
            }
            const col = document.createElement('div');
            col.className = 'xbot-message-col';
            const msg = document.createElement('div');
            msg.className = `xbot-message ${from}`;
            if (opts.domNode) {
                var contentWrap = document.createElement('div');
                contentWrap.className = 'xbot-message-content';
                var textWrap = document.createElement('div');
                textWrap.className = 'xbot-text';
                textWrap.appendChild(opts.domNode);
                contentWrap.appendChild(textWrap);
                msg.appendChild(contentWrap);
                if (from === 'bot') {
                    mountReplyActions(contentWrap, opts.actions || [], opts);
                }
            } else {
            var unsafeHTML;
            var treatAsHtml = !!opts.rawHtml
                || (from === 'bot' && /<\s*(?:p|div|ul|ol|table|strong|img)\b/i.test(String(text || '')));
            if (treatAsHtml) {
                unsafeHTML = text;
            } else {
                unsafeHTML = window.marked.parse(whatsappToMarkdown(text));
            }
            var sanitized = window.DOMPurify.sanitize(unsafeHTML, {
                ADD_TAGS: ['video', 'source'],
                ADD_ATTR: [
                    'controls', 'playsinline', 'preload', 'src', 'style', 'loading', 'alt',
                    'role', 'tabindex', 'data-xbot', 'data-xbot-card', 'data-xbot-value',
                    'data-xbot-catalog-img', 'data-xbot-catalog-hidden', 'data-xbot-catalog-more',
                    'data-xbot-page-size'
                ]
            });
            var shouldType = from === 'bot'
                && !!opts.animateTyping
                && !hasCatalogGrid
                && !prefersReducedMotion()
                && !sessionEpisodeEnded;
            msg.innerHTML = `
                <div class="xbot-message-content">
                    <div class="xbot-text">${shouldType ? '' : sanitized}</div>
                </div>
            `;
            if (from === 'bot') {
                var textRoot = msg.querySelector('.xbot-text');
                if (shouldType && textRoot) {
                    var plainProbe = document.createElement('div');
                    plainProbe.innerHTML = sanitized;
                    var plainText = String(plainProbe.textContent || '').replace(/\s+\n/g, '\n').trim();
                    var actions = opts.actions || [];
                    enqueueBotTypewriter(function (done) {
                        runBotTypewriter(textRoot, plainText, sanitized, function () {
                            enhanceCopyableCode(textRoot);
                            mountReplyActions(msg.querySelector('.xbot-message-content'), actions, opts);
                            done();
                        });
                    });
                } else {
                    enhanceCopyableCode(textRoot);
                    enhanceCatalogGrid(textRoot, opts);
                    mountReplyActions(msg.querySelector('.xbot-message-content'), opts.actions || [], opts);
                }
            }
            }
            const timeEl = document.createElement('div');
            timeEl.className = 'xbot-time';
            timeEl.textContent = formatMessageTime();
            col.appendChild(msg);
            col.appendChild(timeEl);
            row.appendChild(col);
            messages.appendChild(row);
            syncEmptyState();
            if (opts.scroll !== false) {
                scrollMessagesToBottom();
            }

            var countUnread = opts.countUnread !== false;
            if (from === 'bot' && countUnread && !isChatOpen()) {
                unreadCount++;
                notification.textContent = String(unreadCount);
                notification.style.display = 'flex';
                notificationSound.play().catch(function () {});
            }
            if (from === 'bot' && countUnread) {
                notifyBrowserIncoming(opts.domNode ? 'Áudio' : text);
            }
        }

        async function sendUserText(text) {
            const value = String(text || '').trim();
            if (!value) return;

            resumeRealtimeAfterUserSend();
            beginNewEpisodeFromUserMessage();
            appendMessage(value, 'user');
            if (input) {
                input.value = '';
                input.style.height = 'auto';
            }
            focusMessageInput();
            pollSessionInactivity();

            try {
                const visitorId = getVisitorId();
                const msgBody = attachIdentityToMessageBody({ message: value });
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
                sendVisitorPresence({ chat_open: true, page_visible: true }, { force: true });
                if (data.reply) {
                    var replyText = String(data.reply).trim();
                    if (replyText) ingestBotPayload(null, replyText, 'post');
                    else clearPendingTyping();
                } else if (data.bot_reply_enabled) {
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
            } finally {
                focusMessageInput();
            }
        }

        async function handleSendMessage() {
            const text = input.value.trim();
            if (!text) return;
            await sendUserText(text);
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
            attachIdentityToFormData(formData);
        
            const previewRow = document.createElement('div');
            previewRow.className = 'xbot-message-row user';
            const previewCol = document.createElement('div');
            previewCol.className = 'xbot-message-col';
            const preview = document.createElement('div');
            preview.className = 'xbot-message user';
            if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '100%';
            img.style.borderRadius = '10px';
            preview.appendChild(img);
            } else if (file.type.startsWith('video/')) {
            const vidEl = document.createElement('video');
            vidEl.src = URL.createObjectURL(file);
            vidEl.controls = true;
            vidEl.style.maxWidth = '100%';
            vidEl.style.borderRadius = '10px';
            preview.appendChild(vidEl);
            } else {
            preview.textContent = 'Anexo: ' + file.name;
            }
            const previewTime = document.createElement('div');
            previewTime.className = 'xbot-time';
            previewTime.textContent = formatMessageTime();
            previewCol.appendChild(preview);
            previewCol.appendChild(previewTime);
            previewRow.appendChild(previewCol);
            messages.appendChild(previewRow);
            syncEmptyState();
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
            appendMessage('Arquivo recebido: [' + file.name + '](' + (data.url || '#') + ')', 'bot');
            } catch (err) {
            appendMessage('Erro ao enviar o arquivo.', 'bot');
            }
            messages.scrollTop = messages.scrollHeight;
        });
        
        // Gravação de Áudio
        let mediaRecorder;
        let chunks = [];
        let isRecording = false;
        let isUploadingAudio = false;
        let recordingStream = null;

        function setAudioBtnIdle() {
            audioBtn.classList.remove('is-recording', 'is-uploading');
            audioBtn.innerHTML = XBOT_ICONS.mic;
            audioBtn.setAttribute('aria-label', 'Gravar áudio');
            audioBtn.disabled = false;
        }

        function setAudioBtnRecording() {
            audioBtn.classList.remove('is-uploading');
            audioBtn.classList.add('is-recording');
            audioBtn.innerHTML = XBOT_ICONS.stop;
            audioBtn.setAttribute('aria-label', 'Parar gravação');
            audioBtn.disabled = false;
        }

        function setAudioBtnUploading() {
            audioBtn.classList.remove('is-recording');
            audioBtn.classList.add('is-uploading');
            audioBtn.innerHTML = XBOT_ICONS.spinner;
            audioBtn.setAttribute('aria-label', 'Enviando áudio');
            audioBtn.disabled = true;
        }

        function pickRecorderMime() {
            if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
                return { mimeType: '', filename: 'audio.webm', blobType: 'audio/webm' };
            }
            var candidates = [
                { mimeType: 'audio/webm;codecs=opus', filename: 'audio.webm', blobType: 'audio/webm' },
                { mimeType: 'audio/webm', filename: 'audio.webm', blobType: 'audio/webm' },
                { mimeType: 'audio/mp4', filename: 'audio.m4a', blobType: 'audio/mp4' },
                { mimeType: 'audio/ogg;codecs=opus', filename: 'audio.ogg', blobType: 'audio/ogg' },
            ];
            for (var i = 0; i < candidates.length; i++) {
                if (MediaRecorder.isTypeSupported(candidates[i].mimeType)) return candidates[i];
            }
            return { mimeType: '', filename: 'audio.webm', blobType: 'audio/webm' };
        }

        audioBtn.addEventListener('click', async () => {
            if (isUploadingAudio) return;
            if (isRecording) {
                isUploadingAudio = true;
                try { mediaRecorder.stop(); } catch (e) { /* ignore */ }
                isRecording = false;
                setAudioBtnUploading();
                return;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Seu navegador não suporta gravação de áudio.');
                return;
            }

            try {
                recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                var picked = pickRecorderMime();
                mediaRecorder = picked.mimeType
                    ? new MediaRecorder(recordingStream, { mimeType: picked.mimeType })
                    : new MediaRecorder(recordingStream);
                chunks = [];

                mediaRecorder.ondataavailable = e => {
                    if (e.data && e.data.size) chunks.push(e.data);
                };
                mediaRecorder.onstop = async () => {
                    resumeRealtimeAfterUserSend();
                    beginNewEpisodeFromUserMessage();
                    if (recordingStream) {
                        try {
                            recordingStream.getTracks().forEach(function (t) { t.stop(); });
                        } catch (e) { /* ignore */ }
                        recordingStream = null;
                    }
                    var blobType = (mediaRecorder && mediaRecorder.mimeType) || picked.blobType || 'audio/webm';
                    const blob = new Blob(chunks, { type: blobType.split(';')[0] });
                    const formData = new FormData();
                    formData.append('file', blob, picked.filename || 'audio.webm');

                    setAudioBtnUploading();
                    appendMessage('', 'user', { domNode: createXbotAudioPlayer(URL.createObjectURL(blob)) });

                    try {
                        if (window.__xbotConfig.channelId) {
                            formData.append('channel_id', window.__xbotConfig.channelId);
                        }
                        var vid = getVisitorId();
                        if (vid) formData.append('visitor_id', vid);
                        attachIdentityToFormData(formData);
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
                    } finally {
                        isUploadingAudio = false;
                        setAudioBtnIdle();
                    }
                    messages.scrollTop = messages.scrollHeight;
                };

                mediaRecorder.start(250);
                isRecording = true;
                isUploadingAudio = false;
                setAudioBtnRecording();
            } catch (err) {
                if (recordingStream) {
                    try { recordingStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
                    recordingStream = null;
                }
                setAudioBtnIdle();
                alert('Erro ao iniciar gravação de áudio.');
            }
        });

        setTimeout(function () {
            deliverWelcomeOnPageLoad();
        }, 500);

        installBrowserNotifyPermissionPrompt();
        installXbotNotifyAudioUnlock();

        syncEmptyState();
        startPresenceHeartbeat();

        widgetLog('UI pronta', {
            visitorId: getVisitorId(),
            channelId: channelId,
            browserNotify: browserNotifyEnabled,
            transporte: 'sse-primary (poll fallback; idle até abrir o chat)',
        });
        // Sem poll/SSE no pageload: só quando o visitante abre o chat (e a aba está visível).
        // Com browserNotify (MOBA), o SSE permanece ativo também em background.
    });


  })();

 