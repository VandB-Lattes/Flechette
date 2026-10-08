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
.ann .txt{position:relative;z-index:2;align-self:center;margin:0 5vw;padding:2.2vh 2.4vw;max-width:62vw;background:rgba(29,29,27,.78);border-radius:14px;animation:annIn .6s ease-out .3s both}
.ann.qualifies .txt{max-width:none;text-align:center;justify-self:center}
.ann.finale .txt{max-width:none;text-align:center;justify-self:center;align-self:start;padding-top:9vh}
.ann .tt{font:900 clamp(40px,8vw,150px)/1 var(--display);letter-spacing:.01em;color:#fbba00;margin:0 0 .25em}
.ann .bd{font:800 clamp(22px,3.1vw,58px)/1.25 var(--body)}
.ann .bd em{font-style:normal;color:#fff;background:#d9532b;padding:0 .25em;border-radius:.15em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.ann.finale .bd em{background:#fbba00;color:#1d1d1b}
.ann .brand{position:absolute;z-index:2;left:3vw;bottom:3vh;height:clamp(36px,5vw,90px);width:auto}
.ann .bar{position:absolute;z-index:3;left:0;right:0;bottom:0;height:8px;background:#fbba00;transform-origin:left;transform:scaleX(0);animation:annBar linear forwards}
.ann .diag{position:absolute;z-index:4;right:1vw;bottom:2vh;font:700 14px var(--body);background:#000;color:#fff;padding:6px 10px;border-radius:6px}
.ann.finale .tt{font-size:clamp(36px,6.4vw,124px);white-space:nowrap}
@keyframes annIn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes annBar{to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.ann *{animation-duration:.01s!important}}
`;

/** File d'attente des annonces : une à la fois, puis retour au tableau.
    Options : onIdle (appelé quand plus rien n'est affiché), diag (affiche la qualité de lecture, pour l'aperçu). */
export function createAnnouncer(logoUrl, onIdle, diag = false) {
  const queue = []; let busy = false;
  /* Les vidéos sont téléchargées en entier dans la mémoire de la TV à l'ouverture de l'écran (puis toutes les 30 minutes)
     et un lecteur vidéo est préparé d'avance pour chacune : au moment de l'annonce, la lecture démarre sans attente. */
  const players = {}, info = {};
  async function preload() {
    for (const k of Object.keys(VIDEOS)) {
      try {
        const r = await fetch(videoUrl(k), { cache: 'no-cache' });
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('video')) { delete players[k]; continue; }
        const blob = await r.blob();
        if (info[k]?.size === blob.size && players[k]) continue;   // vidéo inchangée
        const v = document.createElement('video');
        Object.assign(v, { muted: true, playsInline: true, preload: 'auto' });
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        const old = players[k]; v.src = URL.createObjectURL(blob); v.load();
        await new Promise((ok) => { v.addEventListener('canplaythrough', ok, { once: true }); v.addEventListener('error', ok, { once: true }); setTimeout(ok, 15000); });
        if (v.error) continue;
        players[k] = v; info[k] = { size: blob.size };
        if (old) URL.revokeObjectURL(old.src);
      } catch { /* réseau indisponible : on garde la version déjà en mémoire */ }
    }
  }
  const loaded = preload(); setInterval(() => { if (!busy) preload(); }, 30 * 60000);
  const app = () => document.getElementById('app');

  async function show(a) {
    busy = true;
    const el = document.createElement('div');
    el.className = `ann ${a.kind}`;
    el.innerHTML = `<div class="txt"><div class="tt">${a.title}</div><div class="bd">${a.body}</div></div>
      ${logoUrl ? `<img class="brand" src="${logoUrl}" alt="" onerror="this.remove()">` : ''}<div class="bar" style="animation-duration:${DURATION[a.kind]}ms"></div>`;
    const v = players[a.kind];
    if (v) { v.pause(); v.currentTime = 0; el.prepend(v); }
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    // le tableau derrière est masqué pendant l'annonce : la TV ne dessine que la vidéo et le texte
    setTimeout(() => { if (app()) app().style.visibility = 'hidden'; }, 550);
    let len = DURATION[a.kind];
    if (v) {
      try {
        await v.play();
        if (Number.isFinite(v.duration) && v.duration > 1) len = Math.min(v.duration, 30) * 1000;
        el.querySelector('.bar').style.animationDuration = len + 'ms';
        await new Promise((ok) => { const t = setTimeout(ok, len + 1500); v.addEventListener('ended', () => { clearTimeout(t); ok(); }, { once: true }); });
      } catch { await new Promise((ok) => setTimeout(ok, len)); }
      if (diag) {
        const q = v.getVideoPlaybackQuality?.();
        const d = document.createElement('div'); d.className = 'diag';
        d.textContent = `${a.kind} · ${v.videoWidth}×${v.videoHeight} · ${(info[a.kind].size / 1048576).toFixed(1)} Mo · images perdues : ${q ? `${q.droppedVideoFrames} / ${q.totalVideoFrames}` : 'n.c.'}`;
        el.appendChild(d); console.log('[annonce]', d.textContent);
        await new Promise((ok) => setTimeout(ok, 2500));
      }
    } else {
      if (diag) { const d = document.createElement('div'); d.className = 'diag'; d.textContent = `${a.kind} · pas de vidéo en mémoire (absente ou encore en chargement)`; el.appendChild(d); }
      await new Promise((ok) => setTimeout(ok, len));
    }
    if (app()) app().style.visibility = '';
    el.classList.remove('on');
    await new Promise((r) => setTimeout(r, 600));
    if (v) { v.pause(); v.remove(); }
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
