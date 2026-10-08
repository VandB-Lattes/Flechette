// Annonces plein écran sur la TV à chaque résultat : vidéo (créée avec Flow, déposée dans Supabase Storage)
// + texte avec les vrais noms d'équipe. Sans vidéo, une animation aux couleurs V and B la remplace.
import { esc } from './util.js';
import { NONE, finalMatch } from './engine.js';
import { tname } from './views.js';
import { ASSETS_URL, ASSETS_DIR } from '../config.js';

export const VIDEOS = { victoire: 'annonce-victoire.mp4', qualifies: 'annonce-qualifies.mp4', finale: 'annonce-finale.mp4' };
// Durée sans vidéo (animation de secours) ; avec vidéo, l'annonce dure exactement la vidéo (10 s pour les vidéos Flow)
const DURATION = { victoire: 10000, qualifies: 10000, finale: 10000 };
const videoUrl = (k) => `${ASSETS_URL}/${ASSETS_DIR.split('/').map(encodeURIComponent).join('/')}/${VIDEOS[k]}`;

/** Quel type d'annonce pour ce match ? */
export function kindOf(c, m) {
  if (m.ph === 'main' && finalMatch(c)?.id === m.id) return 'finale';
  if (m.ph === 'main' && (c.format === 'poules' || m.r >= 2)) return 'qualifies';
  return 'victoire';   // poules, premier tour, consolante, match pour la 3e place
}

/** Texte de l'annonce, avec les noms en surbrillance */
export function texts(c, m, kind, machine) {
  const W = `<em>${esc(tname(c, m.winner))}</em>`, L = `<em>${esc(tname(c, m.loser))}</em>`;
  if (kind === 'finale') return { title: 'CHAMPIONS DU V and B !', body: `Victoire éclatante de ${W} !<br>Félicitations aux nouveaux rois de la cible ! 🏆🎯` };
  if (kind === 'qualifies') return { title: 'QUALIFIÉS !', body: `${W} s’impose et continue sa course vers le titre !<br>${L}, merci pour ce beau match !` };
  return { title: 'VICTOIRE !', body: `${W} décroche la victoire${machine ? ` sur la Machine ${machine}` : ''} !<br>Un pas de plus vers les phases finales.` };
}

const CONFETTI = ['#fbba00', '#2e7a72', '#d9532b', '#ffffff', '#fbba00'];
const TARGET = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="30" cy="34" r="26" fill="#fbba00"/><circle cx="30" cy="34" r="19" fill="#1d1d1b"/><circle cx="30" cy="34" r="13" fill="#fff"/><circle cx="30" cy="34" r="7" fill="#2e7a72"/><circle cx="30" cy="34" r="3" fill="#d9532b"/><path d="M31 33 L56 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M52 4 L60 4 L56 10 Z M60 4 L60 12 L54 8 Z" fill="#2e7a72"/></svg>';

export const ANN_CSS = `
.ann{position:fixed;inset:0;z-index:50;background:#1d1d1b;color:#fff;overflow:hidden;display:grid;opacity:0;transition:opacity .5s}
.ann.on{opacity:1}
.ann video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ann .fx{position:absolute;inset:0;overflow:hidden}
.ann .fx .tg{position:absolute;width:min(34vw,60vh);right:8vw;top:50%;transform:translateY(-50%) scale(.2) rotate(-30deg);animation:annTarget 1s cubic-bezier(.2,1.4,.4,1) .2s forwards}
.ann .fx i{position:absolute;top:-4vh;width:1.1vw;height:2.2vw;min-width:8px;min-height:14px;border-radius:2px;animation:annFall linear forwards}
.ann .fx .ring{position:absolute;right:calc(8vw + min(17vw,30vh));top:50%;width:10px;height:10px;border-radius:50%;border:6px solid #fbba00;transform:translate(50%,-50%);animation:annRing 1.4s ease-out .6s forwards;opacity:0}
.ann .txt{position:relative;z-index:2;align-self:center;padding:0 6vw;max-width:62vw;text-shadow:0 4px 24px rgba(0,0,0,.6);animation:annIn .8s cubic-bezier(.2,1.2,.4,1) .5s both}
.ann.qualifies .txt{max-width:none;text-align:center;justify-self:center}
.ann.finale .txt{max-width:none;text-align:center;justify-self:center;align-self:start;padding-top:9vh}
.ann .tt{font:900 clamp(40px,8vw,150px)/1 var(--display);letter-spacing:.01em;color:#fbba00;margin:0 0 .25em}
.ann .bd{font:800 clamp(22px,3.1vw,58px)/1.25 var(--body)}
.ann .bd em{font-style:normal;color:#fff;background:#d9532b;padding:0 .25em;border-radius:.15em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.ann.finale .bd em{background:#fbba00;color:#1d1d1b}
.ann .brand{position:absolute;z-index:2;left:3vw;bottom:3vh;height:clamp(36px,5vw,90px);width:auto}
.ann .bar{position:absolute;z-index:3;left:0;bottom:0;height:8px;background:#fbba00;animation:annBar linear forwards}
/* finale : trophée-cible en bas au centre, texte en haut (comme la vidéo demandée) */
.ann.finale .fx .tg{right:auto;left:50%;top:auto;bottom:5vh;width:min(26vw,40vh);transform:translateX(-50%) scale(.2);animation-name:annTargetF}
.ann.finale .fx .ring{right:50%;top:auto;bottom:calc(5vh + min(13vw,20vh));transform:translate(50%,50%)}
.ann.finale .tt{font-size:clamp(36px,6.4vw,124px);white-space:nowrap}
@keyframes annTargetF{to{transform:translateX(-50%) scale(1)}}
@keyframes annIn{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:none}}
@keyframes annTarget{to{transform:translateY(-50%) scale(1) rotate(0)}}
@keyframes annRing{0%{opacity:1;width:10px;height:10px}100%{opacity:0;width:90vh;height:90vh}}
@keyframes annFall{to{transform:translateY(112vh) rotate(720deg)}}
@keyframes annBar{from{width:0}to{width:100%}}
@media (prefers-reduced-motion:reduce){.ann *{animation-duration:.01s!important}}
`;

/** File d'attente des annonces : une à la fois, puis retour au tableau */
export function createAnnouncer(logoUrl) {
  const queue = []; let busy = false;
  async function show(a) {
    busy = true;
    const el = document.createElement('div');
    el.className = `ann ${a.kind}`;
    const n = a.kind === 'finale' ? 90 : a.kind === 'qualifies' ? 55 : 30;
    const confetti = Array.from({ length: n }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${CONFETTI[i % 5]};animation-duration:${2.5 + Math.random() * 3}s;animation-delay:${(Math.random() * (a.kind === 'finale' ? 6 : 2)).toFixed(2)}s"></i>`).join('');
    el.innerHTML = `<div class="fx">${a.kind === 'qualifies' ? '' : `<div class="tg">${TARGET}</div><div class="ring"></div>`}${confetti}</div>
      <video muted playsinline preload="auto"></video>
      <div class="txt"><div class="tt">${a.title}</div><div class="bd">${a.body}</div></div>
      ${logoUrl ? `<img class="brand" src="${logoUrl}" alt="" onerror="this.remove()">` : ''}<div class="bar" style="animation-duration:${DURATION[a.kind]}ms"></div>`;
    document.body.appendChild(el);
    const v = el.querySelector('video');
    v.addEventListener('error', () => v.remove());   // pas de vidéo déposée : l'animation de secours reste visible
    v.src = videoUrl(a.kind);
    // fin de l'annonce : à la fin de la vidéo si elle joue, sinon après la durée de l'animation de secours
    const finished = new Promise((resolve) => {
      let t = setTimeout(resolve, DURATION[a.kind]);
      v.addEventListener('playing', () => {
        el.querySelector('.fx').style.opacity = '0';
        const len = Number.isFinite(v.duration) && v.duration > 1 ? Math.min(v.duration, 30) * 1000 : DURATION[a.kind];
        el.querySelector('.bar').style.animationDuration = len + 'ms';
        clearTimeout(t); t = setTimeout(resolve, len + 1500);   // filet de sécurité si « ended » n'arrive pas
      }, { once: true });
      v.addEventListener('ended', () => { clearTimeout(t); resolve(); }, { once: true });
    });
    v.play().catch(() => v.remove());
    requestAnimationFrame(() => el.classList.add('on'));
    await finished;
    el.classList.remove('on');
    await new Promise((r) => setTimeout(r, 600));
    el.remove(); busy = false;
    if (queue.length) show(queue.shift());
  }
  return {
    push(a) { if (busy) queue.push(a); else show(a); },
    get busy() { return busy || queue.length > 0; },
  };
}

/** Compare deux états du concours : renvoie les annonces des matchs qui viennent de se terminer */
export function detect(c, prev, machines) {
  if (!prev) return [];
  const out = [];
  for (const m of c.matches) {
    if (m.status !== 'done' || m.bye || !m.winner || m.winner === NONE) continue;
    const before = prev.get(m.id);
    if (!before || before.status === 'done') continue;
    if (m.played_at && Date.now() - Date.parse(m.played_at) > 10 * 60000) continue;   // trop ancien (écran rallumé)
    const kind = kindOf(c, m);
    out.push({ kind, ...texts(c, m, kind, machines.get(m.id) || before.machine) });
  }
  // la finale passe en dernier
  return out.sort((a, b) => (a.kind === 'finale') - (b.kind === 'finale'));
}
