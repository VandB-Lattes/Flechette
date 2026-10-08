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
  if (kind === 'qualifies') return { title: 'QUALIFIÉS !', body: `${W} s’impose et continue sa course !<br>${L}, merci pour ce beau match !` };
  return { title: 'VICTOIRE !', body: `${W} décroche la victoire${machine ? ` sur la Machine ${machine}` : ''} !<br>Un pas de plus vers les phases finales.` };
}


export const ANN_CSS = `
.ann{position:fixed;inset:0;z-index:50;background:#1d1d1b;color:#fff;overflow:hidden;display:grid;opacity:0;transition:opacity .5s}
.ann.on{opacity:1}
.ann video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ann .txt{position:relative;z-index:2;align-self:center;padding:0 6vw;max-width:62vw;text-shadow:0 4px 24px rgba(0,0,0,.6);animation:annIn .8s cubic-bezier(.2,1.2,.4,1) .5s both}
.ann.qualifies .txt{max-width:none;text-align:center;justify-self:center}
.ann.finale .txt{max-width:none;text-align:center;justify-self:center;align-self:start;padding-top:9vh}
.ann .tt{font:900 clamp(40px,8vw,150px)/1 var(--display);letter-spacing:.01em;color:#fbba00;margin:0 0 .25em}
.ann .bd{font:800 clamp(22px,3.1vw,58px)/1.25 var(--body)}
.ann .bd em{font-style:normal;color:#fff;background:#d9532b;padding:0 .25em;border-radius:.15em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.ann.finale .bd em{background:#fbba00;color:#1d1d1b}
.ann .brand{position:absolute;z-index:2;left:3vw;bottom:3vh;height:clamp(36px,5vw,90px);width:auto}
.ann .bar{position:absolute;z-index:3;left:0;bottom:0;height:8px;background:#fbba00;animation:annBar linear forwards}
.ann.finale .tt{font-size:clamp(36px,6.4vw,124px);white-space:nowrap}
@keyframes annIn{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:none}}
@keyframes annBar{from{width:0}to{width:100%}}
@media (prefers-reduced-motion:reduce){.ann *{animation-duration:.01s!important}}
`;

/** File d'attente des annonces : une à la fois, puis retour au tableau */
export function createAnnouncer(logoUrl, onIdle) {
  const queue = []; let busy = false;
  /* Les vidéos sont téléchargées une fois en entier dans la mémoire de la TV au chargement de l'écran
     (puis toutes les 30 minutes) : la lecture ne dépend plus du réseau, donc plus de saccades ni d'attente. */
  const ready = {};
  async function preload() {
    for (const k of Object.keys(VIDEOS)) {
      try {
        const r = await fetch(videoUrl(k), { cache: 'no-cache' });
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('video')) { if (ready[k]) { URL.revokeObjectURL(ready[k]); delete ready[k]; } continue; }
        const url = URL.createObjectURL(await r.blob());
        if (ready[k]) URL.revokeObjectURL(ready[k]);
        ready[k] = url;
      } catch { /* réseau indisponible : on garde la version déjà en mémoire */ }
    }
  }
  const loaded = preload(); setInterval(() => { if (!busy) preload(); }, 30 * 60000);
  async function show(a) {
    busy = true;
    const el = document.createElement('div');
    el.className = `ann ${a.kind}`;
    // seule la vidéo est animée : plus de cible ni de confettis dessinés par l'écran
    el.innerHTML = `<video muted playsinline preload="auto"></video>
      <div class="txt"><div class="tt">${a.title}</div><div class="bd">${a.body}</div></div>
      ${logoUrl ? `<img class="brand" src="${logoUrl}" alt="" onerror="this.remove()">` : ''}<div class="bar" style="animation-duration:${DURATION[a.kind]}ms"></div>`;
    document.body.appendChild(el);
    const v = el.querySelector('video');
    const fallback = () => v.remove();
    v.addEventListener('error', fallback);   // vidéo absente ou illisible : l'animation de secours reste visible
    if (ready[a.kind]) v.src = ready[a.kind]; else v.remove();   // vidéo pas encore en mémoire : animation de secours plutôt qu'une vidéo qui rame
    // fin de l'annonce : à la fin de la vidéo si elle joue, sinon après la durée de l'animation de secours
    const finished = new Promise((resolve) => {
      let t = setTimeout(resolve, DURATION[a.kind]);
      v.addEventListener('playing', () => {
        const len = Number.isFinite(v.duration) && v.duration > 1 ? Math.min(v.duration, 30) * 1000 : DURATION[a.kind];
        el.querySelector('.bar').style.animationDuration = len + 'ms';
        clearTimeout(t); t = setTimeout(resolve, len + 1500);   // filet de sécurité si « ended » n'arrive pas
      }, { once: true });
      v.addEventListener('ended', () => { clearTimeout(t); resolve(); }, { once: true });
    });
    if (v.isConnected) v.play().catch(fallback);
    requestAnimationFrame(() => el.classList.add('on'));
    await finished;
    el.classList.remove('on');
    await new Promise((r) => setTimeout(r, 600));
    el.remove(); busy = false;
    if (queue.length) show(queue.shift()); else onIdle?.();
  }
  return {
    push(a) { if (busy) queue.push(a); else show(a); },
    get busy() { return busy || queue.length > 0; },
    loaded,
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
