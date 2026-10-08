// Bouton « Afficher / Masquer » sur chaque champ mot de passe (connexion staff, page des accès, Réglages).
const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="currentColor"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2.3 3.7l18 18 1.4-1.4-3.2-3.2c1.9-1.3 3.3-3.1 4-4.6C21.3 9.4 17.5 5 12 5c-1.6 0-3 .4-4.3 1L3.7 2.3 2.3 3.7zM12 7.5a4.5 4.5 0 0 1 4.3 5.8l-1.6-1.6A2.5 2.5 0 0 0 12.3 9.3L10.7 7.7c.4-.1.9-.2 1.3-.2zM1.5 12c1.2 2.6 5 7 10.5 7 1.4 0 2.7-.3 3.9-.8l-2-2A4.5 4.5 0 0 1 7.8 10.1L5 7.3C3.3 8.6 2.1 10.5 1.5 12z" fill="currentColor"/></svg>';

function enhance(input) {
  if (input.dataset.pwt) return;
  input.dataset.pwt = '1';
  const wrap = document.createElement('span');
  wrap.style.cssText = 'position:relative;display:block';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.style.paddingRight = '48px';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pwt';
  b.setAttribute('aria-label', 'Afficher le mot de passe');
  b.title = 'Afficher le mot de passe';
  b.innerHTML = EYE;
  b.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);width:40px;height:40px;display:grid;place-items:center;border:0;background:none;color:#5e5e5a;cursor:pointer;border-radius:8px;padding:0';
  b.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.innerHTML = show ? EYE_OFF : EYE;
    b.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    b.title = b.getAttribute('aria-label');
    input.focus();
  });
  wrap.appendChild(b);
}
const scan = (root) => root.querySelectorAll?.('input[type="password"]:not([data-pwt])').forEach(enhance);
scan(document);
new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.('input[type="password"]') ? enhance(n) : scan(n))))).observe(document.body, { childList: true, subtree: true });
