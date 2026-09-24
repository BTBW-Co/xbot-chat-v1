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
              typingSpeed:
                data.typing_speed === 'medium' || data.typing_speed === 'slow' || data.typing_speed === 'fast'
                  ? data.typing_speed
                  : (cfg.typingSpeed || 'fast'),
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
    function ensureXbotNotifyAudioCtx() {
        if (typeof window === 'undefined') return null;
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        try {
            xbotNotifyAudioCtx = xbotNotifyAudioCtx || new AudioContextClass();
        } catch (e) {
            return null;
        }
        return xbotNotifyAudioCtx;
    }
    /** Desbloqueia Web Audio (iOS/Safari exige gesto; resume é async). */
    function unlockXbotNotifyAudio() {
        var ctx = ensureXbotNotifyAudioCtx();
        if (!ctx) return;
        try {
            if (ctx.state === 'suspended') {
                ctx.resume().catch(function () {});
            }
            // Tick silencioso: ajuda o Safari a marcar o contexto como “usado” após o gesto.
            if (ctx.state === 'running' || ctx.state === 'suspended') {
                var buffer = ctx.createBuffer(1, 1, 22050);
                var source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
            }
        } catch (e) { /* áudio bloqueado */ }
    }
    function installXbotNotifyAudioUnlock() {
        if (xbotNotifyAudioUnlockInstalled || typeof window === 'undefined') return;
        if (!(window.AudioContext || window.webkitAudioContext)) return;
        xbotNotifyAudioUnlockInstalled = true;
        // capture: true — gestos no vídeo (stopPropagation no bubble) ainda desbloqueiam.
        var opts = { capture: true, passive: true };
        window.addEventListener('pointerdown', unlockXbotNotifyAudio, opts);
        window.addEventListener('touchstart', unlockXbotNotifyAudio, opts);
        window.addEventListener('keydown', unlockXbotNotifyAudio, { capture: true });
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible') unlockXbotNotifyAudio();
            });
        }
    }
    function emitXbotNotifyBeep(context) {
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
    }
    function playAppNotificationSound() {
        if (typeof window === 'undefined') return;
        installXbotNotifyAudioUnlock();
        try {
            var context = ensureXbotNotifyAudioCtx();
            if (!context) return;
            var play = function () {
                if (context.state !== 'running') return;
                emitXbotNotifyBeep(context);
            };
            // iOS: oscillators agendados com contexto suspended não tocam — espera o resume.
            if (context.state === 'suspended') {
                context.resume().then(play).catch(function () {});
                return;
            }
            play();
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
            typingSpeed = 'fast',
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

        function getVisitorClientHints() {
            var out = {};
            var ctx = getXbotContextPayload() || {};
            if (ctx.pageUrl) out.page_url = String(ctx.pageUrl).slice(0, 2000);
            if (ctx.pageTitle) out.page_title = String(ctx.pageTitle).slice(0, 255);
            try {
                if (typeof document !== 'undefined' && document.referrer) {
                    out.referrer = String(document.referrer).slice(0, 2000);
                }
            } catch (e) { /* ignore */ }
            try {
                var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (tz) out.tz = String(tz).slice(0, 80);
            } catch (e) { /* ignore */ }
            try {
                if (typeof navigator !== 'undefined' && navigator.language) {
                    out.lang = String(navigator.language).slice(0, 80);
                }
            } catch (e) { /* ignore */ }
            return out;
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

        function getMediaDownloadUrl() {
            if (!apiBaseUrl || !apiBaseUrl.trim()) return '';
            return apiBaseUrl.replace(/\/$/, '') + '/v1/xchat/download';
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
        var presentationLockCount = 0;
        var choiceComposerLockCount = 0;
        var sleepComposerLocked = false;
        var visitorHasSpoken = false;

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
            visitorHasSpoken = false;
            presentationLockCount = 0;
            choiceComposerLockCount = 0;
            sleepComposerLocked = false;
            setPresentationComposerLocked(false);
            setChoiceComposerLocked(false);
            setSleepComposerLocked(false);
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
            if (status && typeof status.composer_locked === 'boolean') {
                applyComposerLockedFlag(status.composer_locked);
            }
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
        var pendingTypingSafetyTimer = 0;
        var TYPING_SAFETY_MS = 15 * 60 * 1000;

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

        function beginWaitingForBot() {
            pendingSendCount = 1;
            _moveOrShowTyping();
            if (pendingTypingSafetyTimer) clearTimeout(pendingTypingSafetyTimer);
            pendingTypingSafetyTimer = setTimeout(function () {
                pendingTypingSafetyTimer = 0;
                pendingSendCount = 0;
                clearPendingTyping();
            }, TYPING_SAFETY_MS);
        }

        function finishWaitingForBot() {
            if (pendingTypingSafetyTimer) {
                clearTimeout(pendingTypingSafetyTimer);
                pendingTypingSafetyTimer = 0;
            }
            pendingSendCount = 0;
            clearPendingTyping();
        }

        function isKeepsTypingPayload(meta) {
            if (!meta || typeof meta !== 'object') return false;
            return meta.keeps_typing === true || meta.lab_progress === true;
        }

        function isLabProgressPayload(meta) {
            if (!meta || typeof meta !== 'object') return false;
            return meta.lab_progress === true || meta.progress_kind === 'media_download';
        }

        var pendingDownloadStatus = false;

        function thinkingStatusWords() {
            var lang = xbotUiLang();
            if (pendingDownloadStatus) {
                if (lang === 'pt') return ['Baixando', 'Baixando vídeo', 'Quase lá'];
                if (lang === 'es') return ['Descargando', 'Descargando vídeo', 'Casi listo'];
                return ['Downloading', 'Downloading video', 'Almost there'];
            }
            if (lang === 'pt') return ['Explorando', 'Refletindo', 'Pensando', 'Editando', 'Planejando'];
            if (lang === 'es') return ['Explorando', 'Reflexionando', 'Pensando', 'Editando', 'Planificando'];
            return ['Exploring', 'Thought', 'Thinking', 'Editing', 'Planning'];
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
            stopThinkingStatusCycle(root);
        }

        function xbotUiLang() {
            var raw = '';
            try {
                raw = String(
                    (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || ''
                ).toLowerCase();
            } catch (e) {
                raw = '';
            }
            if (raw.indexOf('pt') === 0) return 'pt';
            if (raw.indexOf('es') === 0) return 'es';
            return 'en';
        }

        function stopThinkingStatusCycle(el) {
            if (!el) return;
            if (el._xbThinkStatusTimer) {
                clearInterval(el._xbThinkStatusTimer);
                el._xbThinkStatusTimer = 0;
            }
            if (el._xbThinkStatusSwap) {
                clearTimeout(el._xbThinkStatusSwap);
                el._xbThinkStatusSwap = 0;
            }
        }

        function startThinkingStatusCycle(el) {
            if (!el) return;
            var label = el.querySelector ? el.querySelector('.xbot-think-status') : null;
            if (!label) return;
            if (el._xbThinkStatusTimer) return;
            var words = thinkingStatusWords();
            var i = Math.floor(Math.random() * words.length);
            function applyWord() {
                label.textContent = words[i];
                el.setAttribute('aria-label', words[i]);
            }
            applyWord();
            el._xbThinkStatusTimer = setInterval(function () {
                if (!el.isConnected) {
                    stopThinkingStatusCycle(el);
                    return;
                }
                i = (i + 1) % words.length;
                label.classList.add('is-swap');
                el._xbThinkStatusSwap = setTimeout(function () {
                    el._xbThinkStatusSwap = 0;
                    if (!label.isConnected) return;
                    applyWord();
                    label.classList.remove('is-swap');
                }, 160);
            }, 1700);
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
                el.innerHTML = buildThinkingFaceHtml(36) + '<span class="xbot-think-status"></span>';
                container.appendChild(el);
                pendingTypingEl = el;
                var face = el.querySelector('.xbot-think-face');
                if (face) startThinkingFaceAnimation(face);
                startThinkingStatusCycle(el);
            }
            scrollMessagesToBottom();
        }

        function parseLinkOnlyMessage(text) {
            var raw = String(text || '').trim();
            if (!raw) return null;
            var md = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
            if (md) {
                return { title: md[1].trim(), url: md[2].trim() };
            }
            var lines = raw.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
            var urlRe = /^https?:\/\/[^\s]+$/i;
            if (lines.length === 1 && urlRe.test(lines[0])) {
                return { title: '', url: lines[0].replace(/[.,;:]+$/, '') };
            }
            if (lines.length === 2 && urlRe.test(lines[1]) && !urlRe.test(lines[0])) {
                return { title: lines[0], url: lines[1].replace(/[.,;:]+$/, '') };
            }
            return null;
        }

        function canonicalLinkUrl(url) {
            try {
                var parsed = new URL(String(url || '').trim());
                var path = parsed.pathname || '/';
                if (path !== '/' && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';
                return parsed.protocol.toLowerCase() + '//' + parsed.hostname.toLowerCase() + path + parsed.search + parsed.hash;
            } catch (err) {
                return String(url || '').trim();
            }
        }

        function linkCardHost(url) {
            try {
                return new URL(url).hostname.replace(/^www\./, '');
            } catch (err) {
                return url;
            }
        }

        function buildLinkCardNode(link) {
            var card = document.createElement('a');
            card.className = 'xbot-link-card';
            card.href = link.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            var kicker = document.createElement('span');
            kicker.className = 'xbot-link-card-kicker';
            kicker.textContent = 'Link';
            var title = document.createElement('span');
            title.className = 'xbot-link-card-title';
            title.textContent = link.title || linkCardHost(link.url);
            var host = document.createElement('span');
            host.className = 'xbot-link-card-url';
            host.textContent = linkCardHost(link.url);
            card.appendChild(kicker);
            card.appendChild(title);
            card.appendChild(host);
            return card;
        }

        function ingestBotPayload(item, content, source) {
            var body = (content || '').trim();
            var meta = (item && item.metadata && typeof item.metadata === 'object') ? item.metadata : {};
            var ct = (item && item.content_type ? String(item.content_type) : 'text').toLowerCase();
            var mediaUrl = meta.media_url || '';
            var isMedia = !!mediaUrl && (ct === 'image' || ct === 'file' || ct === 'video' || ct === 'audio');
            var actions = extractReplyActions(meta);
            var blocks = extractStructuredBlocks(meta);
            var linkOnly = !isMedia ? parseLinkOnlyMessage(body) : null;
            if (linkOnly && seenBotMessageKeys['link:' + canonicalLinkUrl(linkOnly.url)]) return;
            if (!body && !isMedia && !blocks.length && !actions.length) return;
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
            var keepTyping = isKeepsTypingPayload(meta);
            if (isLabProgressPayload(meta)) {
                pendingDownloadStatus = true;
                beginWaitingForBot();
                if (pendingTypingEl) {
                    stopThinkingStatusCycle(pendingTypingEl);
                    startThinkingStatusCycle(pendingTypingEl);
                }
                rememberBotMessage(item, dedupKey);
                if (item && item.id) saveLastBotMessageId(item.id);
                return;
            }
            if (!keepTyping) {
                pendingDownloadStatus = false;
                finishWaitingForBot();
            }
            // history/hydrate: instantâneo; opening/sse/poll/post: typewriter
            var animateTyping = source !== 'history' && source !== 'hydrate' && !linkOnly;
            if (isMedia) {
                appendBotMedia(ct, mediaUrl, body, meta, {
                    countUnread: source !== 'history' && source !== 'opening',
                    actions: actions,
                    blocks: blocks,
                    interactive: source !== 'history' && source !== 'opening',
                    animateTyping: false,
                    messageId: item && item.id ? item.id : null,
                    presentationOpening: source === 'opening' || (
                        source !== 'history' && source !== 'hydrate' && isPresentationOpeningMeta(meta)
                    ),
                    tapToUnmute: source !== 'history' && source !== 'hydrate' && isTapToUnmuteMeta(meta),
                    waitUntilVideoEnds: source !== 'history' && source !== 'hydrate' && isWaitUntilVideoEndsMeta(meta)
                });
            } else {
                appendMessage(body, 'bot', {
                    countUnread: source !== 'history' && source !== 'opening',
                    actions: actions,
                    blocks: blocks,
                    interactive: source !== 'history' && source !== 'opening',
                    animateTyping: animateTyping,
                    linkCard: linkOnly || null
                });
            }
            rememberBotMessage(item, dedupKey);
            if (linkOnly) seenBotMessageKeys['link:' + canonicalLinkUrl(linkOnly.url)] = 1;
            if (item && item.id) saveLastBotMessageId(item.id);
            if (keepTyping && pendingSendCount > 0) _moveOrShowTyping();
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

        function extractStructuredBlocks(meta) {
            if (!meta || typeof meta !== 'object') return [];
            var raw = null;
            if (Array.isArray(meta.blocks) && meta.blocks.length) raw = meta.blocks;
            else if (meta.channel_rendering && Array.isArray(meta.channel_rendering.blocks)) {
                raw = meta.channel_rendering.blocks;
            } else if (meta.content_envelope && Array.isArray(meta.content_envelope.blocks)) {
                raw = meta.content_envelope.blocks;
            }
            if (!raw || !raw.length) return [];
            var out = [];
            for (var i = 0; i < raw.length; i++) {
                var block = raw[i];
                if (!block || typeof block !== 'object') continue;
                var kind = String(block.kind || '').trim().toLowerCase();
                if (kind === 'recap' && Array.isArray(block.fields) && block.fields.length) {
                    var fields = [];
                    for (var f = 0; f < block.fields.length; f++) {
                        var field = block.fields[f];
                        if (!field) continue;
                        var fl = String(field.label || '').trim();
                        var fv = String(field.value || '').trim();
                        if (fl && fv) fields.push({ label: fl, value: fv });
                    }
                    if (fields.length) {
                        out.push({ kind: 'recap', title: String(block.title || '').trim(), fields: fields });
                    }
                } else if (
                    kind === 'choice_list' &&
                    Array.isArray(block.choices) &&
                    (block.choices.length >= 2 || block.allow_return_menu === true || block.allow_back === true)
                ) {
                    var choices = [];
                    for (var c = 0; c < block.choices.length; c++) {
                        var ch = block.choices[c];
                        if (!ch) continue;
                        var cl = String(ch.label || '').trim();
                        if (!cl) continue;
                        choices.push({
                            id: String(ch.id || ('choice-' + c)),
                            label: cl,
                            description: String(ch.description || '').trim(),
                            value: String(ch.value || cl).trim() || cl
                        });
                    }
                    if (choices.length >= 2 || block.allow_return_menu === true || block.allow_back === true) {
                        out.push({
                            kind: 'choice_list',
                            title: String(block.title || '').trim(),
                            choices: choices,
                            allow_free_text: block.allow_free_text !== false,
                            allow_back: block.allow_back === true,
                            allow_return_menu: block.allow_return_menu === true,
                            free_text_placeholder: String(block.free_text_placeholder || '').trim()
                        });
                    }
                } else if (kind === 'step_progress') {
                    var current = Number(block.current);
                    var total = Number(block.total);
                    if (current >= 1 && total >= 2 && current <= total) {
                        out.push({
                            kind: 'step_progress',
                            current: current,
                            total: total,
                            label: String(block.label || '').trim()
                        });
                    }
                } else if (kind === 'answer_input') {
                    var at = String(block.answer_type || 'text').trim().toLowerCase();
                    var scaleMin = Number(block.scale_min);
                    var scaleMax = Number(block.scale_max);
                    var scaleDefault = Number(block.scale_default);
                    if (!isFinite(scaleMin)) scaleMin = 0;
                    if (!isFinite(scaleMax)) scaleMax = 10;
                    if (scaleMax < scaleMin) {
                        var tmpScale = scaleMin;
                        scaleMin = scaleMax;
                        scaleMax = tmpScale;
                    }
                    if (!isFinite(scaleDefault)) {
                        scaleDefault = scaleMin + Math.floor((scaleMax - scaleMin) / 2);
                    }
                    scaleDefault = Math.max(scaleMin, Math.min(scaleMax, Math.round(scaleDefault)));
                    out.push({
                        kind: 'answer_input',
                        answer_type: at || 'text',
                        field_key: String(block.field_key || 'answer').trim() || 'answer',
                        input_placeholder: String(block.input_placeholder || '').trim(),
                        default_country_code: String(block.default_country_code || '55').replace(/\D/g, '') || '55',
                        scale_min: scaleMin,
                        scale_max: scaleMax,
                        scale_default: scaleDefault,
                        allow_back: block.allow_back === true,
                        allow_return_menu: block.allow_return_menu === true
                    });
                } else if (kind === 'file_input') {
                    var exts = [];
                    var rawExts = Array.isArray(block.allowed_extensions) ? block.allowed_extensions : [];
                    for (var e = 0; e < rawExts.length; e++) {
                        var ext = String(rawExts[e] || '').trim().toLowerCase().replace(/^\./, '');
                        if (ext && exts.indexOf(ext) === -1) exts.push(ext);
                    }
                    out.push({
                        kind: 'file_input',
                        field_key: String(block.field_key || 'file').trim() || 'file',
                        allowed_extensions: exts,
                        input_placeholder: String(block.input_placeholder || '').trim(),
                        allow_back: block.allow_back === true,
                        allow_return_menu: block.allow_return_menu === true
                    });
                }
            }
            return out;
        }

        function blocksHaveChoiceList(blocks) {
            if (!Array.isArray(blocks)) return false;
            for (var i = 0; i < blocks.length; i++) {
                if (blocks[i] && (
                    blocks[i].kind === 'choice_list'
                    || blocks[i].kind === 'answer_input'
                    || blocks[i].kind === 'file_input'
                )) return true;
            }
            return false;
        }

        function _escHtml(s) {
            return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function isMediaPlaceholderCaption(text) {
            var s = String(text || '').trim().toLowerCase();
            return s === '(vídeo)' || s === '(video)' || s === '(imagem)' || s === '(image)'
                || s === '(áudio)' || s === '(audio)' || s === '(mídia)' || s === '(media)'
                || s === '(documento)' || s === '(document)' || s === '(sticker)' || s === '—'
                || s === 'video downloaded by xbot'
                || s === 'video-downloaded-by-xbot.mp4';
        }

        function isPresentationOpeningMeta(meta) {
            return !!(meta && typeof meta === 'object' && (
                meta.presentation_opening === true || meta.source === 'agent_presentation'
            ));
        }

        function isTapToUnmuteMeta(meta) {
            return !!(meta && typeof meta === 'object' && (
                meta.tap_to_unmute === true ||
                meta.straight_media === true ||
                meta.source === 'straight_media'
            ));
        }

        function isWaitUntilVideoEndsMeta(meta) {
            if (!meta || typeof meta !== 'object') return false;
            if (!isTapToUnmuteMeta(meta) && meta.source !== 'straight_media') return false;
            if (meta.wait_until_video_ends === false) return false;
            // Default true para Straight Media em vídeo (pipeline aguarda o ended no XChat).
            return meta.wait_until_video_ends === true || meta.straight_media === true || meta.source === 'straight_media';
        }

        function isPresentationComposerLocked() {
            return presentationLockCount > 0;
        }

        function isSleepComposerLocked() {
            return !!sleepComposerLocked;
        }

        function setPresentationComposerLocked(locked) {
            var compose = document.querySelector('.xbot-compose');
            var inputEl = document.getElementById('xbot-input');
            var sendEl = document.getElementById('xbot-send');
            var uploadEl = document.getElementById('xbot-upload');
            var audioEl = document.getElementById('xbot-audio');
            if (compose) {
                if (locked) compose.classList.add('is-presentation-locked');
                else compose.classList.remove('is-presentation-locked');
            }
            var forceLock = !!locked || isChoiceComposerLocked() || isSleepComposerLocked();
            var nodes = [inputEl, sendEl, uploadEl, audioEl];
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                if (!el) continue;
                el.disabled = forceLock;
                if (el.disabled) el.setAttribute('aria-disabled', 'true');
                else el.removeAttribute('aria-disabled');
            }
            if (inputEl) inputEl.readOnly = forceLock;
            if (!forceLock) {
                try {
                    document.dispatchEvent(new CustomEvent('xbot:compose-unlocked'));
                } catch (e) { /* ignore */ }
            }
        }

        function acquirePresentationComposerLock() {
            presentationLockCount += 1;
            setPresentationComposerLocked(true);
        }

        function releasePresentationComposerLock() {
            presentationLockCount = Math.max(0, presentationLockCount - 1);
            if (presentationLockCount === 0) setPresentationComposerLocked(false);
        }

        function isChoiceComposerLocked() {
            return choiceComposerLockCount > 0;
        }

        function setChoiceComposerLocked(locked) {
            var compose = document.querySelector('.xbot-compose');
            var inputEl = document.getElementById('xbot-input');
            var sendEl = document.getElementById('xbot-send');
            var uploadEl = document.getElementById('xbot-upload');
            var audioEl = document.getElementById('xbot-audio');
            if (compose) {
                if (locked) compose.classList.add('is-choice-locked');
                else compose.classList.remove('is-choice-locked');
            }
            var nodes = [inputEl, sendEl, uploadEl, audioEl];
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                if (!el) continue;
                // Não sobrescrever lock de apresentação / sleep.
                if (!locked && (isPresentationComposerLocked() || isSleepComposerLocked())) continue;
                el.disabled = !!locked || isPresentationComposerLocked() || isSleepComposerLocked();
                if (el.disabled) el.setAttribute('aria-disabled', 'true');
                else el.removeAttribute('aria-disabled');
            }
            if (inputEl) {
                inputEl.readOnly = !!locked || isPresentationComposerLocked() || isSleepComposerLocked();
                if (locked) {
                    inputEl.setAttribute('data-prev-placeholder', inputEl.getAttribute('placeholder') || '');
                    var pendingFile = messages && messages.querySelector
                        ? messages.querySelector('[data-xbot="file-input"][data-lock-composer="1"]')
                        : null;
                    var pendingAnswer = messages && messages.querySelector
                        ? messages.querySelector('[data-xbot="answer-input"][data-lock-composer="1"]')
                        : null;
                    if (pendingFile) inputEl.placeholder = 'Envie um arquivo acima…';
                    else if (pendingAnswer) inputEl.placeholder = 'Responda no campo acima…';
                    else inputEl.placeholder = 'Escolha uma opção acima…';
                } else if (!isSleepComposerLocked() && inputEl.getAttribute('data-prev-placeholder') != null) {
                    inputEl.placeholder = inputEl.getAttribute('data-prev-placeholder') || 'Ou envie uma mensagem…';
                    inputEl.removeAttribute('data-prev-placeholder');
                }
            }
        }

        function setSleepComposerLocked(locked) {
            var next = !!locked;
            sleepComposerLocked = next;
            var compose = document.querySelector('.xbot-compose');
            var inputEl = document.getElementById('xbot-input');
            var sendEl = document.getElementById('xbot-send');
            var uploadEl = document.getElementById('xbot-upload');
            var audioEl = document.getElementById('xbot-audio');
            if (compose) {
                if (next) compose.classList.add('is-sleep-locked');
                else compose.classList.remove('is-sleep-locked');
            }
            var forceLock = next || isPresentationComposerLocked() || isChoiceComposerLocked();
            var nodes = [inputEl, sendEl, uploadEl, audioEl];
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                if (!el) continue;
                el.disabled = forceLock;
                if (el.disabled) el.setAttribute('aria-disabled', 'true');
                else el.removeAttribute('aria-disabled');
            }
            if (inputEl) {
                inputEl.readOnly = forceLock;
                if (next) {
                    if (inputEl.getAttribute('data-prev-placeholder') == null) {
                        inputEl.setAttribute('data-prev-placeholder', inputEl.getAttribute('placeholder') || '');
                    }
                    inputEl.placeholder = 'Aguarde…';
                } else if (!isChoiceComposerLocked() && inputEl.getAttribute('data-prev-placeholder') != null) {
                    inputEl.placeholder = inputEl.getAttribute('data-prev-placeholder') || 'Ou envie uma mensagem…';
                    inputEl.removeAttribute('data-prev-placeholder');
                }
            }
            if (!forceLock) {
                try {
                    document.dispatchEvent(new CustomEvent('xbot:compose-unlocked'));
                } catch (e) { /* ignore */ }
            }
        }

        function applyComposerLockedFlag(flag) {
            if (typeof flag !== 'boolean') return;
            setSleepComposerLocked(flag);
        }

        function acquireChoiceComposerLock() {
            choiceComposerLockCount += 1;
            setChoiceComposerLocked(true);
        }

        function releaseChoiceComposerLock() {
            choiceComposerLockCount = Math.max(0, choiceComposerLockCount - 1);
            if (choiceComposerLockCount === 0) setChoiceComposerLocked(false);
        }

        /** Campo visível e focável (ignora display:none / hidden). */
        function isAnswerFieldFocusable(el) {
            if (!el || el.disabled) return false;
            if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
            try {
                var style = window.getComputedStyle(el);
                if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
            } catch (e) { /* ignore */ }
            return true;
        }

        /**
         * Primeiro campo preenchível da esquerda para a direita no Answer:
         * telefone → DDD (se BR) → número; demais → input / data.
         */
        function firstFillableAnswerField(form) {
            if (!form || !form.querySelector) return null;
            var area = form.querySelector('input.xbot-answer-area');
            if (isAnswerFieldFocusable(area)) return area;
            var national = form.querySelector('input.xbot-answer-national');
            if (isAnswerFieldFocusable(national)) return national;
            var otpDigit = form.querySelector('input.xbot-answer-otp-digit');
            if (isAnswerFieldFocusable(otpDigit)) return otpDigit;
            var scaleSlider = form.querySelector('input.xbot-answer-scale-slider');
            if (isAnswerFieldFocusable(scaleSlider)) return scaleSlider;
            var field = form.querySelector('input.xbot-answer-field');
            if (isAnswerFieldFocusable(field)) return field;
            var dateTrigger = form.querySelector('.xbot-answer-date-trigger');
            if (isAnswerFieldFocusable(dateTrigger)) return dateTrigger;
            return null;
        }

        /** Foca o campo de resposta inline no corpo da mensagem (Answer / opção com texto livre). */
        function focusInlineBodyInput(root) {
            if (!root || sessionEpisodeEnded) return;
            var el = null;
            var form = root.querySelector ? root.querySelector('[data-xbot="answer-input"]') : null;
            if (form) el = firstFillableAnswerField(form);
            if (!el && root.querySelector) {
                el = root.querySelector('.xbot-choice-free input:not(:disabled)');
            }
            if (!el || typeof el.focus !== 'function') return;
            window.setTimeout(function () {
                try {
                    if (typeof el.focus === 'function') el.focus({ preventScroll: true });
                } catch (e) {
                    try { el.focus(); } catch (e2) { /* ignore */ }
                }
                scheduleScrollMessagesToBottom();
                if (typeof applyMobileKeyboardLayout === 'function' && isMobileLayout()) {
                    scheduleMobileKeyboardLayoutSettle();
                }
            }, 0);
        }

        function syncPendingChoiceComposerLock() {
            releaseChoiceComposerLock();
            var rows = messages.querySelectorAll('.xbot-message-row');
            if (!rows.length) return;
            var last = rows[rows.length - 1];
            if (!last || !last.classList.contains('bot')) return;
            var list = last.querySelector('[data-xbot="choice-list"][data-lock-composer="1"]');
            if (list) {
                var buttons = list.querySelectorAll('.xbot-choice-item');
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].disabled = false;
                    (function (btn) {
                        if (btn.getAttribute('data-choice-bound') === '1') return;
                        btn.setAttribute('data-choice-bound', '1');
                        btn.addEventListener('click', function () {
                            if (sessionEpisodeEnded) return;
                            var value = btn.getAttribute('data-choice-value') || '';
                            var label = btn.getAttribute('data-choice-label') || value;
                            var choiceId = btn.getAttribute('data-choice-id') || '';
                            var root = btn.closest('[data-xbot="choice-list"]');
                            if (root) {
                                var all = root.querySelectorAll('.xbot-choice-item, .xbot-choice-free-send');
                                for (var j = 0; j < all.length; j++) all[j].disabled = true;
                            }
                            releaseChoiceComposerLock();
                            sendUserText(label || value, {
                                action: {
                                    id: choiceId || 'choice',
                                    label: label || value,
                                    value: value || label,
                                    kind: 'reply'
                                }
                            });
                        });
                    })(buttons[i]);
                }
                acquireChoiceComposerLock();
                return;
            }
            var answerForm = last.querySelector('[data-xbot="answer-input"][data-lock-composer="1"]');
            if (answerForm) {
                var inputs = answerForm.querySelectorAll('input, button, select');
                for (var k = 0; k < inputs.length; k++) inputs[k].disabled = false;
                acquireChoiceComposerLock();
                focusInlineBodyInput(last);
                return;
            }
            var fileForm = last.querySelector('[data-xbot="file-input"][data-lock-composer="1"]');
            if (fileForm) {
                var fileNodes = fileForm.querySelectorAll('input, button');
                for (var f = 0; f < fileNodes.length; f++) fileNodes[f].disabled = false;
                fileForm.classList.remove('is-done', 'is-uploading');
                acquireChoiceComposerLock();
            }
        }

        /**
         * Escala "TAP TO UNMUTE" para caber na faixa útil do player (~80% / 10% cada lado).
         * CSS (cqi/vw) falha em bolhas estreitas no mobile — medimos scrollWidth de fato.
         */
        function fitPresentationUnmuteLabel(wrap, label) {
            if (!wrap || !label) return;
            var frameW = wrap.clientWidth || 0;
            if (frameW < 8) return;
            // Caixa do rótulo já tem inset 10%; usa a largura real dela quando disponível.
            var maxW = label.clientWidth > 0 ? label.clientWidth : frameW * 0.8;
            if (maxW < 8) maxW = frameW * 0.8;
            var size = Math.min(18, Math.max(9, frameW * 0.048));
            label.style.setProperty('font-size', size + 'px', 'important');
            var guard = 48;
            while (label.scrollWidth > maxW && size > 8 && guard--) {
                size -= 0.5;
                label.style.setProperty('font-size', size + 'px', 'important');
            }
        }

        function mountPresentationVideo(url, opts) {
            var lockComposer = !(opts && opts.lockComposer === false);
            var onEnded = opts && typeof opts.onEnded === 'function' ? opts.onEnded : null;
            var wrap = document.createElement('div');
            wrap.className = 'xbot-presentation-video';
            wrap.setAttribute('role', 'button');
            wrap.setAttribute('tabindex', '0');
            wrap.setAttribute('aria-label', 'TAP TO UNMUTE');

            var vid = document.createElement('video');
            vid.src = url;
            vid.muted = true;
            vid.defaultMuted = true;
            vid.autoplay = true;
            vid.playsInline = true;
            vid.controls = false;
            vid.preload = 'auto';
            vid.setAttribute('muted', '');
            vid.setAttribute('autoplay', '');
            vid.setAttribute('playsinline', '');
            vid.setAttribute('webkit-playsinline', '');
            vid.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
            vid.disablePictureInPicture = true;
            vid.disableRemotePlayback = true;

            var unmute = document.createElement('div');
            unmute.className = 'xbot-presentation-unmute';
            unmute.textContent = 'TAP TO UNMUTE';

            var finished = false;
            function finishPlayback() {
                if (finished) return;
                finished = true;
                if (lockComposer) releasePresentationComposerLock();
                if (onEnded) {
                    try { onEnded(); } catch (e) { /* ignore */ }
                }
            }
            function wasWatchedUnmuted() {
                // Só conta como concluído após TAP TO UNMUTE + assistir até o fim com som.
                return wrap.classList.contains('is-unmuted') && !vid.muted;
            }
            function tryPlay() {
                if (!wrap.classList.contains('is-unmuted')) vid.muted = true;
                var p = vid.play();
                if (p && typeof p.catch === 'function') p.catch(function () {});
            }
            function restartFromStart(withSound) {
                if (withSound) {
                    // Gesto do TAP TO UNMUTE: desbloqueia o beep de mensagens seguintes (iOS).
                    unlockXbotNotifyAudio();
                    vid.muted = false;
                    wrap.classList.add('is-unmuted');
                    wrap.setAttribute('aria-label', 'Reproduzir do início');
                    // Expande à largura da coluna da conversa (web + mobile).
                    var mediaWrap = wrap.parentElement;
                    if (mediaWrap && mediaWrap.classList && mediaWrap.classList.contains('xbot-media-wrap')) {
                        mediaWrap.classList.add('is-presentation-expanded');
                    }
                    var row = wrap.closest ? wrap.closest('.xbot-message-row') : null;
                    if (row) row.classList.add('xbot-message-row--presentation-expanded');
                    requestAnimationFrame(function () {
                        try {
                            wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } catch (e) { /* ignore */ }
                    });
                }
                try { vid.currentTime = 0; } catch (e) { /* ignore */ }
                var p = vid.play();
                if (p && typeof p.catch === 'function') p.catch(function () {});
            }
            function onActivate(ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                restartFromStart(true);
            }
            function onPlaybackEnded() {
                if (wasWatchedUnmuted()) {
                    finishPlayback();
                    return;
                }
                // Autoplay mudo terminou sem engajamento: recomeça mudo até o tap.
                try { vid.currentTime = 0; } catch (e) { /* ignore */ }
                tryPlay();
            }

            wrap.addEventListener('click', onActivate);
            wrap.addEventListener('keydown', function (ev) {
                if (!ev) return;
                if (ev.key === 'Enter' || ev.key === ' ') onActivate(ev);
            });
            bindMediaInteractionScrollGuard(wrap);
            bindMediaInteractionScrollGuard(vid);
            vid.addEventListener('ended', onPlaybackEnded);
            // Erro de mídia: libera lock / avança para não prender o visitante.
            vid.addEventListener('error', finishPlayback);
            vid.addEventListener('loadeddata', tryPlay);
            vid.addEventListener('canplay', tryPlay);

            function scheduleFitUnmute() {
                fitPresentationUnmuteLabel(wrap, unmute);
                requestAnimationFrame(function () {
                    fitPresentationUnmuteLabel(wrap, unmute);
                });
            }
            vid.addEventListener('loadedmetadata', scheduleFitUnmute);
            vid.addEventListener('loadeddata', scheduleFitUnmute);
            if (typeof ResizeObserver !== 'undefined') {
                try {
                    var unmuteRo = new ResizeObserver(function () {
                        fitPresentationUnmuteLabel(wrap, unmute);
                    });
                    unmuteRo.observe(wrap);
                } catch (eRo) { /* ignore */ }
            } else if (typeof window !== 'undefined') {
                window.addEventListener('resize', scheduleFitUnmute);
            }

            wrap.appendChild(vid);
            wrap.appendChild(unmute);
            if (lockComposer) acquirePresentationComposerLock();
            tryPlay();
            requestAnimationFrame(tryPlay);
            scheduleFitUnmute();
            setTimeout(tryPlay, 250);
            setTimeout(scheduleFitUnmute, 250);
            setTimeout(tryPlay, 1000);
            setTimeout(scheduleFitUnmute, 1000);
            return wrap;
        }

        // Renderiza mensagem do bot com mídia (imagem do produto, arquivo, etc.)
        function appendBotMedia(ct, url, caption, meta, opts) {
            var cap = (caption || '').trim();
            var filename = meta && typeof meta.filename === 'string' ? String(meta.filename).trim() : '';
            if ((ct === 'image' || ct === 'video') && cap && (
                (filename && cap === filename) ||
                /^[^\s\\/]+\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|mp4|webm|mov|m4v)$/i.test(cap)
            )) {
                cap = '';
            }
            if (isMediaPlaceholderCaption(cap)) cap = '';
            var downloadName = guessMediaFilename(
                url,
                filename || (ct === 'video' ? 'video-downloaded-by-xbot.mp4' : ct === 'image' ? 'imagem.jpg' : ct === 'audio' ? 'audio.webm' : 'arquivo')
            );
            if (ct === 'video') {
                downloadName = brandVideoShareName(downloadName, 'video/mp4');
            }
            var messageId = opts && opts.messageId ? opts.messageId : null;
            // Flag no metadata (histórico) ou opts (abertura recém-persistida).
            var isPresentationMedia = !!(opts && opts.presentationOpening) || isPresentationOpeningMeta(meta);
            var mediaWrapOpts = { allowDownload: !isPresentationMedia };
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
                textDiv.appendChild(wrapMediaWithDownload(createMediaImageEl(url, lines[0] || 'imagem'), url, downloadName, 'image', messageId, mediaWrapOpts));
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
                // Abertura / Straight media: player cinematográfico (TAP TO UNMUTE).
                // Reload da mesma sessão hidrata como histórico — não reproduz de novo.
                var usePresentationPlayer = (
                    (!visitorHasSpoken && !!(opts && opts.presentationOpening)) ||
                    !!(opts && opts.tapToUnmute)
                );
                var waitUntilVideoEnds = !!(opts && opts.waitUntilVideoEnds);
                if (usePresentationPlayer) {
                    appendMessage('', 'bot', Object.assign({}, opts, {
                        domNode: wrapMediaWithDownload(
                            mountPresentationVideo(url, {
                                // Straight com wait trava o composer até o vídeo acabar (como abertura).
                                // Straight sem wait: TAP TO UNMUTE sem travar.
                                lockComposer: !!(opts && opts.presentationOpening) || waitUntilVideoEnds,
                                onEnded: waitUntilVideoEnds ? function () {
                                    sendSilentVideoEndedAck();
                                } : null
                            }),
                            url,
                            downloadName,
                            'video',
                            messageId,
                            mediaWrapOpts
                        ),
                        animateTyping: false
                    }));
                } else {
                    var videoBlock = document.createElement('div');
                    var histVideo = createMediaVideoEl(url);
                    if (isPresentationMedia) {
                        histVideo.setAttribute('controlslist', 'nodownload');
                    }
                    videoBlock.appendChild(wrapMediaWithDownload(histVideo, url, downloadName, 'video', messageId, mediaWrapOpts));
                    if (cap) {
                        var vCap = document.createElement('p');
                        vCap.textContent = cap;
                        videoBlock.appendChild(vCap);
                    }
                    appendMessage('', 'bot', Object.assign({}, opts, { domNode: videoBlock, animateTyping: false }));
                }
            } else if (ct === 'audio') {
                var audioNode = wrapMediaWithDownload(createXbotAudioPlayer(url), url, downloadName, 'audio', messageId, mediaWrapOpts);
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
                var fileCard = document.createElement('div');
                fileCard.className = 'xbot-media-file';
                var fileNameEl = document.createElement('span');
                fileNameEl.className = 'xbot-media-file-name';
                fileNameEl.textContent = '📎 ' + label;
                fileCard.appendChild(fileNameEl);
                appendMessage('', 'bot', Object.assign({}, opts, {
                    domNode: wrapMediaWithDownload(fileCard, url, downloadName || label, 'file', messageId, mediaWrapOpts),
                    animateTyping: false
                }));
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
                                } else if (frame.event === 'composer_lock' && frame.data) {
                                    try {
                                        var lockPayload = JSON.parse(frame.data);
                                        applyComposerLockedFlag(!!lockPayload.composer_locked);
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
            var hints = getVisitorClientHints();
            Object.keys(hints).forEach(function (key) {
                if (hints[key]) url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(hints[key]);
            });
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
                applyComposerLockedFlag(data.composer_locked);
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
                visitorHasSpoken = hasUserInHistory;
                // Anima a abertura só quando ela acabou de ser persistida neste GET.
                // Reload da mesma sessão hidrata como histórico (sem typewriter/vídeo TAP TO UNMUTE).
                var animateOpening = !!data.presentation_started && !hasUserInHistory && botOnlyCount > 0;
                for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var body = (item.content || '').trim();
                    var histMeta = (item.metadata && typeof item.metadata === 'object') ? item.metadata : {};
                    var histMedia = histMeta.media_url || '';
                    if (!body && !histMedia) continue;
                    if ((item.sender || 'bot') === 'user') {
                        var histCt = String(item.content_type || '').toLowerCase();
                        var histMsgId = item.id || null;
                        if (histMedia && (histCt === 'audio' || histCt === 'ptt')) {
                            appendMessage('', 'user', {
                                domNode: wrapMediaWithDownload(
                                    createXbotAudioPlayer(histMedia),
                                    histMedia,
                                    guessMediaFilename(histMedia, 'audio.webm'),
                                    'audio',
                                    histMsgId
                                )
                            });
                        } else if (histMedia && histCt === 'video') {
                            appendMessage('', 'user', {
                                domNode: wrapMediaWithDownload(
                                    createMediaVideoEl(histMedia),
                                    histMedia,
                                    guessMediaFilename(histMedia, 'video-downloaded-by-xbot.mp4'),
                                    'video',
                                    histMsgId
                                )
                            });
                        } else if (histMedia && histCt === 'image') {
                            var userImgBlock = document.createElement('div');
                            userImgBlock.appendChild(wrapMediaWithDownload(
                                createMediaImageEl(histMedia, 'imagem'),
                                histMedia,
                                guessMediaFilename(histMedia, 'imagem.jpg'),
                                'image',
                                histMsgId
                            ));
                            if (body) {
                                var userCap = document.createElement('p');
                                userCap.textContent = body;
                                userImgBlock.appendChild(userCap);
                            }
                            appendMessage('', 'user', { domNode: userImgBlock });
                        } else {
                            appendMessage(body, 'user');
                        }
                    } else {
                        ingestBotPayload(item, body, animateOpening ? 'opening' : 'history');
                    }
                }
                if (list.length) welcomeShown = true;
                var lastHist = list.length ? list[list.length - 1] : null;
                var lastHistMeta = (lastHist && lastHist.metadata && typeof lastHist.metadata === 'object')
                    ? lastHist.metadata
                    : {};
                if (lastHist && (lastHist.sender || 'bot') !== 'user' && isKeepsTypingPayload(lastHistMeta)) {
                    pendingDownloadStatus = isLabProgressPayload(lastHistMeta);
                    beginWaitingForBot();
                    if (pendingTypingEl && pendingDownloadStatus) {
                        stopThinkingStatusCycle(pendingTypingEl);
                        startThinkingStatusCycle(pendingTypingEl);
                    }
                }
                syncPendingChoiceComposerLock();
                syncEmptyState();
            } catch (e) {
                widgetLog('histórico erro', e && e.message);
            } finally {
                syncEmptyState();
                pinMessagesToLatest();
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
                applyComposerLockedFlag(data.composer_locked);
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
            download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
        };

        function guessMediaFilename(url, fallback) {
            var name = (fallback || '').trim();
            if (name && /\.[a-z0-9]{2,8}$/i.test(name) && name.indexOf('/') < 0) return name;
            try {
                var path = new URL(String(url || ''), window.location.href).pathname || '';
                var base = decodeURIComponent((path.split('/').pop() || '').split('?')[0] || '');
                if (base && /\.[a-z0-9]{2,8}$/i.test(base)) return base.slice(0, 120);
            } catch (e) { /* ignore */ }
            return name || 'arquivo';
        }

        function isAppleTouchDevice() {
            try {
                var ua = String(navigator.userAgent || '');
                if (/iPhone|iPad|iPod/i.test(ua)) return true;
                // iPadOS 13+ se identifica como Mac, mas tem touch
                if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
            } catch (e) { /* ignore */ }
            return false;
        }

        function inferMediaMime(fileName, blobType) {
            var mime = String(blobType || '').trim().toLowerCase();
            if (mime && mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') {
                return mime;
            }
            var n = String(fileName || '').toLowerCase();
            if (/\.mp4$/i.test(n)) return 'video/mp4';
            if (/\.m4v$/i.test(n)) return 'video/x-m4v';
            if (/\.mov$/i.test(n)) return 'video/quicktime';
            if (/\.webm$/i.test(n)) return 'video/webm';
            if (/\.png$/i.test(n)) return 'image/png';
            if (/\.jpe?g$/i.test(n)) return 'image/jpeg';
            if (/\.gif$/i.test(n)) return 'image/gif';
            if (/\.webp$/i.test(n)) return 'image/webp';
            if (/\.heic$/i.test(n)) return 'image/heic';
            if (/\.mp3$/i.test(n)) return 'audio/mpeg';
            if (/\.m4a$/i.test(n)) return 'audio/mp4';
            if (/\.wav$/i.test(n)) return 'audio/wav';
            if (/\.ogg$/i.test(n)) return 'audio/ogg';
            return mime || 'application/octet-stream';
        }

        function mediaKindFromMime(mime) {
            var m = String(mime || '').toLowerCase();
            if (m.indexOf('image/') === 0) return 'image';
            if (m.indexOf('video/') === 0) return 'video';
            if (m.indexOf('audio/') === 0) return 'audio';
            return 'file';
        }

        function buildTypedMediaFile(blob, fileName) {
            var mime = inferMediaMime(fileName, blob && blob.type);
            var name = brandVideoShareName(String(fileName || 'arquivo'), mime);
            // Garante extensão compatível com a Fototeca do iOS
            if (mime === 'video/mp4' && !/\.mp4$/i.test(name)) name += '.mp4';
            if (mime === 'image/jpeg' && !/\.jpe?g$/i.test(name)) name += '.jpg';
            if (mime === 'image/png' && !/\.png$/i.test(name)) name += '.png';
            try {
                if (typeof File !== 'undefined') {
                    return new File([blob], name, { type: mime });
                }
            } catch (e) { /* ignore */ }
            try {
                return new Blob([blob], { type: mime });
            } catch (e2) {
                return blob;
            }
        }

        function closeXbotSaveSheet() {
            var existing = document.getElementById('xbot-save-sheet');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        }

        /**
         * iOS: após fetch async o gesto do usuário some e navigator.share falha.
         * Mostra preview + botão "Salvar" (novo toque) → Compartilhar → Salvar na Fototeca.
         */
        function openIosSaveSheet(blob, fileName) {
            closeXbotSaveSheet();
            var mimeGuess = inferMediaMime(fileName, blob && blob.type);
            var shareName = brandVideoShareName(fileName, mimeGuess);
            var shareTitle = brandVideoShareTitle(shareName);
            var typed = buildTypedMediaFile(blob, shareName);
            var mime = (typed && typed.type) || mimeGuess;
            var kind = mediaKindFromMime(mime);
            var objectUrl = URL.createObjectURL(typed || blob);

            var sheet = document.createElement('div');
            sheet.id = 'xbot-save-sheet';
            sheet.className = 'xbot-save-sheet';
            sheet.setAttribute('role', 'dialog');
            sheet.setAttribute('aria-modal', 'true');
            sheet.setAttribute('aria-label', 'Salvar mídia');

            var card = document.createElement('div');
            card.className = 'xbot-save-sheet-card';

            var title = document.createElement('div');
            title.className = 'xbot-save-sheet-title';
            title.textContent = kind === 'video'
                ? shareTitle
                : (kind === 'image' ? 'Salvar foto' : 'Salvar arquivo');

            var hint = document.createElement('p');
            hint.className = 'xbot-save-sheet-hint';
            hint.textContent = kind === 'image' || kind === 'video'
                ? 'Toque em Salvar e escolha “Salvar na Fototeca” (ou Arquivos).'
                : 'Toque em Salvar e escolha “Salvar em Arquivos”.';

            var preview = document.createElement('div');
            preview.className = 'xbot-save-sheet-preview';
            if (kind === 'image') {
                var img = document.createElement('img');
                img.src = objectUrl;
                img.alt = shareName || 'imagem';
                preview.appendChild(img);
            } else if (kind === 'video') {
                var video = document.createElement('video');
                video.src = objectUrl;
                video.controls = true;
                video.muted = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                preview.appendChild(video);
                attachVideoPosterFrame(video);
            } else if (kind === 'audio') {
                var audio = document.createElement('audio');
                audio.src = objectUrl;
                audio.controls = true;
                preview.appendChild(audio);
            } else {
                var fileLabel = document.createElement('div');
                fileLabel.className = 'xbot-save-sheet-file';
                fileLabel.textContent = '📎 ' + (shareName || 'arquivo');
                preview.appendChild(fileLabel);
            }

            var actions = document.createElement('div');
            actions.className = 'xbot-save-sheet-actions';

            var saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'xbot-save-sheet-primary';
            saveBtn.textContent = 'Salvar';

            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'xbot-save-sheet-secondary';
            closeBtn.textContent = 'Fechar';

            function cleanup() {
                closeXbotSaveSheet();
                setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1500);
            }

            function doShare() {
                var fileForShare = typed;
                if (!(fileForShare instanceof File) && typeof File !== 'undefined') {
                    try {
                        fileForShare = new File([blob], shareName || 'arquivo', { type: mime });
                    } catch (e) { fileForShare = typed; }
                }
                if (!navigator.share) {
                    hint.textContent = 'Pressione e segure a mídia acima e toque em “Adicionar à Fototeca”.';
                    return;
                }
                var payload = { files: [fileForShare], title: shareTitle };
                var can = true;
                try {
                    if (navigator.canShare) can = !!navigator.canShare(payload);
                } catch (e2) { can = false; }
                if (!can) {
                    payload = { files: [fileForShare], title: shareTitle };
                }
                saveBtn.disabled = true;
                saveBtn.textContent = 'Abrindo…';
                navigator.share(payload).then(function () {
                    cleanup();
                }).catch(function (err) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar';
                    if (err && err.name === 'AbortError') return;
                    hint.textContent = (kind === 'image' || kind === 'video')
                        ? 'Não abriu o compartilhar. Pressione e segure a mídia e toque em “Adicionar à Fototeca”.'
                        : 'Não abriu o compartilhar. Tente de novo ou use “Salvar em Arquivos”.';
                    widgetLog('share iOS falhou', err && err.name);
                });
            }

            saveBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                doShare();
            });
            closeBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                cleanup();
            });
            sheet.addEventListener('click', function (ev) {
                if (ev.target === sheet) cleanup();
            });

            actions.appendChild(saveBtn);
            actions.appendChild(closeBtn);
            card.appendChild(title);
            card.appendChild(hint);
            card.appendChild(preview);
            card.appendChild(actions);
            sheet.appendChild(card);
            document.body.appendChild(sheet);
        }

        function downloadMediaUrl(url, filename, messageId, triggerBtn) {
            var href = String(url || '').trim();
            var name = brandVideoShareName(
                guessMediaFilename(href, filename),
                inferMediaMime(filename || href, '')
            );
            var msgId = messageId ? String(messageId).trim() : '';
            if (!href && !msgId) return;
            var onApple = isAppleTouchDevice();

            function setBusy(on) {
                if (!triggerBtn) return;
                triggerBtn.disabled = !!on;
                triggerBtn.classList.toggle('is-busy', !!on);
                triggerBtn.setAttribute('aria-busy', on ? 'true' : 'false');
                if (on) {
                    triggerBtn.setAttribute('title', 'Preparando…');
                } else {
                    triggerBtn.setAttribute('title', onApple ? 'Salvar' : 'Baixar');
                }
            }

            function triggerBlobSave(blob, downloadName) {
                var typed = buildTypedMediaFile(blob, downloadName);
                var objectUrl = URL.createObjectURL(typed || blob);
                var a = document.createElement('a');
                a.href = objectUrl;
                a.setAttribute('download', downloadName || 'arquivo');
                a.rel = 'noopener';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 4000);
            }

            function shareOrSaveBlob(blob) {
                var fileName = name || 'arquivo';
                // iOS: <a download> não grava na Fototeca — sheet com share + long-press.
                if (onApple) {
                    openIosSaveSheet(blob, fileName);
                    return Promise.resolve();
                }
                var typed = buildTypedMediaFile(blob, fileName);
                var canShare = false;
                try {
                    canShare = !!(navigator.canShare && typed && navigator.canShare({ files: [typed] }));
                } catch (e2) { canShare = false; }
                if (canShare && typeof navigator.share === 'function' && isMobileLayout()) {
                    return navigator.share({
                        files: [typed],
                        title: brandVideoShareTitle(fileName),
                    }).catch(function (err) {
                        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                            return;
                        }
                        triggerBlobSave(blob, fileName);
                    });
                }
                triggerBlobSave(blob, fileName);
                return Promise.resolve();
            }

            function fetchAsBlob(fetchUrl, headers) {
                return fetch(fetchUrl, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: headers || {},
                }).then(function (res) {
                    if (!res.ok) throw new Error('download_http_' + res.status);
                    return res.blob();
                });
            }

            setBusy(true);

            var proxyBase = getMediaDownloadUrl();
            var vid = getVisitorId();
            var proxyPromise = null;
            if (proxyBase && channelId && vid && (msgId || href)) {
                var qs =
                    '?channel_id=' + encodeURIComponent(channelId) +
                    '&visitor_id=' + encodeURIComponent(vid) +
                    '&filename=' + encodeURIComponent(name || 'arquivo');
                if (msgId) qs += '&message_id=' + encodeURIComponent(msgId);
                if (href) qs += '&url=' + encodeURIComponent(href);
                proxyPromise = fetchAsBlob(proxyBase + qs, buildAuthHeaders({}));
            }

            var chain = proxyPromise
                ? proxyPromise.catch(function () {
                    if (!href) throw new Error('download_unavailable');
                    return fetchAsBlob(href, {});
                })
                : (href
                    ? fetchAsBlob(href, {})
                    : Promise.reject(new Error('download_unavailable')));

            chain
                .then(shareOrSaveBlob)
                .catch(function () {
                    if (triggerBtn) {
                        triggerBtn.setAttribute('title', 'Não foi possível baixar');
                        setTimeout(function () {
                            triggerBtn.setAttribute('title', onApple ? 'Salvar' : 'Baixar');
                        }, 2500);
                    }
                    widgetLog('download falhou', { messageId: msgId || null });
                })
                .finally(function () {
                    setBusy(false);
                });
        }

        function createMediaDownloadButton(url, filename, messageId) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'xbot-media-download';
            var apple = isAppleTouchDevice();
            var actionLabel = apple ? 'Salvar' : 'Baixar';
            btn.setAttribute('aria-label', apple ? 'Salvar na Fototeca' : 'Baixar arquivo');
            btn.title = actionLabel;
            // Só o ícone — label fica no title/aria-label (acessibilidade).
            btn.innerHTML = XBOT_ICONS.download;
            if (messageId) btn.setAttribute('data-message-id', String(messageId));
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                suppressMessagesAutoScroll(2000);
                downloadMediaUrl(url, filename, messageId || btn.getAttribute('data-message-id'), btn);
            });
            return btn;
        }

        function wrapMediaWithDownload(mediaNode, url, filename, variant, messageId, options) {
            var allowDownload = !options || options.allowDownload !== false;
            var wrap = document.createElement('div');
            wrap.className = 'xbot-media-wrap' + (variant ? ' xbot-media-wrap--' + variant : '');
            if (mediaNode && mediaNode.nodeType === 1) {
                mediaNode.classList.add('xbot-media');
                wrap.appendChild(mediaNode);
                bindMediaInteractionScrollGuard(mediaNode);
            }
            bindMediaInteractionScrollGuard(wrap);
            // Mídia da mensagem de apresentação: sem ícone de download.
            if (allowDownload) {
                wrap.appendChild(createMediaDownloadButton(url, filename, messageId));
            }
            return wrap;
        }

        function createMediaImageEl(url, alt) {
            var img = document.createElement('img');
            img.className = 'xbot-media';
            img.src = url;
            img.alt = alt || 'imagem';
            img.loading = 'lazy';
            img.onerror = function () { this.style.display = 'none'; };
            return img;
        }

        function brandVideoShareName(fileName, mime) {
            var n = String(fileName || '').trim();
            var low = n.toLowerCase();
            var isVideo = (mime && String(mime).indexOf('video/') === 0) ||
                /\.(mp4|mov|webm|m4v)$/i.test(low);
            if (!isVideo) return n || 'arquivo';
            // Substitui nomes genéricos do lab/yt-dlp ao encaminhar.
            if (!n ||
                low === 'video.mp4' ||
                low === 'video.webm' ||
                low === 'video.mov' ||
                /^video[-_.]?\d*\.(mp4|webm|mov|m4v)$/i.test(low) ||
                /^video\.%\(ext\)s$/i.test(low)) {
                return 'video-downloaded-by-xbot.mp4';
            }
            return n;
        }

        function brandVideoShareTitle(fileName) {
            var branded = brandVideoShareName(fileName, 'video/mp4');
            if (branded === 'video-downloaded-by-xbot.mp4') {
                return 'Video downloaded by Xbot';
            }
            return branded;
        }

        function attachVideoPosterFrame(vid) {
            if (!vid || vid.getAttribute('data-xbot-poster') === '1') return;
            vid.setAttribute('data-xbot-poster', '1');
            var framed = false;
            function capturePoster() {
                if (framed) return;
                if (!vid.videoWidth || !vid.videoHeight) return;
                try {
                    var canvas = document.createElement('canvas');
                    canvas.width = vid.videoWidth;
                    canvas.height = vid.videoHeight;
                    var ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                    var data = canvas.toDataURL('image/jpeg', 0.72);
                    if (data && data.indexOf('data:image') === 0) {
                        vid.setAttribute('poster', data);
                        framed = true;
                    }
                } catch (e) {
                    // Canvas tainted (CORS) — o seek já deixa um frame visível como capa.
                }
            }
            function seekPreviewFrame() {
                try {
                    if (vid.readyState < 1) return;
                    var t = 0.08;
                    if (isFinite(vid.duration) && vid.duration > 0 && vid.duration !== Infinity) {
                        t = Math.min(0.35, Math.max(0.04, vid.duration * 0.03));
                    }
                    if (Math.abs((vid.currentTime || 0) - t) > 0.02) {
                        vid.currentTime = t;
                    } else {
                        capturePoster();
                    }
                } catch (e) { /* ignore */ }
            }
            vid.addEventListener('loadedmetadata', seekPreviewFrame);
            vid.addEventListener('loadeddata', seekPreviewFrame);
            vid.addEventListener('seeked', function () {
                capturePoster();
            });
            // Já metadados em cache
            if (vid.readyState >= 1) seekPreviewFrame();
        }

        function createMediaVideoEl(url) {
            var vid = document.createElement('video');
            vid.className = 'xbot-media';
            vid.controls = true;
            vid.setAttribute('playsinline', '');
            vid.setAttribute('webkit-playsinline', '');
            vid.preload = 'metadata';
            // Ajuda alguns browsers a decodificar o 1º frame para a capa.
            vid.muted = true;
            var source = document.createElement('source');
            source.src = url;
            vid.appendChild(source);
            attachVideoPosterFrame(vid);
            // Ao dar play, volta ao início e libera o áudio se o usuário interagir pelos controles.
            vid.addEventListener('play', function onFirstPlay() {
                try {
                    if (vid.currentTime > 0.5) vid.currentTime = 0;
                } catch (e) { /* ignore */ }
                vid.muted = false;
                vid.removeEventListener('play', onFirstPlay);
            });
            bindMediaInteractionScrollGuard(vid);
            return vid;
        }

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
                scroll-behavior: auto;
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
            /* Popovers de data/telefone abrem para fora do card — não cortar. */
            .xbot-message:has([data-xbot="answer-input"]) {
                overflow: visible;
            }
            .xbot-message-row:has([data-xbot="answer-input"]) {
                position: relative;
                z-index: 6;
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
            .xbot-media-wrap {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 6px;
                width: min(50%, 15rem);
                max-width: 100%;
                margin: 2px 0 4px;
                transition: width 0.38s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .xbot-media-wrap--audio {
                width: min(100%, 16rem);
            }
            .xbot-media-wrap--file {
                width: min(100%, 16rem);
            }
            .xbot-media {
                display: block;
                width: 100%;
                height: auto;
                max-width: 100%;
                border-radius: var(--xbot-radius-md);
                margin: 0;
                background: #0f172a0a;
            }
            .xbot-media-wrap .xbot-presentation-video {
                width: 100%;
                margin: 0;
            }
            /* TAP TO UNMUTE: abre o vídeo na largura da coluna da conversa. */
            .xbot-media-wrap.is-presentation-expanded,
            .xbot-media-wrap:has(.xbot-presentation-video.is-unmuted) {
                width: 100% !important;
                max-width: 100%;
            }
            .xbot-message-row.xbot-message-row--presentation-expanded,
            .xbot-message-row:has(.xbot-presentation-video.is-unmuted) {
                width: 92%;
                max-width: 92%;
            }
            .xbot-message-row.xbot-message-row--presentation-expanded .xbot-message-col,
            .xbot-message-row.xbot-message-row--presentation-expanded .xbot-message,
            .xbot-message-row.xbot-message-row--presentation-expanded .xbot-message-content,
            .xbot-message-row:has(.xbot-presentation-video.is-unmuted) .xbot-message-col,
            .xbot-message-row:has(.xbot-presentation-video.is-unmuted) .xbot-message,
            .xbot-message-row:has(.xbot-presentation-video.is-unmuted) .xbot-message-content {
                width: 100%;
                max-width: 100%;
            }
            @media (prefers-reduced-motion: reduce) {
                .xbot-media-wrap {
                    transition: none;
                }
            }
            .xbot-media-wrap .xbot-audio-player {
                width: 100%;
                margin: 0;
            }
            .xbot-media-download {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0;
                margin: 0;
                padding: 4px 2px 0;
                border: 0;
                background: transparent;
                color: var(--xbot-muted);
                font: inherit;
                font-size: 12px;
                font-weight: 550;
                line-height: 1;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
            .xbot-media-download span {
                display: none;
            }
            .xbot-media-download.is-busy {
                opacity: 0.7;
                cursor: wait;
            }
            .xbot-media-download:hover,
            .xbot-media-download:focus-visible {
                color: var(--xbot-theme);
                outline: none;
            }
            .xbot-media-download:disabled {
                pointer-events: none;
            }
            .xbot-save-sheet {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 16px;
                padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
                background: rgba(15, 23, 42, 0.55);
                -webkit-tap-highlight-color: transparent;
            }
            .xbot-save-sheet-card {
                width: min(100%, 26rem);
                background: #fff;
                color: #0f172a;
                border-radius: 16px;
                padding: 16px;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.28);
            }
            .xbot-save-sheet-title {
                font-size: 16px;
                font-weight: 650;
                letter-spacing: -0.02em;
            }
            .xbot-save-sheet-hint {
                margin: 6px 0 12px;
                font-size: 13px;
                line-height: 1.4;
                color: #64748b;
            }
            .xbot-save-sheet-preview {
                display: flex;
                align-items: center;
                justify-content: center;
                max-height: 46vh;
                overflow: hidden;
                border-radius: 12px;
                background: #0f172a0a;
            }
            .xbot-save-sheet-preview img,
            .xbot-save-sheet-preview video {
                display: block;
                width: 100%;
                max-height: 46vh;
                object-fit: contain;
                background: #000;
            }
            .xbot-save-sheet-preview audio {
                width: 100%;
                margin: 12px;
            }
            .xbot-save-sheet-file {
                padding: 18px 12px;
                font-size: 14px;
                word-break: break-word;
            }
            .xbot-save-sheet-actions {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 14px;
            }
            .xbot-save-sheet-primary,
            .xbot-save-sheet-secondary {
                width: 100%;
                border: 0;
                border-radius: 12px;
                padding: 12px 14px;
                font: inherit;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
            }
            .xbot-save-sheet-primary {
                background: var(--xbot-theme, #25d366);
                color: #fff;
            }
            .xbot-save-sheet-primary:disabled {
                opacity: 0.7;
                cursor: wait;
            }
            .xbot-save-sheet-secondary {
                background: #f1f5f9;
                color: #334155;
            }
            .xbot-media-download svg {
                flex-shrink: 0;
            }
            .xbot-media-file {
                display: block;
                width: 100%;
                padding: 8px 10px;
                border-radius: var(--xbot-radius-md);
                border: 1px solid var(--xbot-border);
                background: rgba(15, 23, 42, 0.03);
                font-size: 13px;
                word-break: break-word;
            }
            .xbot-media-file-name {
                color: inherit;
                text-decoration: none;
            }
            .xbot-media-file-name:hover {
                color: var(--xbot-theme);
            }
            @media screen and (min-width: 601px) {
                .xbot-media-wrap {
                    width: min(68%, 24rem);
                }
                .xbot-media-wrap--audio,
                .xbot-media-wrap--file {
                    width: min(100%, 22rem);
                }
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
            .xbot-code-box--lab {
                padding-top: 12px;
            }
            .xbot-code-box--lab.is-collapsed pre {
                display: none;
            }
            .xbot-lab-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                width: calc(100% - 40px);
                margin: 0 0 8px;
                padding: 0;
                border: 0;
                background: transparent;
                color: #c8c8c8;
                font: inherit;
                font-size: 12px;
                font-weight: 550;
                line-height: 1.3;
                text-align: left;
                cursor: pointer;
            }
            .xbot-lab-toggle-chevron {
                flex-shrink: 0;
                opacity: 0.75;
                transition: transform 0.15s ease;
            }
            .xbot-code-box--lab.is-collapsed .xbot-lab-toggle-chevron {
                transform: rotate(-90deg);
            }
            .xbot-code-box--lab:not(.is-collapsed) .xbot-lab-toggle {
                margin-bottom: 10px;
            }
            .xbot-code-box pre {
                margin: 0;
                padding-right: 40px;
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
                padding: 6px;
                border-radius: 4px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0;
                z-index: 1;
            }
            .xbot-copy-btn:hover { background: #3c3c3c; }
            .xbot-copy-btn .xbot-copy-icon { display: block; }
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
            .xbot-locate-address {
                margin-top: auto;
                padding-top: 8px;
                font-size: 11px;
                font-weight: 600;
                color: #0f766e;
                line-height: 1.35;
            }
            .xbot-locate-grid,
            .xbot-text [data-xbot="locate-grid"] {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin: 10px 0;
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
            .xbot-ui-blocks {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 10px;
                width: 100%;
                max-width: 100%;
            }
            .xbot-recap {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 22%, var(--xbot-border));
                background: color-mix(in srgb, var(--xbot-theme) 6%, var(--xbot-surface));
                border-radius: 14px;
                padding: 14px;
            }
            .xbot-recap-title {
                margin: 0 0 10px;
                font-size: 13px;
                font-weight: 650;
                color: var(--xbot-ink);
            }
            .xbot-recap-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin: 0;
            }
            .xbot-recap-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }
            .xbot-recap-item dt {
                font-size: 11px;
                font-weight: 650;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: var(--xbot-muted);
            }
            .xbot-recap-item dd {
                margin: 0;
                font-size: 14px;
                line-height: 1.45;
                color: var(--xbot-ink);
                overflow-wrap: anywhere;
            }
            .xbot-choice-list {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 40%, var(--xbot-border));
                background: color-mix(in srgb, var(--xbot-theme) 12%, #ffffff);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(var(--xbot-theme-rgb), 0.12);
            }
            .xbot-choice-list-title {
                margin: 0;
                padding: 12px 14px 10px;
                border-bottom: 1px solid color-mix(in srgb, var(--xbot-theme) 22%, var(--xbot-border));
                background: color-mix(in srgb, var(--xbot-theme) 16%, #ffffff);
                font-size: 14px;
                font-weight: 650;
                color: var(--xbot-ink);
            }
            .xbot-choice-list-body {
                display: flex;
                flex-direction: column;
                padding: 6px;
                gap: 2px;
                background: transparent;
            }
            .xbot-choice-item {
                appearance: none;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                width: 100%;
                margin: 0;
                padding: 11px 12px;
                border: 0;
                border-radius: 12px;
                background: transparent;
                color: inherit;
                text-align: left;
                cursor: pointer;
                font: inherit;
                transition: background 0.15s ease, box-shadow 0.15s ease;
            }
            .xbot-choice-item:hover:not(:disabled) {
                background: color-mix(in srgb, var(--xbot-theme) 18%, #ffffff);
                box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--xbot-theme) 28%, transparent);
            }
            .xbot-choice-item:disabled {
                cursor: default;
                opacity: 0.62;
            }
            .xbot-choice-index {
                flex: 0 0 auto;
                width: 24px;
                height: 24px;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                color: #ffffff;
                background: var(--xbot-theme);
                box-shadow: 0 1px 3px rgba(var(--xbot-theme-rgb), 0.35);
            }
            .xbot-choice-copy {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding-top: 1px;
            }
            .xbot-choice-label {
                font-size: 14px;
                font-weight: 650;
                color: var(--xbot-ink);
            }
            .xbot-choice-desc {
                font-size: 12px;
                line-height: 1.4;
                color: var(--xbot-muted);
            }
            .xbot-choice-free {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px 10px;
            }
            .xbot-choice-free input {
                flex: 1 1 auto;
                min-width: 0;
                border: 0;
                background: transparent;
                padding: 8px 0;
                font: inherit;
                font-size: 13px;
                color: var(--xbot-ink);
                outline: none;
            }
            .xbot-choice-free input::placeholder { color: var(--xbot-subtle); }
            .xbot-choice-free-send {
                appearance: none;
                width: 30px;
                height: 30px;
                border: 0;
                border-radius: 999px;
                background: var(--xbot-theme);
                color: #fff;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 2px 8px rgba(var(--xbot-theme-rgb), 0.32);
            }
            .xbot-choice-free-send:disabled {
                opacity: 0.4;
                cursor: default;
                box-shadow: none;
            }
            .xbot-answer-back,
            .xbot-choice-back,
            .xbot-file-back,
            .xbot-answer-menu,
            .xbot-choice-menu,
            .xbot-file-menu {
                appearance: none;
                border: 0;
                background: transparent;
                color: var(--xbot-theme);
                font: inherit;
                font-size: 12px;
                font-weight: 650;
                text-decoration: underline;
                text-underline-offset: 2px;
                cursor: pointer;
                padding: 10px 12px;
                width: 100%;
                box-sizing: border-box;
                text-align: left;
            }
            .xbot-answer-back,
            .xbot-file-back,
            .xbot-answer-menu,
            .xbot-file-menu {
                padding: 4px 2px;
                width: auto;
            }
            .xbot-answer-back:hover:not(:disabled),
            .xbot-choice-back:hover:not(:disabled),
            .xbot-file-back:hover:not(:disabled),
            .xbot-answer-menu:hover:not(:disabled),
            .xbot-choice-menu:hover:not(:disabled),
            .xbot-file-menu:hover:not(:disabled) {
                color: color-mix(in srgb, var(--xbot-theme) 78%, #0f172a);
            }
            .xbot-answer-back:disabled,
            .xbot-choice-back:disabled,
            .xbot-file-back:disabled,
            .xbot-answer-menu:disabled,
            .xbot-choice-menu:disabled,
            .xbot-file-menu:disabled {
                opacity: 0.45;
                cursor: default;
            }
            .xbot-file-input {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 40%, var(--xbot-border));
                background: color-mix(in srgb, var(--xbot-theme) 12%, #ffffff);
                border-radius: 16px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .xbot-file-dropzone {
                appearance: none;
                border: 1.5px dashed color-mix(in srgb, var(--xbot-theme) 55%, var(--xbot-border));
                background: color-mix(in srgb, var(--xbot-theme) 8%, #ffffff);
                border-radius: 14px;
                padding: 18px 14px;
                width: 100%;
                box-sizing: border-box;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 6px;
                text-align: center;
                color: #334155;
                font: inherit;
                transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
            }
            .xbot-file-dropzone:hover:not(:disabled),
            .xbot-file-dropzone:focus-visible {
                border-color: var(--xbot-theme);
                background: color-mix(in srgb, var(--xbot-theme) 14%, #ffffff);
                outline: none;
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--xbot-theme) 18%, transparent);
            }
            .xbot-file-dropzone.is-dragover {
                border-color: var(--xbot-theme);
                background: color-mix(in srgb, var(--xbot-theme) 18%, #ffffff);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--xbot-theme) 22%, transparent);
            }
            .xbot-file-dropzone:disabled {
                opacity: 0.55;
                cursor: default;
            }
            .xbot-file-dropzone-icon {
                width: 28px;
                height: 28px;
                color: var(--xbot-theme);
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .xbot-file-dropzone-icon svg {
                width: 28px;
                height: 28px;
            }
            .xbot-file-dropzone-title {
                font-size: 13px;
                font-weight: 650;
                color: #0f172a;
                line-height: 1.35;
            }
            .xbot-file-dropzone-hint {
                font-size: 11px;
                color: #64748b;
                line-height: 1.35;
            }
            .xbot-file-error {
                font-size: 12px;
                color: #b91c1c;
                line-height: 1.35;
            }
            .xbot-answer-input {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 40%, var(--xbot-border));
                background: color-mix(in srgb, var(--xbot-theme) 12%, #ffffff);
                border-radius: 16px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(var(--xbot-theme-rgb), 0.12);
            }
            .xbot-answer-row,
            .xbot-answer-phone-row,
            .xbot-answer-otp-row {
                display: flex;
                align-items: stretch;
                gap: 8px;
                width: 100%;
                min-width: 0;
            }
            .xbot-answer-scale {
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 100%;
                min-width: 0;
            }
            .xbot-answer-scale-value {
                align-self: center;
                min-width: 2.4em;
                padding: 4px 12px;
                border-radius: 999px;
                background: color-mix(in srgb, var(--xbot-theme) 16%, #ffffff);
                color: var(--xbot-theme);
                font-size: 22px;
                font-weight: 700;
                letter-spacing: -0.02em;
                text-align: center;
                line-height: 1.2;
            }
            .xbot-answer-scale-row {
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                min-width: 0;
            }
            .xbot-answer-scale-bound {
                flex: 0 0 auto;
                min-width: 1.25em;
                font-size: 12px;
                font-weight: 650;
                color: color-mix(in srgb, var(--xbot-ink) 55%, transparent);
                text-align: center;
            }
            .xbot-answer-scale-slider {
                flex: 1 1 auto;
                min-width: 0;
                width: 100%;
                height: 28px;
                margin: 0;
                appearance: none;
                -webkit-appearance: none;
                background: transparent;
                cursor: pointer;
                --xbot-scale-pct: 50%;
                --xbot-scale-track: color-mix(in srgb, var(--xbot-theme) 22%, var(--xbot-border));
            }
            .xbot-answer-scale-slider:focus {
                outline: none;
            }
            .xbot-answer-scale-slider:focus-visible::-webkit-slider-thumb {
                box-shadow: 0 0 0 4px rgba(var(--xbot-theme-rgb), 0.22);
            }
            .xbot-answer-scale-slider:focus-visible::-moz-range-thumb {
                box-shadow: 0 0 0 4px rgba(var(--xbot-theme-rgb), 0.22);
            }
            .xbot-answer-scale-slider::-webkit-slider-runnable-track {
                height: 8px;
                border-radius: 999px;
                background: linear-gradient(
                    to right,
                    var(--xbot-theme) 0%,
                    var(--xbot-theme) var(--xbot-scale-pct),
                    var(--xbot-scale-track) var(--xbot-scale-pct),
                    var(--xbot-scale-track) 100%
                );
            }
            .xbot-answer-scale-slider::-moz-range-track {
                height: 8px;
                border-radius: 999px;
                background: var(--xbot-scale-track);
            }
            .xbot-answer-scale-slider::-moz-range-progress {
                height: 8px;
                border-radius: 999px;
                background: var(--xbot-theme);
            }
            .xbot-answer-scale-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 22px;
                height: 22px;
                margin-top: -7px;
                border-radius: 50%;
                border: 2px solid #ffffff;
                background: var(--xbot-theme);
                box-shadow: 0 1px 4px rgba(15, 23, 42, 0.22);
                cursor: grab;
            }
            .xbot-answer-scale-slider::-moz-range-thumb {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                border: 2px solid #ffffff;
                background: var(--xbot-theme);
                box-shadow: 0 1px 4px rgba(15, 23, 42, 0.22);
                cursor: grab;
            }
            .xbot-answer-scale-slider:disabled {
                opacity: 0.55;
                cursor: default;
            }
            .xbot-answer-scale-actions {
                display: flex;
                justify-content: flex-end;
            }
            .xbot-answer-otp-digits {
                display: flex;
                align-items: stretch;
                gap: 6px;
                flex: 1 1 auto;
                min-width: 0;
            }
            .xbot-answer-otp-digit {
                flex: 1 1 0;
                width: 100%;
                min-width: 0;
                max-width: 48px;
                aspect-ratio: 1 / 1;
                box-sizing: border-box;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 18%, var(--xbot-border));
                border-radius: 12px;
                background: #ffffff;
                padding: 0;
                font: inherit;
                font-size: 18px;
                font-weight: 650;
                letter-spacing: 0;
                text-align: center;
                color: var(--xbot-ink);
                outline: none;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
                -moz-appearance: textfield;
            }
            .xbot-answer-otp-digit::-webkit-outer-spin-button,
            .xbot-answer-otp-digit::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .xbot-answer-otp-digit:focus {
                border-color: var(--xbot-theme);
                box-shadow: 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.18);
            }
            .xbot-answer-field {
                flex: 1 1 auto;
                min-width: 0;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 18%, var(--xbot-border));
                border-radius: 12px;
                background: #ffffff;
                padding: 11px 13px;
                font: inherit;
                font-size: 14px;
                color: var(--xbot-ink);
                outline: none;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .xbot-answer-field:focus {
                border-color: var(--xbot-theme);
                box-shadow: 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.18);
            }
            .xbot-answer-area {
                width: 52px;
                flex: 0 0 auto;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 18%, var(--xbot-border));
                border-radius: 12px;
                background: #ffffff;
                padding: 11px 4px;
                font: inherit;
                font-size: 14px;
                text-align: center;
                color: var(--xbot-ink);
                outline: none;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .xbot-answer-area:focus {
                border-color: var(--xbot-theme);
                box-shadow: 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.18);
            }
            .xbot-answer-country {
                position: relative;
                flex: 0 0 auto;
                width: 72px;
            }
            .xbot-answer-country-btn {
                appearance: none;
                width: 100%;
                height: 100%;
                min-height: 44px;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 18%, var(--xbot-border));
                border-radius: 12px;
                background: #ffffff;
                padding: 8px 6px;
                font: inherit;
                font-size: 13px;
                font-weight: 650;
                color: var(--xbot-ink);
                cursor: pointer;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .xbot-answer-country-btn:hover,
            .xbot-answer-country-btn:focus {
                border-color: var(--xbot-theme);
                box-shadow: 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.14);
                outline: none;
            }
            .xbot-answer-country-panel {
                position: absolute;
                left: 0;
                bottom: calc(100% + 6px);
                top: auto;
                z-index: 40;
                width: 260px;
                max-width: min(260px, 70vw);
                background: #ffffff;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 28%, var(--xbot-border));
                border-radius: 14px;
                box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
                overflow: hidden;
            }
            .xbot-answer-country-panel.is-open-down {
                bottom: auto;
                top: calc(100% + 6px);
            }
            .xbot-answer-country-search {
                width: 100%;
                box-sizing: border-box;
                border: 0;
                border-bottom: 1px solid color-mix(in srgb, var(--xbot-theme) 14%, var(--xbot-border));
                background: #ffffff;
                padding: 10px 12px;
                font: inherit;
                font-size: 13px;
                outline: none;
            }
            .xbot-answer-country-list {
                list-style: none;
                margin: 0;
                padding: 4px 0;
                max-height: 220px;
                overflow-y: auto;
                background: #ffffff;
            }
            .xbot-answer-country-option {
                appearance: none;
                display: block;
                width: 100%;
                border: 0;
                background: #ffffff;
                text-align: left;
                padding: 8px 12px;
                font: inherit;
                font-size: 13px;
                color: var(--xbot-ink);
                cursor: pointer;
            }
            .xbot-answer-country-option:hover,
            .xbot-answer-country-option.is-selected {
                background: color-mix(in srgb, var(--xbot-theme) 12%, #ffffff);
                color: var(--xbot-theme);
            }
            .xbot-answer-send {
                appearance: none;
                width: 40px;
                height: 40px;
                align-self: center;
                border: 0;
                border-radius: 999px;
                background: var(--xbot-theme);
                color: #fff;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 2px 10px rgba(var(--xbot-theme-rgb), 0.38);
                transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
            }
            .xbot-answer-send:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 4px 14px rgba(var(--xbot-theme-rgb), 0.45);
            }
            .xbot-answer-send:disabled {
                opacity: 0.42;
                cursor: default;
                box-shadow: none;
                transform: none;
            }
            .xbot-answer-error {
                font-size: 12px;
                color: #b91c1c;
                padding: 0 2px;
            }
            .xbot-answer-date {
                position: relative;
                flex: 1 1 auto;
                min-width: 0;
            }
            .xbot-answer-date-trigger {
                appearance: none;
                width: 100%;
                min-height: 44px;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 18%, var(--xbot-border));
                border-radius: 12px;
                background: #ffffff;
                padding: 11px 13px;
                font: inherit;
                font-size: 14px;
                color: var(--xbot-subtle);
                text-align: left;
                cursor: pointer;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .xbot-answer-date-trigger:hover,
            .xbot-answer-date-trigger:focus {
                border-color: var(--xbot-theme);
                box-shadow: 0 0 0 3px rgba(var(--xbot-theme-rgb), 0.18);
                outline: none;
            }
            .xbot-answer-date-trigger.has-value {
                color: var(--xbot-ink);
                font-weight: 650;
            }
            .xbot-answer-date-panel {
                position: absolute;
                left: 0;
                bottom: calc(100% + 6px);
                top: auto;
                z-index: 40;
                width: 280px;
                max-width: min(280px, 82vw);
                background: #ffffff;
                border: 1px solid color-mix(in srgb, var(--xbot-theme) 28%, var(--xbot-border));
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
                padding: 12px;
                box-sizing: border-box;
            }
            .xbot-answer-date-panel.is-open-down {
                bottom: auto;
                top: calc(100% + 6px);
            }
            .xbot-answer-date-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 8px;
            }
            .xbot-answer-date-month {
                appearance: none;
                border: 0;
                background: transparent;
                padding: 4px 8px;
                border-radius: 8px;
                font: inherit;
                font-size: 13px;
                font-weight: 700;
                color: var(--xbot-ink);
                cursor: pointer;
                line-height: 1.2;
                transition: background 0.12s ease, color 0.12s ease;
            }
            .xbot-answer-date-month:hover,
            .xbot-answer-date-month:focus-visible {
                background: color-mix(in srgb, var(--xbot-theme) 12%, #ffffff);
                color: var(--xbot-theme);
                outline: none;
            }
            .xbot-answer-date-month[disabled] {
                cursor: default;
                pointer-events: none;
            }
            .xbot-answer-date-nav {
                appearance: none;
                width: 30px;
                height: 30px;
                border: 0;
                border-radius: 999px;
                background: color-mix(in srgb, var(--xbot-theme) 10%, #ffffff);
                color: var(--xbot-theme);
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }
            .xbot-answer-date-nav:hover {
                background: color-mix(in srgb, var(--xbot-theme) 18%, #ffffff);
            }
            .xbot-answer-date-weekdays {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 2px;
                margin-bottom: 4px;
            }
            .xbot-answer-date-weekdays span {
                text-align: center;
                font-size: 11px;
                font-weight: 650;
                color: var(--xbot-subtle);
                padding: 4px 0;
            }
            .xbot-answer-date-weekdays[hidden] {
                display: none;
            }
            .xbot-answer-date-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 2px;
            }
            .xbot-answer-date-grid.is-months,
            .xbot-answer-date-grid.is-years {
                grid-template-columns: repeat(3, 1fr);
                gap: 4px;
                min-height: 196px;
            }
            .xbot-answer-date-day {
                appearance: none;
                border: 0;
                border-radius: 10px;
                background: transparent;
                min-height: 34px;
                font: inherit;
                font-size: 13px;
                color: var(--xbot-ink);
                cursor: pointer;
                transition: background 0.12s ease, color 0.12s ease;
            }
            .xbot-answer-date-grid.is-months .xbot-answer-date-day,
            .xbot-answer-date-grid.is-years .xbot-answer-date-day {
                min-height: 44px;
                font-size: 12px;
                font-weight: 650;
                border-radius: 12px;
            }
            .xbot-answer-date-day.is-empty {
                cursor: default;
                visibility: hidden;
            }
            .xbot-answer-date-day.is-today {
                box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--xbot-theme) 55%, var(--xbot-border));
                color: var(--xbot-theme);
                font-weight: 700;
            }
            .xbot-answer-date-day:hover:not(.is-empty):not(.is-selected) {
                background: color-mix(in srgb, var(--xbot-theme) 12%, #ffffff);
                color: var(--xbot-theme);
                font-weight: 700;
            }
            .xbot-answer-date-day.is-selected {
                background: var(--xbot-theme);
                color: #fff;
                font-weight: 700;
                box-shadow: 0 2px 8px rgba(var(--xbot-theme-rgb), 0.35);
            }
            .xbot-step-progress {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                max-width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--xbot-border);
                border-radius: 999px;
                background: var(--xbot-surface);
                font-size: 13px;
                color: var(--xbot-ink);
            }
            .xbot-step-progress-count {
                font-variant-numeric: tabular-nums;
                font-weight: 650;
                color: var(--xbot-theme);
                white-space: nowrap;
            }
            .xbot-step-progress-label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--xbot-muted);
            }
            .xbot-message video {
                max-width: 100%;
                border-radius: var(--xbot-radius-md);
                display: block;
                margin: 4px 0 8px;
            }
            .xbot-message .xbot-media {
                margin: 0;
            }
            .xbot-presentation-video {
                position: relative;
                width: 100%;
                margin: 4px 0 8px;
                border-radius: var(--xbot-radius-md);
                overflow: hidden;
                background: #111;
                cursor: pointer;
                -webkit-user-select: none;
                user-select: none;
                container-type: inline-size;
                container-name: xbot-pres-video;
            }
            .xbot-presentation-video:focus-visible {
                outline: 2px solid rgba(var(--xbot-theme-rgb), 0.55);
                outline-offset: 2px;
            }
            .xbot-presentation-video video {
                display: block;
                width: 100%;
                max-width: 100%;
                height: auto;
                margin: 0;
                border-radius: 0;
                pointer-events: none;
            }
            .xbot-presentation-video video::-webkit-media-controls,
            .xbot-presentation-video video::-webkit-media-controls-enclosure,
            .xbot-presentation-video video::-webkit-media-controls-panel,
            .xbot-presentation-video video::-webkit-media-controls-start-playback-button {
                display: none !important;
                -webkit-appearance: none;
            }
            .xbot-presentation-unmute {
                position: absolute;
                /* 10% de margem de cada lado; font-size final é ajustado em JS (fitPresentationUnmuteLabel). */
                inset: 0 10%;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-size: 12px !important;
                font-weight: 800;
                letter-spacing: 0.04em;
                line-height: 1.1;
                text-align: center;
                text-transform: uppercase;
                white-space: nowrap;
                overflow: visible;
                color: #fff;
                text-shadow:
                    0 1px 0 rgba(0, 0, 0, 0.35),
                    0 4px 12px rgba(0, 0, 0, 0.65),
                    0 0 28px rgba(0, 0, 0, 0.45);
                background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.06) 55%, transparent 72%);
                pointer-events: none;
                animation: xbot-unmute-breathe 1.7s ease-in-out infinite;
            }
            @keyframes xbot-unmute-breathe {
                0%, 100% { opacity: 0.28; }
                50% { opacity: 1; }
            }
            @media (prefers-reduced-motion: reduce) {
                .xbot-presentation-unmute {
                    animation: none;
                    opacity: 1;
                }
            }
            .xbot-presentation-video.is-unmuted .xbot-presentation-unmute {
                display: none;
            }
            .xbot-compose.is-presentation-locked .xbot-input,
            .xbot-compose.is-presentation-locked .xbot-send,
            .xbot-compose.is-presentation-locked .xbot-icon-btn,
            .xbot-compose.is-choice-locked .xbot-input,
            .xbot-compose.is-choice-locked .xbot-send,
            .xbot-compose.is-choice-locked .xbot-icon-btn,
            .xbot-compose.is-sleep-locked .xbot-input,
            .xbot-compose.is-sleep-locked .xbot-send,
            .xbot-compose.is-sleep-locked .xbot-icon-btn {
                opacity: 0.4;
                cursor: not-allowed;
                pointer-events: none;
            }
            .xbot-send:disabled,
            .xbot-icon-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
                pointer-events: none;
            }
            .xbot-send:disabled:hover,
            .xbot-icon-btn:disabled:hover {
                background: transparent;
                color: inherit;
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
            .xbot-message-row--link {
                width: 100%;
                max-width: 92%;
            }
            .xbot-link-card {
                display: flex;
                flex-direction: column;
                gap: 2px;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                margin: 0;
                padding: 12px 14px;
                border: 1px solid var(--xbot-border);
                border-radius: 12px;
                background: var(--xbot-surface-alt, #f8fafc);
                color: var(--xbot-ink, #0f172a);
                text-decoration: none;
                border-bottom: 1px solid var(--xbot-border);
                overflow: hidden;
            }
            .xbot-link-card:hover {
                opacity: 1;
                border-color: rgba(var(--xbot-theme-rgb), 0.45);
            }
            .xbot-link-card-kicker {
                font-size: 11px;
                font-weight: 650;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: var(--xbot-muted);
            }
            .xbot-link-card-title {
                font-size: 15px;
                font-weight: 650;
                line-height: 1.35;
                color: inherit;
                overflow-wrap: anywhere;
            }
            .xbot-link-card-url {
                font-size: 13px;
                font-weight: 500;
                color: var(--xbot-theme);
                overflow-wrap: anywhere;
                word-break: break-all;
            }

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
            .xbot-think-status {
                font-size: 13px;
                font-weight: 500;
                letter-spacing: 0.01em;
                color: var(--xbot-muted);
                white-space: nowrap;
                opacity: 1;
                transform: translateY(0);
                transition: opacity 0.16s ease, transform 0.16s ease;
            }
            .xbot-think-status.is-swap {
                opacity: 0;
                transform: translateY(3px);
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
                .xbot-media-wrap {
                    width: min(50vw, 14rem);
                }
                .xbot-media-wrap--audio,
                .xbot-media-wrap--file {
                    width: min(78vw, 16rem);
                }
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

        /** Só gruda no fim se o visitante já estava perto do fim (ou force). */
        var messagesAutoScrollPinned = true;
        var suppressMessagesAutoScrollUntil = 0;
        var messagesIgnoreScrollPinUntil = 0;
        var messagesKeyboardOpen = false;
        var messagesStickBound = false;
        var messagesStickScrollRaf = 0;

        function isMessagesNearBottom(el, thresholdPx) {
            if (!el) return true;
            var threshold = thresholdPx == null ? 120 : thresholdPx;
            return (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
        }

        function suppressMessagesAutoScroll(ms) {
            var forMs = ms == null ? 2800 : ms;
            suppressMessagesAutoScrollUntil = Date.now() + forMs;
        }

        /** Ignora scroll “fantasma” de teclado/visualViewport (não despincha o stick). */
        function markMessagesProgrammaticScroll(ms) {
            messagesIgnoreScrollPinUntil = Date.now() + (ms == null ? 480 : ms);
        }

        function scrollMessagesToBottom(opts) {
            opts = opts || {};
            var el = document.getElementById('xbot-messages');
            if (!el) return;
            if (opts.force) messagesAutoScrollPinned = true;
            if (!opts.force) {
                if (Date.now() < suppressMessagesAutoScrollUntil) return;
                if (!messagesAutoScrollPinned) return;
            }
            markMessagesProgrammaticScroll(opts.ignoreMs != null ? opts.ignoreMs : 480);
            var prevBehavior = el.style.scrollBehavior;
            el.style.scrollBehavior = 'auto';
            el.scrollTop = el.scrollHeight;
            el.style.scrollBehavior = prevBehavior;
            messagesAutoScrollPinned = true;
        }

        function scheduleScrollMessagesToBottom(opts) {
            var options = opts || {};
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    scrollMessagesToBottom(options);
                });
            });
        }

        /** Após abrir/fechar teclado: reflow demora; força o fim com retries curtos. */
        function stickMessagesAfterKeyboardChange() {
            messagesAutoScrollPinned = true;
            markMessagesProgrammaticScroll(900);
            scrollMessagesToBottom({ force: true, ignoreMs: 900 });
            scheduleScrollMessagesToBottom({ force: true, ignoreMs: 900 });
            [50, 120, 280, 480].forEach(function (ms) {
                setTimeout(function () {
                    scrollMessagesToBottom({ force: true, ignoreMs: 900 });
                }, ms);
            });
        }

        /** Mantém o fim visível enquanto o pin estiver ativo (mensagem crescendo / Answer / mídia). */
        function requestStickMessagesToBottom() {
            if (messagesStickScrollRaf) return;
            messagesStickScrollRaf = requestAnimationFrame(function () {
                messagesStickScrollRaf = 0;
                scrollMessagesToBottom();
            });
        }

        function bindMessagesStickToBottom(el) {
            if (!el || messagesStickBound) return;
            messagesStickBound = true;
            el.addEventListener('scroll', function () {
                // Resize de teclado/programático não conta como “usuário subiu”.
                if (Date.now() < messagesIgnoreScrollPinUntil) return;
                // Enquanto o visitante lê o histórico, não puxa para o fim.
                messagesAutoScrollPinned = isMessagesNearBottom(el, 120);
            }, { passive: true });
            if (typeof MutationObserver !== 'undefined') {
                var mo = new MutationObserver(function () {
                    requestStickMessagesToBottom();
                });
                mo.observe(el, { childList: true, subtree: true, characterData: true });
            }
            if (typeof ResizeObserver !== 'undefined') {
                var ro = new ResizeObserver(function () {
                    requestStickMessagesToBottom();
                });
                function watchNode(node) {
                    if (node && node.nodeType === 1) {
                        try { ro.observe(node); } catch (e) { /* ignore */ }
                    }
                }
                Array.prototype.forEach.call(el.children || [], watchNode);
                var childMo = new MutationObserver(function (mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                        var added = mutations[i].addedNodes || [];
                        for (var j = 0; j < added.length; j++) watchNode(added[j]);
                    }
                });
                childMo.observe(el, { childList: true });
            }
        }

        /** Abertura / histórico: força as últimas mensagens visíveis (mídia pode atrasar o height). */
        function pinMessagesToLatest() {
            scrollMessagesToBottom({ force: true });
            [40, 120, 320, 700, 1400].forEach(function (ms) {
                setTimeout(function () {
                    scrollMessagesToBottom({ force: true });
                }, ms);
            });
            var el = document.getElementById('xbot-messages');
            if (!el || !el.querySelectorAll) return;
            var media = el.querySelectorAll('img, video');
            for (var i = 0; i < media.length; i++) {
                (function (node) {
                    var bump = function () {
                        scrollMessagesToBottom({ force: true });
                    };
                    if (node.tagName === 'IMG') {
                        if (!node.complete) node.addEventListener('load', bump, { once: true });
                    } else {
                        node.addEventListener('loadedmetadata', bump, { once: true });
                    }
                })(media[i]);
            }
        }

        function bindMediaInteractionScrollGuard(node) {
            if (!node || node.getAttribute('data-xbot-scroll-guard') === '1') return;
            node.setAttribute('data-xbot-scroll-guard', '1');
            var guard = function () {
                suppressMessagesAutoScroll(3200);
            };
            node.addEventListener('pointerdown', guard, { passive: true });
            node.addEventListener('touchstart', guard, { passive: true });
            if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                node.addEventListener('play', guard);
                node.addEventListener('seeking', guard);
            }
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
                pinMessagesToLatest();
                if (isMobileLayout()) {
                    requestAnimationFrame(applyMobileKeyboardLayout);
                }
                var openInput = document.getElementById('xbot-input');
                // Mobile: não focar o input ao abrir — o teclado/viewport compete com play de vídeo
                // e com o scroll até as últimas mensagens.
                if (openInput && typeof openInput.focus === 'function' && !isMobileLayout()) {
                    openInput.focus({ preventScroll: true });
                }
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
        if (messages) bindMessagesStickToBottom(messages);
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

        /** Composer OU campo Answer / texto livre no corpo da mensagem. */
        function isEditableChatTextField(el) {
            if (!el || !chatbox.contains(el)) return false;
            if (el === input) return true;
            var tag = String(el.tagName || '').toLowerCase();
            if (tag === 'textarea') return true;
            if (tag !== 'input') return false;
            var type = String(el.type || 'text').toLowerCase();
            if (
                type === 'button' ||
                type === 'submit' ||
                type === 'checkbox' ||
                type === 'radio' ||
                type === 'file' ||
                type === 'range' ||
                type === 'hidden' ||
                type === 'image' ||
                type === 'reset'
            ) {
                return false;
            }
            return true;
        }

        function isAnyChatTextFieldFocused() {
            return isEditableChatTextField(document.activeElement);
        }

        /** Garante o campo focado (Answer inline) acima do teclado após reflow. */
        function ensureFocusedChatFieldVisible() {
            var ae = document.activeElement;
            if (!ae || !messages.contains(ae)) return;
            try {
                ae.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            } catch (e) { /* ignore */ }
            if (messagesAutoScrollPinned || isMessagesNearBottom(messages, 160)) {
                scrollMessagesToBottom({ force: true, ignoreMs: 900 });
            }
        }

        function scheduleMobileKeyboardLayoutSettle() {
            requestAnimationFrame(applyMobileKeyboardLayout);
            setTimeout(applyMobileKeyboardLayout, 50);
            setTimeout(applyMobileKeyboardLayout, 150);
            setTimeout(applyMobileKeyboardLayout, 350);
        }

        function applyMobileKeyboardLayout() {
            if (!isMobileLayout() || !chatbox.classList.contains('is-open')) {
                if (messagesKeyboardOpen) {
                    messagesKeyboardOpen = false;
                    clearMobilePanelStyles();
                    if (messagesAutoScrollPinned || isMessagesNearBottom(messages, 160)) {
                        stickMessagesAfterKeyboardChange();
                    }
                    return;
                }
                clearMobilePanelStyles();
                return;
            }

            var vv = window.visualViewport;
            var textFocused = isAnyChatTextFieldFocused();
            var keyboardLikely = false;
            if (vv) {
                keyboardLikely = vv.height < window.innerHeight * 0.88;
            }
            // Composer OU Answer inline: foco já indica teclado (iOS abre depois do focus).
            // keyboardLikely cobre o reflow contínuo enquanto o teclado anima.
            var nextKeyboardOpen = !!(textFocused || (keyboardLikely && messagesKeyboardOpen));
            var shouldStick =
                messagesAutoScrollPinned || isMessagesNearBottom(messages, 160);
            var keyboardChanged = nextKeyboardOpen !== messagesKeyboardOpen;

            if (!nextKeyboardOpen) {
                clearMobilePanelStyles();
                messagesKeyboardOpen = false;
                if (keyboardChanged && shouldStick) {
                    stickMessagesAfterKeyboardChange();
                }
                return;
            }

            if (!vv) {
                chatbox.classList.add('xbot-keyboard-open');
                launcher.classList.add('xbot-launcher--hidden');
                messagesKeyboardOpen = true;
                if (keyboardChanged && shouldStick) {
                    stickMessagesAfterKeyboardChange();
                    ensureFocusedChatFieldVisible();
                }
                return;
            }

            // Evita que o reflow do visualViewport despinche o stick.
            if (shouldStick) markMessagesProgrammaticScroll(900);

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
            messagesKeyboardOpen = true;

            // Abriu/fechou teclado OU reflow contínuo com pin: mantém a última mensagem visível.
            if (shouldStick) {
                if (keyboardChanged) {
                    stickMessagesAfterKeyboardChange();
                    ensureFocusedChatFieldVisible();
                    setTimeout(ensureFocusedChatFieldVisible, 120);
                    setTimeout(ensureFocusedChatFieldVisible, 320);
                } else {
                    scheduleScrollMessagesToBottom({ force: true, ignoreMs: 900 });
                    ensureFocusedChatFieldVisible();
                }
            }
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
            // Composer + Answer inline (delegation): qualquer campo de texto do chat.
            chatbox.addEventListener('focusin', function (ev) {
                if (!isEditableChatTextField(ev && ev.target)) return;
                scheduleMobileKeyboardLayoutSettle();
            });
            chatbox.addEventListener('focusout', function () {
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

        function looksLikeLabResultContext(root, pre) {
            var code = pre && (pre.querySelector('code') || pre);
            var cls = (code && (code.getAttribute('class') || '')) || '';
            if (/\blanguage-lab-output\b|\blab-output\b/i.test(cls)) return true;
            var host = root || (pre && pre.parentNode);
            var blob = '';
            if (host && host.textContent) blob += String(host.textContent);
            if (pre) {
                var probe = pre.previousSibling;
                var hops = 0;
                while (probe && hops < 6) {
                    blob = String(probe.textContent || '') + '\n' + blob;
                    probe = probe.previousSibling;
                    hops += 1;
                }
            }
            return /execut(?:ei|ou|amos)\s+no\s+laborat[oó]rio|resultado\s*:\s*$|lab(?:oratory)?\s+result|i\s+ran\s+(?:it\s+)?in\s+the\s+lab|ejecut[eé]\s+en\s+el\s+laboratorio/i.test(blob);
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
                var isLab = looksLikeLabResultContext(root, pre);
                if (isLab) {
                    box.className += ' xbot-code-box--lab is-collapsed';
                    var toggle = document.createElement('button');
                    toggle.type = 'button';
                    toggle.className = 'xbot-lab-toggle';
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.innerHTML =
                        '<span>Resultado do laboratório</span>' +
                        '<span class="xbot-lab-toggle-chevron" aria-hidden="true">▾</span>';
                    toggle.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        var hostBox = ev.currentTarget.closest('.xbot-code-box--lab');
                        if (!hostBox) return;
                        var collapsed = hostBox.classList.toggle('is-collapsed');
                        ev.currentTarget.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                    });
                    box.appendChild(toggle);
                }
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'xbot-copy-btn';
                btn.setAttribute('title', 'Copiar');
                btn.setAttribute('aria-label', 'Copiar');
                btn.innerHTML = XBOT_ICONS.copy;
                btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var button = ev.currentTarget;
                    var payload = button.getAttribute('data-copy') || '';
                    copyPlainText(payload).then(function () {
                        button.setAttribute('title', 'Copiado!');
                        button.setAttribute('aria-label', 'Copiado!');
                        setTimeout(function () {
                            button.setAttribute('title', 'Copiar');
                            button.setAttribute('aria-label', 'Copiar');
                        }, 2000);
                    }).catch(function () {});
                });
                btn.setAttribute('data-copy', value);
                pre.parentNode.insertBefore(box, pre);
                box.appendChild(btn);
                box.appendChild(pre);
            }
        }

        function phoneCountries() {
            return Array.isArray(window.__XBOT_PHONE_COUNTRIES) ? window.__XBOT_PHONE_COUNTRIES : [{ code: '55', name: 'Brasil' }];
        }

        function digitsOnlyPhone(value) {
            return String(value || '').replace(/\D/g, '');
        }

        function validateAnswerClient(answerType, value) {
            var text = String(value || '').trim();
            if (!text) return false;
            var kind = String(answerType || 'text').toLowerCase();
            if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
            if (kind === 'phone') {
                var d = digitsOnlyPhone(text);
                return d.length >= 8 && d.length <= 15;
            }
            if (kind === 'number') return !isNaN(Number(text.replace(',', '.')));
            if (kind === 'scale') {
                var n = Number(String(text).replace(',', '.'));
                if (!isFinite(n) || Math.round(n) !== n) return false;
                return true;
            }
            if (kind === 'url') {
                try {
                    var u = text.indexOf('://') >= 0 ? text : ('https://' + text);
                    var parsed = new URL(u);
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                } catch (e) { return false; }
            }
            if (kind === 'date') {
                return /^\d{4}-\d{2}-\d{2}$/.test(text) || /^\d{2}\/\d{2}\/\d{4}$/.test(text);
            }
            if (kind === 'name') return text.length >= 2;
            if (kind === 'otp') {
                var otpDigits = digitsOnlyPhone(text);
                return otpDigits.length === 6;
            }
            return text.length >= 1;
        }

        /** Abre o popover para cima; se não couber na área de mensagens, abre para baixo. */
        function placeAnswerPopover(panel, anchor) {
            if (!panel || !anchor) return;
            panel.classList.remove('is-open-down');
            var messages = document.getElementById('xbot-messages');
            if (!messages) return;
            var panelH = panel.offsetHeight || 0;
            if (panelH < 8) panelH = panel.classList.contains('xbot-answer-date-panel') ? 300 : 260;
            var anchorRect = anchor.getBoundingClientRect();
            var messagesRect = messages.getBoundingClientRect();
            var spaceAbove = anchorRect.top - messagesRect.top;
            var spaceBelow = messagesRect.bottom - anchorRect.bottom;
            if (spaceAbove < panelH + 10 && spaceBelow > spaceAbove) {
                panel.classList.add('is-open-down');
            }
        }

        function extensionFromFilename(name) {
            var base = String(name || '').trim();
            if (!base || base.indexOf('.') < 0) return '';
            return base.split('.').pop().trim().toLowerCase();
        }

        function fileMatchesAllowedExtensions(file, allowed) {
            if (!file) return false;
            var list = Array.isArray(allowed) ? allowed : [];
            if (!list.length) return true;
            var ext = extensionFromFilename(file.name);
            if (ext && list.indexOf(ext) !== -1) return true;
            var mime = String(file.type || '').toLowerCase();
            if (!mime) return false;
            if (mime === 'image/jpeg' && (list.indexOf('jpg') !== -1 || list.indexOf('jpeg') !== -1)) return true;
            var subtype = mime.split('/').pop().split(';')[0].trim();
            if (subtype === 'jpeg') subtype = 'jpg';
            return !!(subtype && list.indexOf(subtype) !== -1);
        }

        function mountFileInputBlock(block, interactive, opts) {
            var form = document.createElement('div');
            form.className = 'xbot-file-input';
            form.setAttribute('data-xbot', 'file-input');
            form.setAttribute('data-lock-composer', '1');
            form.setAttribute('role', 'group');
            form.setAttribute('aria-label', 'Envio de arquivo');

            var allowed = Array.isArray(block.allowed_extensions) ? block.allowed_extensions.slice() : [];
            var accept = allowed.length
                ? allowed.map(function (e) { return '.' + String(e).replace(/^\./, ''); }).join(',')
                : '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';
            var hintText = allowed.length
                ? ('Formatos: ' + allowed.join(', '))
                : 'PDF, DOC ou imagens';
            var titleText = block.input_placeholder || 'Arraste o arquivo ou clique para enviar';

            var err = document.createElement('div');
            err.className = 'xbot-file-error';
            err.hidden = true;

            var drop = document.createElement('button');
            drop.type = 'button';
            drop.className = 'xbot-file-dropzone';
            drop.setAttribute('aria-label', titleText);

            var icon = document.createElement('span');
            icon.className = 'xbot-file-dropzone-icon';
            icon.innerHTML = XBOT_ICONS.attach;
            icon.setAttribute('aria-hidden', 'true');

            var title = document.createElement('span');
            title.className = 'xbot-file-dropzone-title';
            title.textContent = titleText;

            var hint = document.createElement('span');
            hint.className = 'xbot-file-dropzone-hint';
            hint.textContent = hintText;

            drop.appendChild(icon);
            drop.appendChild(title);
            drop.appendChild(hint);

            var hiddenInput = document.createElement('input');
            hiddenInput.type = 'file';
            hiddenInput.accept = accept;
            hiddenInput.style.display = 'none';
            hiddenInput.setAttribute('tabindex', '-1');

            function lockForm() {
                form.classList.add('is-done');
                drop.disabled = true;
                hiddenInput.disabled = true;
                var buttons = form.querySelectorAll('button');
                for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
            }

            function showError(msg) {
                err.textContent = msg || 'Arquivo inválido.';
                err.hidden = false;
            }

            function submitFile(file) {
                if (!file || sessionEpisodeEnded || form.classList.contains('is-uploading') || form.classList.contains('is-done')) {
                    return;
                }
                if (!fileMatchesAllowedExtensions(file, allowed)) {
                    showError('Formato não aceito. Use: ' + (allowed.length ? allowed.join(', ') : 'pdf, doc, imagens'));
                    return;
                }
                err.hidden = true;
                form.classList.add('is-uploading');
                drop.disabled = true;
                title.textContent = 'Enviando…';
                releaseChoiceComposerLock();
                uploadUserFile(file).then(function (data) {
                    if (data) {
                        lockForm();
                        return;
                    }
                    form.classList.remove('is-uploading');
                    drop.disabled = false;
                    title.textContent = titleText;
                    showError('Não foi possível enviar. Tente de novo.');
                    acquireChoiceComposerLock();
                });
            }

            function submitBack() {
                if (sessionEpisodeEnded) return;
                err.hidden = true;
                lockForm();
                releaseChoiceComposerLock();
                sendUserText('__back__');
            }

            function submitMenu() {
                if (sessionEpisodeEnded) return;
                err.hidden = true;
                lockForm();
                releaseChoiceComposerLock();
                sendUserText('__menu__');
            }

            drop.addEventListener('click', function () {
                if (drop.disabled || sessionEpisodeEnded) return;
                hiddenInput.click();
            });
            hiddenInput.addEventListener('change', function () {
                var file = hiddenInput.files && hiddenInput.files[0];
                hiddenInput.value = '';
                if (file) submitFile(file);
            });

            ;['dragenter', 'dragover'].forEach(function (evtName) {
                drop.addEventListener(evtName, function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (drop.disabled || sessionEpisodeEnded) return;
                    drop.classList.add('is-dragover');
                });
            });
            ;['dragleave', 'dragend', 'drop'].forEach(function (evtName) {
                drop.addEventListener(evtName, function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    drop.classList.remove('is-dragover');
                });
            });
            drop.addEventListener('drop', function (ev) {
                if (drop.disabled || sessionEpisodeEnded) return;
                var dt = ev.dataTransfer;
                var file = dt && dt.files && dt.files[0];
                if (file) submitFile(file);
            });

            form.appendChild(drop);
            form.appendChild(hiddenInput);
            form.appendChild(err);

            if (block.allow_back === true) {
                var backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'xbot-file-back';
                backBtn.textContent = 'Voltar';
                if (!interactive || sessionEpisodeEnded) {
                    backBtn.disabled = true;
                } else {
                    backBtn.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        submitBack();
                    });
                }
                form.appendChild(backBtn);
            }
            if (block.allow_return_menu === true) {
                var menuBtn = document.createElement('button');
                menuBtn.type = 'button';
                menuBtn.className = 'xbot-file-menu';
                menuBtn.textContent = 'Menu';
                if (!interactive || sessionEpisodeEnded) {
                    menuBtn.disabled = true;
                } else {
                    menuBtn.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        submitMenu();
                    });
                }
                form.appendChild(menuBtn);
            }

            if (!interactive || sessionEpisodeEnded) {
                lockForm();
            } else {
                acquireChoiceComposerLock();
            }
            return form;
        }

        function mountAnswerInputBlock(block, interactive, opts) {
            var form = document.createElement('form');
            form.className = 'xbot-answer-input';
            form.setAttribute('data-xbot', 'answer-input');
            form.setAttribute('data-lock-composer', '1');
            form.setAttribute('novalidate', 'novalidate');
            var answerType = String(block.answer_type || 'text').toLowerCase();
            var placeholder = block.input_placeholder || 'Digite sua resposta…';
            var err = document.createElement('div');
            err.className = 'xbot-answer-error';
            err.hidden = true;

            function lockForm() {
                var nodes = form.querySelectorAll('input, button, select');
                for (var i = 0; i < nodes.length; i++) nodes[i].disabled = true;
            }

            function submitValue(raw) {
                var value = String(raw || '').trim();
                if (!value || sessionEpisodeEnded) return;
                if (!validateAnswerClient(answerType, value)) {
                    err.textContent = 'Resposta inválida. Verifique e tente de novo.';
                    err.hidden = false;
                    return;
                }
                err.hidden = true;
                lockForm();
                releaseChoiceComposerLock();
                sendUserText(value);
            }

            function submitBack() {
                if (sessionEpisodeEnded) return;
                err.hidden = true;
                lockForm();
                releaseChoiceComposerLock();
                sendUserText('__back__');
            }

            function submitMenu() {
                if (sessionEpisodeEnded) return;
                err.hidden = true;
                lockForm();
                releaseChoiceComposerLock();
                sendUserText('__menu__');
            }

            if (answerType === 'scale') {
                var scaleMin = Number(block.scale_min);
                var scaleMax = Number(block.scale_max);
                var scaleDefault = Number(block.scale_default);
                if (!isFinite(scaleMin)) scaleMin = 0;
                if (!isFinite(scaleMax)) scaleMax = 10;
                if (scaleMax < scaleMin) {
                    var swapScale = scaleMin;
                    scaleMin = scaleMax;
                    scaleMax = swapScale;
                }
                if (!isFinite(scaleDefault)) {
                    scaleDefault = scaleMin + Math.floor((scaleMax - scaleMin) / 2);
                }
                scaleDefault = Math.max(scaleMin, Math.min(scaleMax, Math.round(scaleDefault)));

                var scaleWrap = document.createElement('div');
                scaleWrap.className = 'xbot-answer-scale';
                scaleWrap.setAttribute('role', 'group');
                scaleWrap.setAttribute('aria-label', placeholder || 'Escala');

                var scaleValue = document.createElement('div');
                scaleValue.className = 'xbot-answer-scale-value';
                scaleValue.textContent = String(scaleDefault);

                var scaleRow = document.createElement('div');
                scaleRow.className = 'xbot-answer-scale-row';

                var scaleMinLbl = document.createElement('span');
                scaleMinLbl.className = 'xbot-answer-scale-bound';
                scaleMinLbl.textContent = String(scaleMin);

                var range = document.createElement('input');
                range.type = 'range';
                range.className = 'xbot-answer-scale-slider';
                range.min = String(scaleMin);
                range.max = String(scaleMax);
                range.step = '1';
                range.value = String(scaleDefault);
                range.setAttribute('aria-valuemin', String(scaleMin));
                range.setAttribute('aria-valuemax', String(scaleMax));
                range.setAttribute('aria-valuenow', String(scaleDefault));
                range.setAttribute('aria-label', 'Nota de ' + scaleMin + ' a ' + scaleMax);

                var scaleMaxLbl = document.createElement('span');
                scaleMaxLbl.className = 'xbot-answer-scale-bound';
                scaleMaxLbl.textContent = String(scaleMax);

                function syncScaleUi() {
                    var v = String(range.value);
                    var num = Number(range.value);
                    var span = scaleMax - scaleMin;
                    var pct = span > 0 ? ((num - scaleMin) / span) * 100 : 0;
                    if (!isFinite(pct)) pct = 0;
                    pct = Math.max(0, Math.min(100, pct));
                    scaleValue.textContent = v;
                    range.setAttribute('aria-valuenow', v);
                    range.style.setProperty('--xbot-scale-pct', pct + '%');
                }
                range.addEventListener('input', syncScaleUi);
                range.addEventListener('change', syncScaleUi);
                syncScaleUi();

                scaleRow.appendChild(scaleMinLbl);
                scaleRow.appendChild(range);
                scaleRow.appendChild(scaleMaxLbl);

                var scaleActions = document.createElement('div');
                scaleActions.className = 'xbot-answer-scale-actions';
                var sendScale = document.createElement('button');
                sendScale.type = 'submit';
                sendScale.className = 'xbot-answer-send';
                sendScale.setAttribute('aria-label', 'Enviar');
                sendScale.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                scaleActions.appendChild(sendScale);

                scaleWrap.appendChild(scaleValue);
                scaleWrap.appendChild(scaleRow);
                scaleWrap.appendChild(scaleActions);
                form.appendChild(scaleWrap);
                form.appendChild(err);
                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    submitValue(range.value);
                });
            } else if (answerType === 'phone') {
                var row = document.createElement('div');
                row.className = 'xbot-answer-phone-row';
                var countryWrap = document.createElement('div');
                countryWrap.className = 'xbot-answer-country';
                var countryBtn = document.createElement('button');
                countryBtn.type = 'button';
                countryBtn.className = 'xbot-answer-country-btn';
                var countryCode = digitsOnlyPhone(block.default_country_code) || '55';
                countryBtn.textContent = '+' + countryCode;
                var countryPanel = document.createElement('div');
                countryPanel.className = 'xbot-answer-country-panel';
                countryPanel.hidden = true;
                var countrySearch = document.createElement('input');
                countrySearch.type = 'text';
                countrySearch.className = 'xbot-answer-country-search';
                countrySearch.placeholder = 'Buscar país ou código…';
                countrySearch.autocomplete = 'off';
                var countryList = document.createElement('ul');
                countryList.className = 'xbot-answer-country-list';
                countryList.setAttribute('role', 'listbox');

                function renderCountries(filter) {
                    countryList.innerHTML = '';
                    var q = String(filter || '').trim().toLowerCase();
                    var list = phoneCountries();
                    for (var i = 0; i < list.length; i++) {
                        var c = list[i];
                        if (!c) continue;
                        var label = '+' + c.code + ' — ' + c.name;
                        if (q && label.toLowerCase().indexOf(q) < 0 && String(c.code).indexOf(q) < 0) continue;
                        var li = document.createElement('li');
                        var opt = document.createElement('button');
                        opt.type = 'button';
                        opt.className = 'xbot-answer-country-option' + (c.code === countryCode ? ' is-selected' : '');
                        opt.textContent = label;
                        opt.setAttribute('data-code', c.code);
                        opt.addEventListener('click', function (ev) {
                            countryCode = digitsOnlyPhone(ev.currentTarget.getAttribute('data-code')) || '55';
                            countryBtn.textContent = '+' + countryCode;
                            countryPanel.hidden = true;
                            countrySearch.value = '';
                            renderCountries('');
                            areaInput.style.display = countryCode === '55' ? '' : 'none';
                            if (countryCode !== '55') areaInput.value = '';
                            focusPhoneFirstFillable();
                        });
                        li.appendChild(opt);
                        countryList.appendChild(li);
                        if (countryList.childNodes.length >= 80) break;
                    }
                }
                renderCountries('');
                countrySearch.addEventListener('input', function () { renderCountries(countrySearch.value); });
                countryBtn.addEventListener('click', function () {
                    if (!interactive || sessionEpisodeEnded) return;
                    var opening = !!countryPanel.hidden;
                    countryPanel.hidden = !opening;
                    if (opening) {
                        placeAnswerPopover(countryPanel, countryBtn);
                        countrySearch.focus();
                    }
                });
                countryWrap.appendChild(countryBtn);
                countryPanel.appendChild(countrySearch);
                countryPanel.appendChild(countryList);
                countryWrap.appendChild(countryPanel);

                var areaInput = document.createElement('input');
                areaInput.type = 'tel';
                areaInput.inputMode = 'numeric';
                areaInput.className = 'xbot-answer-area';
                areaInput.placeholder = 'DDD';
                areaInput.maxLength = 2;
                areaInput.style.display = countryCode === '55' ? '' : 'none';
                areaInput.setAttribute('aria-label', 'DDD');

                var nationalInput = document.createElement('input');
                nationalInput.type = 'tel';
                nationalInput.inputMode = 'numeric';
                nationalInput.className = 'xbot-answer-field xbot-answer-national';
                nationalInput.placeholder = placeholder;
                nationalInput.autocomplete = 'tel-national';
                nationalInput.setAttribute('aria-label', 'Número');

                var sendBtn = document.createElement('button');
                sendBtn.type = 'submit';
                sendBtn.className = 'xbot-answer-send';
                sendBtn.setAttribute('aria-label', 'Enviar');
                sendBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

                function phoneTabStops() {
                    var stops = [countryBtn];
                    if (isAnswerFieldFocusable(areaInput)) stops.push(areaInput);
                    if (isAnswerFieldFocusable(nationalInput)) stops.push(nationalInput);
                    if (!sendBtn.disabled) stops.push(sendBtn);
                    return stops;
                }

                function focusPhoneFirstFillable() {
                    var target = isAnswerFieldFocusable(areaInput) ? areaInput : nationalInput;
                    if (!target || typeof target.focus !== 'function') return;
                    try {
                        target.focus({ preventScroll: true });
                    } catch (e) {
                        try { target.focus(); } catch (e2) { /* ignore */ }
                    }
                }

                /** Tab / Shift+Tab navega país → DDD → número → enviar (sem ciclar; sai para Voltar). */
                function onPhoneTabKey(ev) {
                    if (ev.key !== 'Tab' || sessionEpisodeEnded) return;
                    var stops = phoneTabStops();
                    if (stops.length < 2) return;
                    var idx = stops.indexOf(ev.currentTarget);
                    if (idx < 0) return;
                    var nextIdx = ev.shiftKey ? idx - 1 : idx + 1;
                    if (nextIdx < 0 || nextIdx >= stops.length) return;
                    var next = stops[nextIdx];
                    if (!next) return;
                    ev.preventDefault();
                    try {
                        next.focus({ preventScroll: true });
                    } catch (e) {
                        try { next.focus(); } catch (e2) { /* ignore */ }
                    }
                }

                countryBtn.addEventListener('keydown', onPhoneTabKey);
                areaInput.addEventListener('keydown', onPhoneTabKey);
                nationalInput.addEventListener('keydown', onPhoneTabKey);
                sendBtn.addEventListener('keydown', onPhoneTabKey);

                row.appendChild(countryWrap);
                row.appendChild(areaInput);
                row.appendChild(nationalInput);
                row.appendChild(sendBtn);
                form.appendChild(row);
                form.appendChild(err);

                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    var area = countryCode === '55' ? digitsOnlyPhone(areaInput.value) : '';
                    var national = digitsOnlyPhone(nationalInput.value);
                    submitValue(countryCode + area + national);
                });
            } else if (answerType === 'otp') {
                var otpLen = 6;
                var otpRow = document.createElement('div');
                otpRow.className = 'xbot-answer-otp-row';
                var otpDigits = document.createElement('div');
                otpDigits.className = 'xbot-answer-otp-digits';
                otpDigits.setAttribute('role', 'group');
                otpDigits.setAttribute('aria-label', 'Código de verificação');
                var otpInputs = [];
                var otpSubmitting = false;

                function otpCodeValue() {
                    var out = '';
                    for (var i = 0; i < otpInputs.length; i++) {
                        out += digitsOnlyPhone(otpInputs[i].value).slice(0, 1);
                    }
                    return out;
                }

                function focusOtpAt(idx) {
                    var target = otpInputs[idx];
                    if (!target || typeof target.focus !== 'function') return;
                    try {
                        target.focus({ preventScroll: true });
                        target.select();
                    } catch (e) {
                        try { target.focus(); } catch (e2) { /* ignore */ }
                    }
                }

                function fillOtpFrom(startIdx, digits) {
                    var chars = digitsOnlyPhone(digits);
                    if (!chars) return;
                    var i = startIdx;
                    var c = 0;
                    while (i < otpLen && c < chars.length) {
                        otpInputs[i].value = chars.charAt(c);
                        i += 1;
                        c += 1;
                    }
                    if (i < otpLen) focusOtpAt(i);
                    else focusOtpAt(otpLen - 1);
                    maybeAutoSubmitOtp();
                }

                function submitOtpOnce(code) {
                    if (otpSubmitting || sessionEpisodeEnded) return;
                    var value = String(code || otpCodeValue() || '').trim();
                    if (value.length !== otpLen) return;
                    if (!validateAnswerClient(answerType, value)) {
                        err.textContent = 'Resposta inválida. Verifique e tente de novo.';
                        err.hidden = false;
                        return;
                    }
                    otpSubmitting = true;
                    err.hidden = true;
                    lockForm();
                    releaseChoiceComposerLock();
                    sendUserText(value);
                }

                function maybeAutoSubmitOtp() {
                    if (otpSubmitting || sessionEpisodeEnded) return;
                    var code = otpCodeValue();
                    if (code.length !== otpLen) return;
                    submitOtpOnce(code);
                }

                for (var d = 0; d < otpLen; d++) {
                    (function (idx) {
                        var digit = document.createElement('input');
                        digit.type = 'text';
                        digit.inputMode = 'numeric';
                        digit.autocomplete = idx === 0 ? 'one-time-code' : 'off';
                        digit.className = 'xbot-answer-otp-digit';
                        digit.maxLength = 1;
                        digit.setAttribute('aria-label', 'Dígito ' + (idx + 1) + ' de ' + otpLen);
                        digit.setAttribute('data-otp-index', String(idx));
                        digit.addEventListener('input', function () {
                            var raw = digit.value;
                            var only = digitsOnlyPhone(raw);
                            if (only.length > 1) {
                                digit.value = '';
                                fillOtpFrom(idx, only);
                                return;
                            }
                            digit.value = only.slice(0, 1);
                            if (digit.value && idx < otpLen - 1) focusOtpAt(idx + 1);
                            maybeAutoSubmitOtp();
                        });
                        digit.addEventListener('keydown', function (ev) {
                            if (ev.key === 'Backspace') {
                                if (!digit.value && idx > 0) {
                                    ev.preventDefault();
                                    otpInputs[idx - 1].value = '';
                                    focusOtpAt(idx - 1);
                                }
                                return;
                            }
                            if (ev.key === 'ArrowLeft' && idx > 0) {
                                ev.preventDefault();
                                focusOtpAt(idx - 1);
                                return;
                            }
                            if (ev.key === 'ArrowRight' && idx < otpLen - 1) {
                                ev.preventDefault();
                                focusOtpAt(idx + 1);
                                return;
                            }
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                submitOtpOnce(otpCodeValue());
                            }
                        });
                        digit.addEventListener('paste', function (ev) {
                            var clip = '';
                            try {
                                clip = (ev.clipboardData || window.clipboardData).getData('text') || '';
                            } catch (e) { clip = ''; }
                            var pasted = digitsOnlyPhone(clip);
                            if (!pasted) return;
                            ev.preventDefault();
                            fillOtpFrom(idx, pasted);
                        });
                        otpInputs.push(digit);
                        otpDigits.appendChild(digit);
                    })(d);
                }

                var sendOtp = document.createElement('button');
                sendOtp.type = 'submit';
                sendOtp.className = 'xbot-answer-send';
                sendOtp.setAttribute('aria-label', 'Enviar');
                sendOtp.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

                otpRow.appendChild(otpDigits);
                otpRow.appendChild(sendOtp);
                form.appendChild(otpRow);
                form.appendChild(err);
                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    submitOtpOnce(otpCodeValue());
                });
                if (interactive && !sessionEpisodeEnded) {
                    setTimeout(function () { focusOtpAt(0); }, 0);
                }
            } else if (answerType === 'date') {
                var dateRow = document.createElement('div');
                dateRow.className = 'xbot-answer-row xbot-answer-date-row';
                var dateWrap = document.createElement('div');
                dateWrap.className = 'xbot-answer-date';
                var dateTrigger = document.createElement('button');
                dateTrigger.type = 'button';
                dateTrigger.className = 'xbot-answer-date-trigger';
                dateTrigger.textContent = 'Selecionar data';
                var selectedIso = '';
                var view = new Date();
                view.setDate(1);
                view.setHours(12, 0, 0, 0);
                var calMode = 'days';

                var panel = document.createElement('div');
                panel.className = 'xbot-answer-date-panel';
                panel.hidden = true;
                var head = document.createElement('div');
                head.className = 'xbot-answer-date-head';
                var prevBtn = document.createElement('button');
                prevBtn.type = 'button';
                prevBtn.className = 'xbot-answer-date-nav';
                prevBtn.setAttribute('aria-label', 'Mês anterior');
                prevBtn.textContent = '‹';
                var monthLabel = document.createElement('button');
                monthLabel.type = 'button';
                monthLabel.className = 'xbot-answer-date-month';
                monthLabel.setAttribute('aria-label', 'Escolher mês e ano');
                var nextBtn = document.createElement('button');
                nextBtn.type = 'button';
                nextBtn.className = 'xbot-answer-date-nav';
                nextBtn.setAttribute('aria-label', 'Próximo mês');
                nextBtn.textContent = '›';
                head.appendChild(prevBtn);
                head.appendChild(monthLabel);
                head.appendChild(nextBtn);
                var weekdays = document.createElement('div');
                weekdays.className = 'xbot-answer-date-weekdays';
                ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(function (w) {
                    var cell = document.createElement('span');
                    cell.textContent = w;
                    weekdays.appendChild(cell);
                });
                var grid = document.createElement('div');
                grid.className = 'xbot-answer-date-grid';
                panel.appendChild(head);
                panel.appendChild(weekdays);
                panel.appendChild(grid);

                var MONTHS_PT = [
                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                ];
                var MONTHS_SHORT_PT = [
                    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
                ];

                function pad2(n) { return n < 10 ? '0' + n : String(n); }
                function toIso(d) {
                    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
                }
                function formatBr(iso) {
                    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (!m) return '';
                    return m[3] + '/' + m[2] + '/' + m[1];
                }
                function decadeStart(y) {
                    return Math.floor(y / 10) * 10;
                }

                function renderCalendar() {
                    var year = view.getFullYear();
                    var month = view.getMonth();
                    var today = new Date();
                    var todayYear = today.getFullYear();
                    var todayMonth = today.getMonth();
                    var selectedParts = String(selectedIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    var selectedYear = selectedParts ? Number(selectedParts[1]) : null;
                    var selectedMonth = selectedParts ? Number(selectedParts[2]) - 1 : null;
                    grid.innerHTML = '';
                    grid.className = 'xbot-answer-date-grid';
                    weekdays.hidden = calMode !== 'days';
                    monthLabel.disabled = false;

                    if (calMode === 'years') {
                        var start = decadeStart(year);
                        var end = start + 9;
                        monthLabel.textContent = start + ' – ' + end;
                        monthLabel.setAttribute('aria-label', 'Década ' + start + ' a ' + end);
                        monthLabel.disabled = true;
                        prevBtn.setAttribute('aria-label', 'Década anterior');
                        nextBtn.setAttribute('aria-label', 'Próxima década');
                        grid.className += ' is-years';
                        for (var y = start; y <= end; y++) {
                            (function (yr) {
                                var yearBtn = document.createElement('button');
                                yearBtn.type = 'button';
                                yearBtn.className = 'xbot-answer-date-day';
                                yearBtn.textContent = String(yr);
                                if (yr === todayYear) yearBtn.className += ' is-today';
                                if (selectedYear === yr) yearBtn.className += ' is-selected';
                                yearBtn.addEventListener('click', function () {
                                    view.setFullYear(yr);
                                    calMode = 'months';
                                    renderCalendar();
                                });
                                grid.appendChild(yearBtn);
                            })(y);
                        }
                        return;
                    }

                    if (calMode === 'months') {
                        monthLabel.textContent = String(year);
                        monthLabel.setAttribute('aria-label', 'Escolher ano');
                        prevBtn.setAttribute('aria-label', 'Ano anterior');
                        nextBtn.setAttribute('aria-label', 'Próximo ano');
                        grid.className += ' is-months';
                        for (var m = 0; m < 12; m++) {
                            (function (mo) {
                                var monthBtn = document.createElement('button');
                                monthBtn.type = 'button';
                                monthBtn.className = 'xbot-answer-date-day';
                                monthBtn.textContent = MONTHS_SHORT_PT[mo];
                                if (year === todayYear && mo === todayMonth) monthBtn.className += ' is-today';
                                if (selectedYear === year && selectedMonth === mo) monthBtn.className += ' is-selected';
                                monthBtn.addEventListener('click', function () {
                                    view.setMonth(mo);
                                    calMode = 'days';
                                    renderCalendar();
                                });
                                grid.appendChild(monthBtn);
                            })(m);
                        }
                        return;
                    }

                    monthLabel.textContent = MONTHS_PT[month] + ' ' + year;
                    monthLabel.setAttribute('aria-label', 'Escolher mês e ano');
                    prevBtn.setAttribute('aria-label', 'Mês anterior');
                    nextBtn.setAttribute('aria-label', 'Próximo mês');
                    var firstDow = new Date(year, month, 1).getDay();
                    var daysInMonth = new Date(year, month + 1, 0).getDate();
                    var todayIso = toIso(today);
                    var i;
                    for (i = 0; i < firstDow; i++) {
                        var empty = document.createElement('span');
                        empty.className = 'xbot-answer-date-day is-empty';
                        grid.appendChild(empty);
                    }
                    for (var day = 1; day <= daysInMonth; day++) {
                        var iso = year + '-' + pad2(month + 1) + '-' + pad2(day);
                        var dayBtn = document.createElement('button');
                        dayBtn.type = 'button';
                        dayBtn.className = 'xbot-answer-date-day';
                        dayBtn.textContent = String(day);
                        dayBtn.setAttribute('data-iso', iso);
                        if (iso === todayIso) dayBtn.className += ' is-today';
                        if (iso === selectedIso) dayBtn.className += ' is-selected';
                        dayBtn.addEventListener('click', function (ev) {
                            selectedIso = ev.currentTarget.getAttribute('data-iso') || '';
                            dateTrigger.textContent = formatBr(selectedIso) || 'Selecionar data';
                            dateTrigger.classList.add('has-value');
                            panel.hidden = true;
                            calMode = 'days';
                            renderCalendar();
                        });
                        grid.appendChild(dayBtn);
                    }
                }
                renderCalendar();

                monthLabel.addEventListener('click', function () {
                    if (calMode === 'days') calMode = 'months';
                    else if (calMode === 'months') calMode = 'years';
                    renderCalendar();
                });
                prevBtn.addEventListener('click', function () {
                    if (calMode === 'years') view.setFullYear(view.getFullYear() - 10);
                    else if (calMode === 'months') view.setFullYear(view.getFullYear() - 1);
                    else view.setMonth(view.getMonth() - 1);
                    renderCalendar();
                });
                nextBtn.addEventListener('click', function () {
                    if (calMode === 'years') view.setFullYear(view.getFullYear() + 10);
                    else if (calMode === 'months') view.setFullYear(view.getFullYear() + 1);
                    else view.setMonth(view.getMonth() + 1);
                    renderCalendar();
                });
                dateTrigger.addEventListener('click', function () {
                    if (!interactive || sessionEpisodeEnded) return;
                    var opening = !!panel.hidden;
                    panel.hidden = !opening;
                    if (opening) {
                        calMode = 'days';
                        renderCalendar();
                        placeAnswerPopover(panel, dateTrigger);
                    }
                });

                dateWrap.appendChild(dateTrigger);
                dateWrap.appendChild(panel);
                var sendDate = document.createElement('button');
                sendDate.type = 'submit';
                sendDate.className = 'xbot-answer-send';
                sendDate.setAttribute('aria-label', 'Enviar');
                sendDate.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                dateRow.appendChild(dateWrap);
                dateRow.appendChild(sendDate);
                form.appendChild(dateRow);
                form.appendChild(err);
                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    if (!selectedIso) {
                        err.textContent = 'Selecione uma data.';
                        err.hidden = false;
                        return;
                    }
                    submitValue(selectedIso);
                });
            } else {
                var row2 = document.createElement('div');
                row2.className = 'xbot-answer-row';
                var input = document.createElement('input');
                input.className = 'xbot-answer-field';
                input.placeholder = placeholder;
                if (answerType === 'email') { input.type = 'email'; input.autocomplete = 'email'; }
                else if (answerType === 'number') { input.type = 'number'; input.inputMode = 'decimal'; }
                else if (answerType === 'url') { input.type = 'url'; input.autocomplete = 'url'; }
                else if (answerType === 'name') { input.type = 'text'; input.autocomplete = 'name'; }
                else { input.type = 'text'; }
                var send2 = document.createElement('button');
                send2.type = 'submit';
                send2.className = 'xbot-answer-send';
                send2.setAttribute('aria-label', 'Enviar');
                send2.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                row2.appendChild(input);
                row2.appendChild(send2);
                form.appendChild(row2);
                form.appendChild(err);
                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    submitValue(input.value);
                });
            }

            if (block.allow_back === true) {
                var backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.className = 'xbot-answer-back';
                backBtn.textContent = 'Voltar';
                if (!interactive || sessionEpisodeEnded) {
                    backBtn.disabled = true;
                } else {
                    backBtn.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        submitBack();
                    });
                }
                form.appendChild(backBtn);
            }
            if (block.allow_return_menu === true) {
                var menuBtnAns = document.createElement('button');
                menuBtnAns.type = 'button';
                menuBtnAns.className = 'xbot-answer-menu';
                menuBtnAns.textContent = 'Menu';
                if (!interactive || sessionEpisodeEnded) {
                    menuBtnAns.disabled = true;
                } else {
                    menuBtnAns.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        submitMenu();
                    });
                }
                form.appendChild(menuBtnAns);
            }

            if (!interactive || sessionEpisodeEnded) {
                lockForm();
            } else {
                acquireChoiceComposerLock();
            }
            return form;
        }

        function mountStructuredBlocks(host, blocks, opts) {
            if (!host || !Array.isArray(blocks) || !blocks.length) return;
            if (host.querySelector && host.querySelector('.xbot-ui-blocks')) return;
            var interactive = !opts || opts.interactive !== false;
            var wrap = document.createElement('div');
            wrap.className = 'xbot-ui-blocks';
            wrap.setAttribute('data-xbot', 'ui-blocks');

            function lockChoices(root) {
                var buttons = root.querySelectorAll('.xbot-choice-item, .xbot-choice-free-send, .xbot-choice-back, .xbot-choice-menu');
                for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
                var inputs = root.querySelectorAll('.xbot-choice-free input');
                for (var j = 0; j < inputs.length; j++) inputs[j].disabled = true;
            }

            blocks.forEach(function (block) {
                if (!block) return;
                if (block.kind === 'recap') {
                    var recap = document.createElement('section');
                    recap.className = 'xbot-recap';
                    recap.setAttribute('data-xbot', 'recap');
                    if (block.title) {
                        var recapTitle = document.createElement('h3');
                        recapTitle.className = 'xbot-recap-title';
                        recapTitle.textContent = block.title;
                        recap.appendChild(recapTitle);
                    }
                    var dl = document.createElement('dl');
                    dl.className = 'xbot-recap-list';
                    (block.fields || []).forEach(function (field) {
                        var item = document.createElement('div');
                        item.className = 'xbot-recap-item';
                        var dt = document.createElement('dt');
                        dt.textContent = field.label;
                        var dd = document.createElement('dd');
                        dd.textContent = field.value;
                        item.appendChild(dt);
                        item.appendChild(dd);
                        dl.appendChild(item);
                    });
                    recap.appendChild(dl);
                    wrap.appendChild(recap);
                    return;
                }
                if (block.kind === 'choice_list') {
                    var list = document.createElement('div');
                    list.className = 'xbot-choice-list';
                    list.setAttribute('data-xbot', 'choice-list');
                    list.setAttribute('role', 'group');
                    list.setAttribute('aria-label', block.title || 'Opções');
                    var lockComposer = block.allow_free_text === false;
                    if (lockComposer) list.setAttribute('data-lock-composer', '1');
                    if (block.title) {
                        var listTitle = document.createElement('div');
                        listTitle.className = 'xbot-choice-list-title';
                        listTitle.textContent = block.title;
                        list.appendChild(listTitle);
                    }
                    var body = document.createElement('div');
                    body.className = 'xbot-choice-list-body';
                    (block.choices || []).forEach(function (choice, index) {
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'xbot-choice-item';
                        var choiceValue = choice.value || choice.label || '';
                        var choiceLabel = choice.label || choiceValue;
                        btn.setAttribute('data-choice-value', choiceValue);
                        btn.setAttribute('data-choice-label', choiceLabel);
                        if (choice.id) btn.setAttribute('data-choice-id', String(choice.id));
                        var idx = document.createElement('span');
                        idx.className = 'xbot-choice-index';
                        idx.textContent = String(index + 1);
                        var copy = document.createElement('span');
                        copy.className = 'xbot-choice-copy';
                        var lab = document.createElement('span');
                        lab.className = 'xbot-choice-label';
                        lab.textContent = choice.label;
                        copy.appendChild(lab);
                        if (choice.description) {
                            var desc = document.createElement('span');
                            desc.className = 'xbot-choice-desc';
                            desc.textContent = choice.description;
                            copy.appendChild(desc);
                        }
                        btn.appendChild(idx);
                        btn.appendChild(copy);
                        if (!interactive || sessionEpisodeEnded) {
                            btn.disabled = true;
                        } else {
                            btn.addEventListener('click', function () {
                                if (sessionEpisodeEnded) return;
                                lockChoices(list);
                                if (lockComposer) releaseChoiceComposerLock();
                                sendUserText(choiceLabel, {
                                    action: {
                                        id: choice.id || ('choice-' + index),
                                        label: choiceLabel,
                                        value: choiceValue,
                                        kind: 'reply'
                                    }
                                });
                            });
                        }
                        body.appendChild(btn);
                    });
                    list.appendChild(body);
                    if (block.allow_free_text !== false) {
                        var free = document.createElement('div');
                        free.className = 'xbot-choice-free';
                        var freeInput = document.createElement('input');
                        freeInput.type = 'text';
                        freeInput.maxLength = 500;
                        freeInput.placeholder = block.free_text_placeholder || 'Outra coisa? Escreva com suas palavras…';
                        freeInput.setAttribute('aria-label', 'Responder com suas palavras');
                        var freeSend = document.createElement('button');
                        freeSend.type = 'button';
                        freeSend.className = 'xbot-choice-free-send';
                        freeSend.setAttribute('aria-label', 'Enviar resposta');
                        freeSend.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
                        function sendFree() {
                            var value = String(freeInput.value || '').trim();
                            if (!value || sessionEpisodeEnded) return;
                            lockChoices(list);
                            sendUserText(value);
                        }
                        if (!interactive || sessionEpisodeEnded) {
                            freeInput.disabled = true;
                            freeSend.disabled = true;
                        } else {
                            freeSend.addEventListener('click', sendFree);
                            freeInput.addEventListener('keydown', function (ev) {
                                if (ev.key === 'Enter') {
                                    ev.preventDefault();
                                    sendFree();
                                }
                            });
                        }
                        free.appendChild(freeInput);
                        free.appendChild(freeSend);
                        list.appendChild(free);
                    } else if (interactive && !sessionEpisodeEnded) {
                        acquireChoiceComposerLock();
                    }
                    if (block.allow_back === true) {
                        var choiceBack = document.createElement('button');
                        choiceBack.type = 'button';
                        choiceBack.className = 'xbot-choice-back';
                        choiceBack.textContent = 'Voltar';
                        if (!interactive || sessionEpisodeEnded) {
                            choiceBack.disabled = true;
                        } else {
                            choiceBack.addEventListener('click', function () {
                                if (sessionEpisodeEnded) return;
                                lockChoices(list);
                                if (lockComposer) releaseChoiceComposerLock();
                                sendUserText('__back__');
                            });
                        }
                        body.appendChild(choiceBack);
                    }
                    if (block.allow_return_menu === true) {
                        var choiceMenu = document.createElement('button');
                        choiceMenu.type = 'button';
                        choiceMenu.className = 'xbot-choice-menu';
                        choiceMenu.textContent = 'Menu';
                        if (!interactive || sessionEpisodeEnded) {
                            choiceMenu.disabled = true;
                        } else {
                            choiceMenu.addEventListener('click', function () {
                                if (sessionEpisodeEnded) return;
                                lockChoices(list);
                                if (lockComposer) releaseChoiceComposerLock();
                                sendUserText('__menu__');
                            });
                        }
                        body.appendChild(choiceMenu);
                    }
                    wrap.appendChild(list);
                    return;
                }
                if (block.kind === 'answer_input') {
                    wrap.appendChild(mountAnswerInputBlock(block, interactive, opts));
                    return;
                }
                if (block.kind === 'file_input') {
                    wrap.appendChild(mountFileInputBlock(block, interactive, opts));
                    return;
                }
                if (block.kind === 'step_progress') {
                    var step = document.createElement('div');
                    step.className = 'xbot-step-progress';
                    step.setAttribute('data-xbot', 'step-progress');
                    step.setAttribute('role', 'status');
                    var count = document.createElement('span');
                    count.className = 'xbot-step-progress-count';
                    count.textContent = 'Passo ' + block.current + ' / ' + block.total;
                    step.appendChild(count);
                    if (block.label) {
                        var sep = document.createElement('span');
                        sep.setAttribute('aria-hidden', 'true');
                        sep.textContent = '·';
                        var lab = document.createElement('span');
                        lab.className = 'xbot-step-progress-label';
                        lab.textContent = block.label;
                        step.appendChild(sep);
                        step.appendChild(lab);
                    }
                    wrap.appendChild(step);
                }
            });
            if (wrap.childNodes.length) host.appendChild(wrap);
            if (interactive && !sessionEpisodeEnded && wrap.querySelector(
                '[data-xbot="answer-input"], .xbot-choice-free input'
            )) {
                focusInlineBodyInput(wrap);
            }
        }

        function mountReplyActions(host, actions, opts) {
            if (!host || !Array.isArray(actions) || !actions.length) return;
            // Grid de catálogo já oferece as opções nos cards.
            if (host.querySelector && host.querySelector('[data-xbot="catalog-grid"]')) return;
            if (host.querySelector && host.querySelector('[data-xbot="locate-grid"]')) return;
            if (host.querySelector && host.querySelector('[data-xbot="choice-list"]')) return;
            if (blocksHaveChoiceList(opts && opts.blocks)) return;
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
                        var replyLabel = action.label || action.value;
                        var replyValue = action.value || action.label;
                        sendUserText(replyLabel, {
                            action: {
                                id: action.id || 'action',
                                label: replyLabel,
                                value: replyValue,
                                kind: 'reply'
                            }
                        });
                    });
                }
                group.appendChild(btn);
            });
            host.appendChild(group);
        }

        function enhanceCatalogGrid(root, opts) {
            if (!root || !root.querySelectorAll) return;
            var grid = root.querySelector(
                '.xbot-catalog-grid, [data-xbot="catalog-grid"], .xbot-locate-grid, [data-xbot="locate-grid"]'
            );
            var cards = root.querySelectorAll(
                '.xbot-catalog-card, [data-xbot-card="catalog"], .xbot-locate-card, [data-xbot-card="locate"]'
            );
            if (!cards.length) return;
            var interactive = !opts || opts.interactive !== false;
            var animateTyping = !!(opts && opts.animateTyping) && interactive && !sessionEpisodeEnded;
            var typingLocked = false;

            if (grid) {
                if (grid.getAttribute('data-xbot') === 'locate-grid' || grid.classList.contains('xbot-locate-grid')) {
                    if (!grid.classList.contains('xbot-locate-grid')) grid.classList.add('xbot-locate-grid');
                } else if (!grid.classList.contains('xbot-catalog-grid')) {
                    grid.classList.add('xbot-catalog-grid');
                }
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
                    ? ev.target.closest(
                        '.xbot-catalog-card, [data-xbot-card="catalog"], .xbot-locate-card, [data-xbot-card="locate"]'
                    )
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
                    ? ev.target.closest(
                        '.xbot-catalog-card, [data-xbot-card="catalog"], .xbot-locate-card, [data-xbot-card="locate"]'
                    )
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
         * Velocidade: fast (padrão atual) | medium | slow — config do canal (widget-config).
         */
        function resolveTypingSpeedProfile() {
            var live = (window.__xbotConfig && window.__xbotConfig.typingSpeed) || typingSpeed || 'fast';
            var key = String(live || 'fast').toLowerCase();
            if (key === 'medium') {
                // ~1.8× mais lento que o atual; mensagens longas ainda limitadas.
                return { delay: 32, lengthDivisor: 1.25, minTicks: 18, maxTicks: 180 };
            }
            if (key === 'slow') {
                // ~2.7× mais lento; tipicamente mais caractere a caractere.
                return { delay: 48, lengthDivisor: 1, minTicks: 24, maxTicks: 240 };
            }
            // fast — comportamento atual (~18ms/tick, teto ~2.4s).
            return { delay: 18, lengthDivisor: 2, minTicks: 12, maxTicks: 120 };
        }

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
                // Blocos (Answer, opções, etc.) entram no onDone e aumentam a altura —
                // scroll depois para a mensagem aparecer por inteiro.
                if (onDone) onDone();
                scheduleScrollMessagesToBottom();
            }
            if (!text || prefersReducedMotion() || sessionEpisodeEnded) {
                finish();
                return;
            }
            textEl.textContent = '';
            textEl.classList.add('xbot-typecursor');
            var idx = 0;
            var profile = resolveTypingSpeedProfile();
            var targetTicks = Math.max(
                profile.minTicks,
                Math.min(profile.maxTicks, Math.ceil(text.length / profile.lengthDivisor))
            );
            var step = Math.max(1, Math.ceil(text.length / targetTicks));
            var delay = profile.delay;
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
            if (from === 'user') visitorHasSpoken = true;
            const row = document.createElement('div');
            row.className = `xbot-message-row ${from}`;
            var hasCatalogGrid = from === 'bot' && (
                String(text || '').indexOf('data-xbot="catalog-grid"') !== -1
                || String(text || '').indexOf('data-xbot="locate-grid"') !== -1
            );
            var linkCard = from === 'bot' ? (opts.linkCard || parseLinkOnlyMessage(text)) : null;
            if (hasCatalogGrid) row.classList.add('xbot-message-row--catalog');
            if (linkCard) row.classList.add('xbot-message-row--link');
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
            if (linkCard && !opts.domNode) {
                opts.domNode = buildLinkCardNode(linkCard);
            }
            if (opts.domNode) {
                var contentWrap = document.createElement('div');
                contentWrap.className = 'xbot-message-content';
                var textWrap = document.createElement('div');
                textWrap.className = 'xbot-text';
                textWrap.appendChild(opts.domNode);
                contentWrap.appendChild(textWrap);
                msg.appendChild(contentWrap);
                if (from === 'bot') {
                    mountStructuredBlocks(contentWrap, opts.blocks || [], opts);
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
                    var blocks = opts.blocks || [];
                    enqueueBotTypewriter(function (done) {
                        runBotTypewriter(textRoot, plainText, sanitized, function () {
                            enhanceCopyableCode(textRoot);
                            var contentHost = msg.querySelector('.xbot-message-content');
                            mountStructuredBlocks(contentHost, blocks, opts);
                            mountReplyActions(contentHost, actions, opts);
                            done();
                        });
                    });
                } else {
                    enhanceCopyableCode(textRoot);
                    enhanceCatalogGrid(textRoot, opts);
                    var contentHost = msg.querySelector('.xbot-message-content');
                    mountStructuredBlocks(contentHost, opts.blocks || [], opts);
                    mountReplyActions(contentHost, opts.actions || [], opts);
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
                // Envio do visitante reativa o stick; bot só segue se ainda estiver no fim.
                if (from === 'user') scrollMessagesToBottom({ force: true });
                else if (messagesKeyboardOpen && messagesAutoScrollPinned) {
                    // Teclado aberto: reflow do visualViewport; força o fim se ainda estiver pinned.
                    scrollMessagesToBottom({ force: true, ignoreMs: 900 });
                    scheduleScrollMessagesToBottom({ force: true, ignoreMs: 900 });
                } else {
                    scheduleScrollMessagesToBottom();
                }
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

        async function sendSilentVideoEndedAck() {
            // Ack silencioso: não cria bolha, não libera episodio, não trava no composer lock.
            try {
                const visitorId = getVisitorId();
                const msgBody = attachIdentityToMessageBody({
                    message: '__video_ended__',
                    action: {
                        id: 'video-ended',
                        label: 'video_ended',
                        value: '__video_ended__',
                        kind: 'reply'
                    }
                });
                if (visitorId) msgBody.visitor_id = visitorId;
                if (channelId) msgBody.channel_id = channelId;
                beginWaitingForBot();
                const response = await fetch(getMessageUrl(), {
                    method: 'POST',
                    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(msgBody)
                });
                const data = await response.json().catch(function () { return {}; });
                if (data && data.visitor_id && visitorId !== data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                if (data && data.reply) {
                    var replyText = String(data.reply).trim();
                    if (replyText) ingestBotPayload(null, replyText, 'post');
                    else finishWaitingForBot();
                } else if (data && data.bot_reply_enabled) {
                    beginWaitingForBot();
                } else {
                    finishWaitingForBot();
                }
            } catch (err) {
                finishWaitingForBot();
                widgetLog('video_ended ack falhou', err);
            }
        }

        async function sendUserText(text, opts) {
            const value = String(text || '').trim();
            if (!value) return;
            if (isPresentationComposerLocked() || isSleepComposerLocked()) return;
            if (isChoiceComposerLocked()) releaseChoiceComposerLock();

            var actionPayload = null;
            if (opts && opts.action && typeof opts.action === 'object') {
                var aLabel = String(opts.action.label || value).trim();
                var aValue = String(opts.action.value || value).trim();
                if (aLabel && aValue) {
                    actionPayload = {
                        id: String(opts.action.id || 'action').slice(0, 80),
                        label: aLabel.slice(0, 80),
                        value: aValue.slice(0, 500),
                        kind: opts.action.kind === 'url' ? 'url' : 'reply'
                    };
                }
            }

            resumeRealtimeAfterUserSend();
            beginNewEpisodeFromUserMessage();
            appendMessage(value, 'user');
            beginWaitingForBot();
            if (input) {
                input.value = '';
                input.style.height = 'auto';
            }
            focusMessageInput();
            pollSessionInactivity();

            try {
                const visitorId = getVisitorId();
                const msgBody = attachIdentityToMessageBody({ message: value });
                if (actionPayload) msgBody.action = actionPayload;
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
                applyComposerLockedFlag(data.composer_locked);
                if (data.composer_locked) {
                    finishWaitingForBot();
                } else if (data.reply) {
                    var replyText = String(data.reply).trim();
                    if (replyText) ingestBotPayload(null, replyText, 'post');
                    else finishWaitingForBot();
                } else if (data.bot_reply_enabled) {
                    beginWaitingForBot();
                } else {
                    finishWaitingForBot();
                }
            } catch (err) {
                finishWaitingForBot();
                var errText = 'Não foi possível enviar sua mensagem. Verifique seu **token** e tente novamente. Caso precise de ajuda estamos *[aqui](https://xbot.digital/suporte)* para auxilia-lo..';
                appendMessage(errText, 'bot');
                rememberBotMessage(null, errText);
            } finally {
                focusMessageInput();
            }
        }

        async function handleSendMessage() {
            if (isPresentationComposerLocked() || isSleepComposerLocked()) return;
            const text = input.value.trim();
            if (!text) return;
            await sendUserText(text);
        }     

        window.sendXBotMessage = function(message) {
            if (typeof appendMessage !== 'function') return;
            appendMessage(message, 'bot');
        };        
        
        // Upload de Arquivos (pdf, imagens) — composer e bloco Straight file_input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.doc,.docx';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        async function uploadUserFile(file) {
            if (!file) return null;
            if (isPresentationComposerLocked()) return null;
            if (isChoiceComposerLocked()) releaseChoiceComposerLock();

            resumeRealtimeAfterUserSend();
            beginNewEpisodeFromUserMessage();

            const formData = new FormData();
            formData.append('file', file);
            var vid = getVisitorId();
            if (vid) formData.append('visitor_id', vid);
            attachIdentityToFormData(formData);
            if (window.__xbotConfig.channelId) {
                formData.append('channel_id', window.__xbotConfig.channelId);
            }

            var localPreviewUrl = URL.createObjectURL(file);
            var mediaNode;
            if (file.type.startsWith('image/')) {
                mediaNode = wrapMediaWithDownload(
                    createMediaImageEl(localPreviewUrl, file.name || 'imagem'),
                    localPreviewUrl,
                    file.name || 'imagem.jpg',
                    'image'
                );
            } else if (file.type.startsWith('video/')) {
                mediaNode = wrapMediaWithDownload(
                    createMediaVideoEl(localPreviewUrl),
                    localPreviewUrl,
                    file.name || 'video.mp4',
                    'video'
                );
            } else {
                var filePreview = document.createElement('div');
                filePreview.className = 'xbot-media-file';
                filePreview.textContent = '📎 ' + (file.name || 'arquivo');
                mediaNode = wrapMediaWithDownload(
                    filePreview,
                    localPreviewUrl,
                    file.name || 'arquivo',
                    'file'
                );
            }
            appendMessage('', 'user', { domNode: mediaNode });
            beginWaitingForBot();
            pollSessionInactivity();

            try {
                const res = await fetch(getUploadUrl(), {
                    method: 'POST',
                    headers: buildAuthHeaders({}),
                    body: formData
                });
                const data = await res.json().catch(function () { return {}; });
                if (!res.ok) throw new Error('upload failed');
                if (data.visitor_id && typeof localStorage !== 'undefined') {
                    try { localStorage.setItem('xbot_visitor_id', data.visitor_id); } catch (e) {}
                }
                sendVisitorPresence({ chat_open: true, page_visible: true }, { force: true });
                if (data.bot_reply_enabled) {
                    beginWaitingForBot();
                } else {
                    finishWaitingForBot();
                }
                return data;
            } catch (err) {
                finishWaitingForBot();
                appendMessage('Erro ao enviar o arquivo.', 'bot');
                return null;
            } finally {
                scrollMessagesToBottom({ force: true });
            }
        }

        uploadBtn.addEventListener('click', () => {
            if (isPresentationComposerLocked()) return;
            if (isChoiceComposerLocked()) return;
            fileInput.click();
        });
        fileInput.addEventListener('change', async (e) => {
            if (isPresentationComposerLocked() || isChoiceComposerLocked()) {
                e.target.value = '';
                return;
            }
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;
            await uploadUserFile(file);
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
            audioBtn.disabled = isPresentationComposerLocked();
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
            if (isPresentationComposerLocked() && !isRecording) return;
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
                    var localAudioUrl = URL.createObjectURL(blob);
                    appendMessage('', 'user', {
                        domNode: wrapMediaWithDownload(
                            createXbotAudioPlayer(localAudioUrl),
                            localAudioUrl,
                            picked.filename || 'audio.webm',
                            'audio'
                        )
                    });
                    beginWaitingForBot();

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
                            beginWaitingForBot();
                        } else {
                            finishWaitingForBot();
                        }
                        pollSessionInactivity();
                    } catch (err) {
                        finishWaitingForBot();
                        appendMessage('Erro ao enviar o áudio.', 'bot');
                    } finally {
                        isUploadingAudio = false;
                        setAudioBtnIdle();
                    }
                    scrollMessagesToBottom({ force: true });
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

 