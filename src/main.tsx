import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PhoneShoot from './components/PhoneShoot';
import { isShootPage } from './lib/phone';
import './styles.css';

// No browser autofill in the editing fields (Anat, 2026-11-01): Chrome offered addresses typed for one app in the
// fields of another, as floating suggestions over the text boxes, and a picked suggestion sent the cover and the
// button to the wrong app. Every field that appears, now or later, gets autocomplete="off".
const noAutofill = (root: ParentNode) =>
  root.querySelectorAll?.('input:not([autocomplete]), textarea:not([autocomplete])').forEach((el) => el.setAttribute('autocomplete', 'off'));
noAutofill(document);
new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => n instanceof Element && (noAutofill(n), n.matches('input, textarea') && !n.hasAttribute('autocomplete') && n.setAttribute('autocomplete', 'off'))))).observe(document.documentElement, { childList: true, subtree: true });


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isShootPage() && new URLSearchParams(location.search).get('app') ? <PhoneShoot appId={new URLSearchParams(location.search).get('app')!} /> : <App />}
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
}
