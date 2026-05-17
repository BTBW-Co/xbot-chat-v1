/**
 * URLs oficiais do widget — fonte única para README, API e painel.
 * @see scripts/build-widget.sh
 */

const XCHAT_WIDGET_GITHUB_REPO = 'BTBW-Co/xbot-chat-v1';
const XCHAT_WIDGET_STABLE_REF = 'main';
const XCHAT_WIDGET_STABLE_PATH = 'versions/latest/xbot.min.js';

function getXchatJsdelivrStableUrl() {
  return `https://cdn.jsdelivr.net/gh/${XCHAT_WIDGET_GITHUB_REPO}@${XCHAT_WIDGET_STABLE_REF}/${XCHAT_WIDGET_STABLE_PATH}`;
}

function getXchatJsdelivrVersionUrl(version, ref = version) {
  return `https://cdn.jsdelivr.net/gh/${XCHAT_WIDGET_GITHUB_REPO}@${ref}/versions/${version}/xbot.min.js`;
}

module.exports = {
  XCHAT_WIDGET_GITHUB_REPO,
  XCHAT_WIDGET_STABLE_REF,
  XCHAT_WIDGET_STABLE_PATH,
  XCHAT_WIDGET_SCRIPT_URL: getXchatJsdelivrStableUrl(),
  getXchatJsdelivrStableUrl,
  getXchatJsdelivrVersionUrl,
};
