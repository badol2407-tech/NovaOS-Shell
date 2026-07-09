/**
 * NovaSDK shim — served as a static script at GET /api/plugins/sdk.js and
 * loaded inside every plugin's sandboxed iframe (`sandbox="allow-scripts"`,
 * no `allow-same-origin`, so the iframe has an opaque origin with zero DOM/
 * cookie access to the host page). This is the *only* way plugin code can
 * reach the outside world — every method is a postMessage round-trip to
 * PluginRunner.tsx, which re-checks permissions server-side before doing
 * anything real.
 *
 * Kept as a plain JS string (not bundled/transpiled) so it can be served
 * byte-for-byte with no build step and stay tiny.
 */
export const NOVA_SDK_SHIM_JS = `
(function () {
  "use strict";
  var pending = Object.create(null);
  var callId = 0;
  var CALL_TIMEOUT_MS = 10000;

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.novaSdkResponse !== true) return;
    var entry = pending[data.callId];
    if (!entry) return;
    delete pending[data.callId];
    clearTimeout(entry.timer);
    if (data.error) entry.reject(new Error(data.error));
    else entry.resolve(data.result);
  });

  function call(method, args) {
    return new Promise(function (resolve, reject) {
      var id = String(++callId);
      var timer = setTimeout(function () {
        delete pending[id];
        reject(new Error("NovaSDK call timed out: " + method));
      }, CALL_TIMEOUT_MS);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      window.parent.postMessage(
        { novaSdk: true, callId: id, method: method, args: args || {} },
        "*",
      );
    });
  }

  window.NovaSDK = {
    storage: {
      get: function (key) { return call("storage.get", { key: key }); },
      set: function (key, value) { return call("storage.set", { key: key, value: value }); },
      remove: function (key) { return call("storage.remove", { key: key }); },
    },
    notify: function (title, body) { return call("notify", { title: title, body: body }); },
    ai: {
      ask: function (prompt) { return call("ai.ask", { prompt: prompt }); },
    },
    clipboard: {
      writeText: function (text) { return call("clipboard.writeText", { text: text }); },
    },
    openApp: function (appId) { return call("openApp", { appId: appId }); },
  };

  window.dispatchEvent(new Event("novasdkready"));
})();
`;
