// Annonces plein écran sur la TV : victoires, qualifiés, finale, consolante, fin de poules,
// appel machine, 180 / finish, tirage au sort, roue des lots, podium.
import { esc } from './util.js';
import { NONE, finalMatch, poolTable } from './engine.js';
import { tname } from './views.js';
import { play } from './sons.js';
import { ASSETS_URL, ASSETS_DIR } from '../config.js';

export const VIDEOS = { victoire: 'annonce-victoire.mp4', qualifies: 'annonce-qualifies.mp4', finale: 'annonce-finale.mp4' };
const DURATION = {
  victoire: 10000, qualifies: 10000, finale: 10000,
  consolante: 10000, poules: 12000, appel: 12000,
  oneeighty: 8000, finish: 8000, tirage: 0, roue: 0, podium: 14000,
};
const videoUrl = (k) => `${ASSETS_URL}/${ASSETS_DIR.split('/').map(encodeURIComponent).join('/')}/${VIDEOS[k]}`;

export function kindOf(c, m) {
  if (m.ph === 'main' && finalMatch(c)?.id === m.id) return 'finale';
  if (m.ph === 'conso') {
    const cm = c.matches.filter((x) => x.ph === 'conso');
    const R = Math.max(...cm.map((x) => x.r));
    if (m.r === R) return 'consolante';
  }
  if (m.ph === 'main' && (c.format === 'poules' || m.r >= 2)) return 'qualifies';
  return 'victoire';
}

const TEAM_COLORS = [['#d9532b', '#fff'], ['#2e7a72', '#fff'], ['#fbba00', '#1d1d1b'], ['#ffffff', '#1d1d1b']];
function colorIndex(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % TEAM_COLORS.length; }
function teamTag(c, id, avoid) {
  let i = colorIndex(id); if (i === avoid) i = (i + 1) % TEAM_COLORS.length;
  const [bg, fg] = TEAM_COLORS[i];
  return { i, html: `<em style="background:${bg};color:${fg}">${esc(tname(c, id))}</em>` };
}

export function texts(c, m, kind, machine) {
  const w = teamTag(c, m.winner), l = teamTag(c, m.loser, w.i);
  const W = w.html, L = l.html;
  if (kind === 'finale') return { title: 'CHAMPIONS DU V and B !', body: `Victoire éclatante de ${W} !<br>Félicitations aux nouveaux rois de la cible ! 🏆🎯` };
  if (kind === 'consolante') return { title: 'VAINQUEUR DE LA CONSOLANTE !', body: `${W} remporte la consolante !<br>${L}, merci pour le spectacle !` };
  if (kind === 'qualifies') return { win: { name: tname(c, m.winner), bg: TEAM_COLORS[w.i][0], fg: TEAM_COLORS[w.i][1] }, title: 'QUALIFIÉS !', body: `${W} s’impose et continue sa course !<br>${L}, merci pour ce beau match !` };
  return { title: 'VICTOIRE !', body: `${W} décroche la victoire${machine ? ` sur la Machine ${machine}` : ''} !<br>Un pas de plus vers les phases finales.` };
}

export function textsPoules(c) {
  const q = c.pools.length === 1 ? Math.min(4, c.pools[0].ids.length) : 2;
  const names = [];
  c.pools.forEach((_, gi) => {
    poolTable(c, gi).slice(0, q).forEach((r) => names.push(tname(c, r.id)));
  });
  const tags = names.map((n, i) => {
    const [bg, fg] = TEAM_COLORS[i % TEAM_COLORS.length];
    return `<em style="background:${bg};color:${fg}">${esc(n)}</em>`;
  });
  return { title: 'FIN DES POULES !', body: `Qualifiés pour le tableau final :<br>${tags.join(' · ')}` };
}

export const ANN_CSS = `
.ann{position:fixed;inset:0;z-index:50;background:#1d1d1b;color:#fff;overflow:hidden;display:grid;opacity:0;transition:opacity .5s}
.ann.on{opacity:1}
.ann video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ann .txt{position:relative;z-index:2;align-self:center;margin:0 5vw;padding:2.2vh 2.4vw;max-width:62vw;background:rgba(29,29,27,.78);border-radius:14px}
.ann.qualifies .txt,.ann.consolante .txt,.ann.poules .txt{max-width:none;text-align:center;justify-self:center}
.ann.finale .txt,.ann.podium .txt{max-width:none;text-align:center;justify-self:center;align-self:start;padding-top:9vh}
.ann .tt{font:900 clamp(40px,8vw,150px)/1 var(--display);letter-spacing:.01em;color:#fbba00;margin:0 0 .25em}
.ann .bd{font:800 clamp(22px,3.1vw,58px)/1.25 var(--body)}
.ann .bd em{font-style:normal;color:#fff;background:#d9532b;padding:0 .25em;border-radius:.15em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
/* « QUALIFIÉS ! » : nom de l'équipe gagnante en grand au centre de l'image (fixe : rien ne bouge pendant la vidéo) */
.ann .win{grid-row:1;grid-column:1;place-self:center;z-index:3;max-width:86vw;padding:.12em .5em;border-radius:.18em;font:900 clamp(44px,8vw,170px)/1.05 var(--display);text-align:center;overflow-wrap:break-word;box-shadow:0 .08em .3em rgba(0,0,0,.45)}
/* la vidéo et le nom partagent la même case : le nom se pose sur l'image au lieu de la pousser sur le côté */
.ann.below video{grid-column:1}.ann.below .txt{grid-column:1}
.ann.qualifies:not(.below) .txt{grid-row:1;grid-column:1;align-self:end;margin-bottom:5vh}
.ann.qualifies:not(.below) .tt{font-size:clamp(28px,4.4vw,84px)}.ann.qualifies:not(.below) .bd{font-size:clamp(18px,2.3vw,44px)}
.ann .brand{position:absolute;z-index:2;left:3vw;bottom:3vh;height:clamp(36px,5vw,90px);width:auto}
.ann .bar{position:absolute;z-index:3;left:0;right:0;bottom:0;height:8px;background:#fbba00;transform-origin:left;transform:scaleX(0);animation:annBar linear forwards}
.ann .diag{position:absolute;z-index:4;right:1vw;top:2vh;font:700 14px var(--body);background:#000;color:#fff;padding:6px 10px;border-radius:6px}
.ann.finale .tt{font-size:clamp(36px,6.4vw,124px);white-space:nowrap}
.ann.below{grid-template-rows:minmax(0,1fr) auto}
.ann.below video{position:relative;inset:auto;grid-row:1;width:100%;height:100%;min-height:0;object-fit:cover}
.ann.below .txt,.ann.below.qualifies .txt,.ann.below.finale .txt,.ann.below.consolante .txt,.ann.below.poules .txt{grid-row:2;align-self:stretch;justify-self:stretch;max-width:none;margin:0;border-radius:0;background:#1d1d1b;padding:2.2vh 12vw 3.2vh;text-align:center}
.ann.below .tt{font-size:clamp(28px,4.4vw,84px);white-space:nowrap}
.ann.below .bd{font-size:clamp(18px,2.3vw,44px)}
.ann.below .brand{height:clamp(28px,3.6vw,64px)}
.call{position:fixed;left:0;right:0;top:0;z-index:45;background:linear-gradient(180deg,#d9532b 0%,#c44a25 100%);color:#fff;padding:1.6vh 3vw;display:flex;align-items:center;justify-content:center;gap:2vw;transform:translateY(-110%);transition:transform .45s cubic-bezier(.2,1.2,.4,1);box-shadow:0 8px 32px rgba(0,0,0,.35)}
.call.on{transform:none}
.call .mach{font:900 clamp(22px,3vw,48px) var(--display);background:#1d1d1b;color:#fbba00;padding:.15em .5em;border-radius:10px;white-space:nowrap}
.call .vs{font:800 clamp(20px,2.4vw,40px)/1.15 var(--body);text-align:center}
.call .vs b{font-weight:900}
.call .go{font:800 clamp(16px,1.6vw,28px) var(--body);letter-spacing:.08em;text-transform:uppercase;opacity:.95}
.flash{position:fixed;inset:0;z-index:55;background:#1d1d1b;color:#fff;display:grid;place-items:center;opacity:0;transition:opacity .4s}
.flash.on{opacity:1}
.flash .big{font:900 clamp(64px,18vw,280px)/.9 var(--display);color:#fbba00;text-align:center;animation:flashPop .6s cubic-bezier(.2,1.4,.4,1)}
.flash .who{font:800 clamp(28px,4vw,72px)/1.2 var(--body);text-align:center;margin-top:.3em}
.flash.finish .big{color:#d9532b;font-size:clamp(48px,12vw,180px)}
.draw{position:fixed;inset:0;z-index:52;background:#1d1d1b;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;opacity:0;transition:opacity .4s}
.draw.on{opacity:1}
.draw .cd{font:900 clamp(80px,22vw,320px)/1 var(--display);color:#fbba00}
.draw .label{font:800 clamp(20px,2.5vw,40px) var(--body);letter-spacing:.1em;text-transform:uppercase;color:#fbba00}
.draw .slot{font:900 clamp(28px,4vw,64px) var(--display);min-height:1.2em;text-align:center;padding:0 4vw}
.draw .slot em{font-style:normal;background:#d9532b;color:#fff;padding:0 .2em;border-radius:.12em}
.draw .list{display:flex;flex-wrap:wrap;gap:10px 18px;justify-content:center;max-width:90vw;margin-top:2vh}
.draw .list span{font:700 clamp(14px,1.4vw,24px) var(--body);background:#2a2a28;padding:6px 14px;border-radius:8px;opacity:0;transform:translateY(12px);transition:opacity .35s,transform .35s}
.draw .list span.in{opacity:1;transform:none}
.draw .list span i{font-style:normal;color:#fbba00;font-weight:800;margin:0 .3em}
.draw .list.many span{font-size:clamp(12px,1.05vw,19px);padding:4px 10px}
.wheel-wrap{position:fixed;inset:0;z-index:53;background:#1d1d1b;color:#fff;display:grid;place-items:center;opacity:0;transition:opacity .4s}
.wheel-wrap.on{opacity:1}
.wheel-wrap .box{text-align:center}
.wheel-wrap h2{font:900 clamp(28px,4vw,64px) var(--display);color:#fbba00;margin:0 0 2vh}
.wheel{width:min(70vw,420px);height:min(70vw,420px);border-radius:50%;border:8px solid #fbba00;position:relative;overflow:hidden;margin:0 auto;transition:transform 4.5s cubic-bezier(.12,.75,.08,1)}
.wheel{--wr:min(70vw,420px)}
.wheel .seg{position:absolute;inset:0;font:800 clamp(11px,1.3vw,18px) var(--body)}
.wheel .seg span{position:absolute;left:50%;top:50%;max-width:calc(var(--wr) * .34);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.wheel-wrap .pin{width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:28px solid #d9532b;margin:0 auto 8px}
.wheel-wrap .winner{font:900 clamp(32px,5vw,80px) var(--display);margin-top:3vh;min-height:1.2em}
.pod{position:fixed;inset:0;z-index:54;background:#1d1d1b;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;opacity:0;transition:opacity .5s}
.pod.on{opacity:1}
.pod h2{font:900 clamp(32px,5vw,80px) var(--display);color:#fbba00;margin:0}
.pod .steps{display:flex;align-items:flex-end;gap:clamp(12px,2vw,28px);margin-top:2vh}
.pod .step{display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transform:translateY(40px);transition:opacity .5s,transform .5s}
.pod .step.in{opacity:1;transform:none}
.pod .step .pl{font:900 clamp(40px,6vw,96px) var(--display);width:clamp(64px,8vw,110px);height:clamp(64px,8vw,110px);border-radius:50%;display:grid;place-items:center}
.pod .step.s1 .pl{background:#e0a800;color:#1d1d1b}
.pod .step.s2 .pl{background:#b9b9b4;color:#1d1d1b}
.pod .step.s3 .pl{background:#c47a3e;color:#1d1d1b}
.pod .step .nm{font:800 clamp(18px,2.2vw,40px) var(--body);max-width:28vw;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pod .step.s1{order:2}.pod .step.s2{order:1}.pod .step.s3{order:3}
.pod .step.s1 .pl{transform:scale(1.15)}
@keyframes annBar{to{transform:scaleX(1)}}
@keyframes flashPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.ann *,.flash *,.draw *,.call,.pod *{animation-duration:.01s!important;transition-duration:.01s!important}}
`;

export function createAnnouncer(logoUrl, onIdle, diag = false, textMode = () => 'sous') {
  const queue = []; let busy = false;
  const players = {}, info = {};
  async function preload() {
    for (const k of Object.keys(VIDEOS)) {
      try {
        const r = await fetch(videoUrl(k), { cache: 'no-cache' });
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('video')) { delete players[k]; continue; }
        const blob = await r.blob();
        if (info[k]?.size === blob.size && players[k]) continue;
        const v = document.createElement('video');
        Object.assign(v, { muted: true, playsInline: true, preload: 'auto' });
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        const old = players[k]; v.src = URL.createObjectURL(blob); v.load();
        await new Promise((ok) => { v.addEventListener('canplaythrough', ok, { once: true }); v.addEventListener('error', ok, { once: true }); setTimeout(ok, 15000); });
        if (v.error) continue;
        players[k] = v; info[k] = { size: blob.size };
        if (old) URL.revokeObjectURL(old.src);
      } catch { /* réseau */ }
    }
  }
  const loaded = preload(); setInterval(() => { if (!busy) preload(); }, 30 * 60000);
  const app = () => document.getElementById('app');
  function hideApp(hide) { if (app()) app().style.visibility = hide ? 'hidden' : ''; }

  async function showVideoAnn(a) {
    busy = true;
    const el = document.createElement('div');
    el.className = `ann ${a.kind}${textMode() === 'sur' ? '' : ' below'}`;
    el.innerHTML = `${a.win ? `<div class="win" style="background:${a.win.bg};color:${a.win.fg}">${esc(a.win.name)}</div>` : ''}<div class="txt"><div class="tt">${a.title}</div><div class="bd">${a.body}</div></div>
      ${logoUrl ? `<img class="brand" src="${logoUrl}" alt="" onerror="this.remove()">` : ''}<div class="bar" style="animation-duration:${DURATION[a.kind] || 10000}ms"></div>`;
    const vKey = VIDEOS[a.kind] ? a.kind : (a.kind === 'consolante' || a.kind === 'poules' ? 'qualifies' : null);
    const v = vKey ? players[vKey] : null;
    if (v) { v.pause(); v.currentTime = 0; el.prepend(v); }
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    await new Promise((ok) => setTimeout(ok, 550));
    hideApp(true);
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    play(a.kind === 'finale' ? 'finale' : a.kind === 'poules' ? 'tada' : 'victoire');
    let len = DURATION[a.kind] || 10000;
    if (v) {
      try {
        el.querySelector('.bar')?.remove();
        await v.play();
        if (Number.isFinite(v.duration) && v.duration > 1) len = Math.min(v.duration, 30) * 1000;
        await new Promise((ok) => { const t = setTimeout(ok, len + 1500); v.addEventListener('ended', () => { clearTimeout(t); ok(); }, { once: true }); });
      } catch { await new Promise((ok) => setTimeout(ok, len)); }
    } else await new Promise((ok) => setTimeout(ok, len));
    hideApp(false);
    el.classList.remove('on');
    await new Promise((r) => setTimeout(r, 600));
    if (v) { v.pause(); v.remove(); }
    el.remove();
    busy = false;
    next();
  }

  async function showAppel(a) {
    busy = true;
    const el = document.createElement('div');
    el.className = 'call';
    el.innerHTML = `<span class="mach">Machine ${esc(String(a.machine || 1))}</span>
      <span class="vs"><b>${esc(a.a)}</b> · contre · <b>${esc(a.b)}</b></span>
      <span class="go">À vous de jouer !</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    play('appel'); play('appel', 4.5, 0.7);   // carillon, répété une fois plus doucement
    await new Promise((ok) => setTimeout(ok, DURATION.appel));
    el.classList.remove('on');
    await new Promise((ok) => setTimeout(ok, 450));
    el.remove();
    busy = false;
    next();
  }

  async function showFlash(a) {
    busy = true;
    hideApp(true);
    const el = document.createElement('div');
    el.className = `flash ${a.kind === 'finish' ? 'finish' : ''}`;
    el.innerHTML = `<div><div class="big">${a.kind === 'finish' ? 'FINISH !' : '180'}</div><div class="who">${esc(a.name || '')}</div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    play(a.kind === 'finish' ? 'finish' : '180');
    await new Promise((ok) => setTimeout(ok, DURATION[a.kind] || 8000));
    el.classList.remove('on');
    await new Promise((ok) => setTimeout(ok, 400));
    el.remove();
    hideApp(false);
    busy = false;
    next();
  }

  async function showTirage(a) {
    busy = true;
    hideApp(true);
    const el = document.createElement('div');
    el.className = 'draw';
    el.innerHTML = `<div class="label">Tirage au sort</div><div class="cd" id="drawCd">3</div><div class="slot" id="drawSlot"></div><div class="list" id="drawList"></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const cd = el.querySelector('#drawCd');
    for (const n of [3, 2, 1]) { cd.textContent = n; play('tick'); await new Promise((ok) => setTimeout(ok, 900)); }
    cd.textContent = 'GO'; play('go');
    await new Promise((ok) => setTimeout(ok, 700));
    cd.style.display = 'none';
    const slot = el.querySelector('#drawSlot');
    const list = el.querySelector('#drawList');
    // a.pairs : affiches du 1er tour [[A, B], …] ou poules [{ g: 'A', names: […] }] ; a.teams : simple liste de noms
    const items = (a.pairs || []).map((x) => Array.isArray(x)
      ? { big: `<em>${esc(x[0])}</em> contre <em>${esc(x[1])}</em>`, small: `${esc(x[0])} <i>vs</i> ${esc(x[1])}` }
      : { big: `Poule ${esc(x.g)} : ${x.names.map((n) => `<em>${esc(n)}</em>`).join(' · ')}`, small: `<b>Poule ${esc(x.g)}</b> ${x.names.map(esc).join(' · ')}` });
    if (!items.length) (a.teams || []).forEach((n) => items.push({ big: `<em>${esc(n)}</em>`, small: esc(n) }));
    if (items.length > 8) list.classList.add('many');
    const step = Math.max(380, Math.min(1300, 9000 / Math.max(1, items.length)));
    for (const it of items) {
      slot.innerHTML = it.big; play('pop');
      const sp = document.createElement('span');
      sp.innerHTML = it.small;
      list.appendChild(sp);
      requestAnimationFrame(() => sp.classList.add('in'));
      await new Promise((ok) => setTimeout(ok, step));
    }
    slot.innerHTML = 'Tableau prêt 🎯'; play('tada');
    await new Promise((ok) => setTimeout(ok, 2200));
    el.classList.remove('on');
    await new Promise((ok) => setTimeout(ok, 400));
    el.remove();
    hideApp(false);
    busy = false;
    next();
  }

  async function showRoue(a) {
    busy = true;
    hideApp(true);
    const names = a.names || [];
    const winner = a.winner || names[0] || '—';
    let pool = names.filter(Boolean).slice(0, 16);
    if (!pool.includes(winner)) pool = [winner, ...pool.slice(0, 15)];
    pool = pool.sort(() => Math.random() - 0.5);
    const n = Math.max(pool.length, 6);
    const segs = [];
    for (let i = 0; i < n; i++) segs.push(pool[i % pool.length] || '·');
    const winIdx = Math.max(0, segs.indexOf(winner));
    const segAngle = 360 / n;
    const finalDeg = 360 * 5 + (360 - (winIdx * segAngle + segAngle / 2));
    const colors = ['#d9532b', '#2e7a72', '#fbba00', '#1d1d1b', '#c47a3e', '#4a90a4'];
    const el = document.createElement('div');
    el.className = 'wheel-wrap';
    el.innerHTML = `<div class="box"><h2>${esc(a.label || 'Tirage au sort')}</h2><div class="pin"></div><div class="wheel" id="whl"></div><div class="winner" id="whlWin"></div></div>`;
    const whl = el.querySelector('#whl');
    segs.forEach((name, i) => {
      const s = document.createElement('div');
      s.className = 'seg';
      s.style.background = colors[i % colors.length];
      s.style.clipPath = `polygon(50% 50%, ${50 + 75 * Math.cos((i * segAngle - 90) * Math.PI / 180)}% ${50 + 75 * Math.sin((i * segAngle - 90) * Math.PI / 180)}%, ${50 + 75 * Math.cos(((i + 1) * segAngle - 90) * Math.PI / 180)}% ${50 + 75 * Math.sin(((i + 1) * segAngle - 90) * Math.PI / 180)}%)`;
      const lb = document.createElement('span');
      lb.textContent = name.length > 14 ? name.slice(0, 12) + '…' : name;
      lb.style.transform = `translate(-50%,-50%) rotate(${(i + 0.5) * segAngle - 90}deg) translateX(calc(var(--wr) * .27))`;
      s.appendChild(lb);
      whl.appendChild(s);
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    await new Promise((ok) => setTimeout(ok, 400));
    whl.style.transform = `rotate(${finalDeg}deg)`; play('roue');
    await new Promise((ok) => setTimeout(ok, 4800));
    el.querySelector('#whlWin').textContent = winner; play('tada');
    await new Promise((ok) => setTimeout(ok, 3500));
    el.classList.remove('on');
    await new Promise((ok) => setTimeout(ok, 400));
    el.remove();
    hideApp(false);
    busy = false;
    next();
  }

  async function showPodium(a) {
    busy = true;
    hideApp(true);
    const places = a.places || [];
    const el = document.createElement('div');
    el.className = 'pod';
    el.innerHTML = `<h2>Podium</h2><div class="steps" id="podSteps"></div>`;
    const steps = el.querySelector('#podSteps');
    [3, 2, 1].forEach((p) => {
      const t = places.find((x) => x.place === p);
      if (!t) return;
      const d = document.createElement('div');
      d.className = `step s${p}`;
      d.innerHTML = `<span class="pl">${p}</span><span class="nm">${esc(t.name)}</span>`;
      steps.appendChild(d);
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    play('roulement');
    await new Promise((ok) => setTimeout(ok, 500));
    for (const k of [...steps.children]) {
      k.classList.add('in');
      play(k === steps.lastElementChild ? 'finale' : 'pop');
      await new Promise((ok) => setTimeout(ok, 900));
    }
    await new Promise((ok) => setTimeout(ok, 5000));
    el.classList.remove('on');
    await new Promise((ok) => setTimeout(ok, 500));
    el.remove();
    hideApp(false);
    busy = false;
    next();
  }

  function next() {
    if (queue.length) run(queue.shift());
    else onIdle?.();
  }
  function run(a) {
    if (a.type === 'appel') return showAppel(a);
    if (a.type === 'flash') return showFlash(a);
    if (a.type === 'tirage') return showTirage(a);
    if (a.type === 'roue') return showRoue(a);
    if (a.type === 'podium') return showPodium(a);
    return showVideoAnn(a);
  }

  return {
    push(a) { if (busy) queue.push(a); else run(a); },
    pushAppel(machine, aName, bName) { this.push({ type: 'appel', machine, a: aName, b: bName }); },
    pushFlash(kind, name) { this.push({ type: 'flash', kind: kind === 'finish' ? 'finish' : 'oneeighty', name }); },
    pushTirage(list) { const l = list || []; this.push(l.some((x) => typeof x !== 'string') ? { type: 'tirage', pairs: l } : { type: 'tirage', teams: l }); },
    pushRoue(label, names, winner) { this.push({ type: 'roue', label, names, winner }); },
    pushPodium(places) { this.push({ type: 'podium', places }); },
    get busy() { return busy || queue.length > 0; },
    loaded,
  };
}

export function detect(c, prev, machines) {
  if (!prev) return [];
  const out = [];
  for (const m of c.matches) {
    if (m.status !== 'done' || m.bye || !m.winner || m.winner === NONE) continue;
    const before = prev.get(m.id);
    if (!before || before.status === 'done') continue;
    if (m.played_at && Date.now() - Date.parse(m.played_at) > 10 * 60000) continue;
    const kind = kindOf(c, m);
    out.push({ kind, ...texts(c, m, kind, machines.get(m.id) || before.machine) });
  }
  if (prev.phase === 'pools' && c.phase === 'bracket' && c.pools?.length) {
    out.push({ kind: 'poules', ...textsPoules(c) });
  }
  return out.sort((a, b) => {
    const rank = (k) => (k === 'finale' ? 3 : k === 'consolante' ? 2 : k === 'poules' ? 1 : 0);
    return rank(a.kind) - rank(b.kind);
  });
}

export function detectLive(c, prev) {
  if (!prev) return [];
  const out = [];
  for (const m of c.matches) {
    if (m.status !== 'live' || !m.a || !m.b || m.a === NONE || m.b === NONE) continue;
    const before = prev.get(m.id);
    if (before && before.status === 'live') continue;
    out.push({ machine: m.machine || 1, a: tname(c, m.a), b: tname(c, m.b), id: m.id });
  }
  return out;
}
