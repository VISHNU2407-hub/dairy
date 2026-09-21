/* =========================================================
   scripts/smoke-desktop.cjs
   Smoke-tests the running Electron app over the DevTools
   protocol (launch electron with --remote-debugging-port=9222).
   Verifies: React mounted, localStorage available, and
   collects any console errors / uncaught exceptions.

   Run:  node scripts/smoke-desktop.cjs
   ========================================================= */
const DEBUG_PORT = 9222;

async function main() {
  // 1. find the app page target
  const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
  const page = list.find((t) => t.type === 'page' && /dist[\/\\]index\.html/.test(t.url));
  if (!page) {
    console.error('FAIL: diary page not found among targets:', list.map((t) => t.url));
    process.exit(1);
  }

  // 2. connect
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];

  function send(method, params) {
    return new Promise((resolve) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      errors.push(`console.${msg.params.type}: ` + msg.params.args.map((a) => a.value || a.description || '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
  };

  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  // 3. enable console + exception capture, then wait a moment
  await send('Runtime.enable', {});
  await send('Log.enable', {});
  await new Promise((r) => setTimeout(r, 2500));

  // 4. inspect app state
  const expr = `JSON.stringify((function(){
    function lsOK(){ try { localStorage.setItem('__smoke','1'); localStorage.removeItem('__smoke'); return true; } catch(e){ return false; } }
    var root = document.getElementById('root');
    return {
      title: document.title,
      reactMounted: !!(root && root.children.length > 0),
      bodyTextLength: (document.body.innerText || '').length,
      localStorageOK: lsOK(),
      firstHeading: (document.querySelector('h1, h2') || {}).textContent || null
    };
  })())`;
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  const state = JSON.parse(res.result.value);

  console.log('--- app state ---');
  console.log(JSON.stringify(state, null, 2));
  console.log('--- console errors/exceptions captured ---');
  console.log(errors.length ? errors.join('\n') : '(none)');

  const ok = state.reactMounted && state.localStorageOK && state.bodyTextLength > 0;
  console.log(ok ? '\nSMOKE TEST: PASS' : '\nSMOKE TEST: FAIL');
  ws.close();
  process.exit(ok && errors.length === 0 ? 0 : errors.length ? 2 : 1);
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
