/* =========================================================
   ui/ui.jsx — shared toast + modal systems (React port of utils.toast/modal)
   ========================================================= */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const UiContext = createContext(null);

export function useUi() { return useContext(UiContext); }

/** latest modal opener, set by the always-mounted ModalHost */
let modalFn = null;

export function openModal(opts) {
  if (modalFn) return modalFn(opts);
  return Promise.resolve(null);
}

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback(function (text, type) {
    const id = ++idRef.current;
    setToasts(function (list) { return list.concat({ id: id, text: text, type: type || '' }); });
    setTimeout(function () {
      setToasts(function (list) { return list.filter(function (t) { return t.id !== id; }); });
    }, 3000);
  }, []);

  return (
    <UiContext.Provider value={{ toast: toast, modal: openModal }}>
      {children}
      <ModalHost />
      <div className="toast-root" role="status" aria-live="polite">
        {toasts.map(function (t) {
          return <div key={t.id} className={'toast ' + t.type}>{t.text}</div>;
        })}
      </div>
    </UiContext.Provider>
  );
}

/* ---------------- modal ---------------- */

/** opts: { title, message(html), body(node), actions:[{label,value,primary,danger,autofocus}], dismissLabel, validate } */
function ModalHost() {
  const [opts, setOpts] = useState(null);
  const [error, setError] = useState('');
  const resolveRef = useRef(null);

  modalFn = function (o) {
    return new Promise(function (resolve) {
      resolveRef.current = resolve;
      setError('');
      setOpts(o || {});
    });
  };

  function close(val) {
    if (resolveRef.current) resolveRef.current(val);
    resolveRef.current = null;
    setOpts(null);
    setError('');
  }

  if (!opts) return null;

  function onAction(a) {
    if (typeof opts.validate === 'function') {
      const problem = opts.validate();
      if (problem) { setError(problem); return; }
    }
    close(a.value == null ? a.label : a.value);
  }

  const actions = opts.actions || [{ label: 'OK', value: true }];

  return (
    <div className="modal-overlay" role="presentation"
      onClick={function (e) { if (e.target === e.currentTarget) close(opts.dismissLabel != null ? opts.dismissLabel : null); }}
      onKeyDown={function (e) { if (e.key === 'Escape') close(opts.dismissLabel != null ? opts.dismissLabel : null); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {opts.title ? <h2 id="modal-title">{opts.title}</h2> : null}
        {opts.message ? <p dangerouslySetInnerHTML={{ __html: opts.message }} /> : null}
        {opts.body || null}
        <div className="modal-actions">
          {actions.map(function (a) {
            const cls = 'btn' + (a.primary ? ' btn-primary' : a.danger ? ' btn-danger' : ' btn-ghost');
            return (
              <button key={a.label} type="button" className={cls} autoFocus={!!a.autofocus}
                onClick={function () { onAction(a); }}>
                {a.label}
              </button>
            );
          })}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}
