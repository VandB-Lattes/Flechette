// Temps morts sur l'écran TV : défi Count-Up sur machine libre + record de la semaine / de la soirée.
// À utiliser depuis suivi.html (bandeau bas + panneau latéral pendant en_cours).
import { esc } from './util.js';
import * as E from './engine.js';

/** Meilleur score parmi une liste de records pour un jeu donné */
export function bestOf(recs, game) {
  const list = (recs || []).filter((r) => r.game === game);
  if (!list.length) return null;
  return list.reduce((a, b) => (b.score > a.score ? b : a));
}

/** Records du jour (soirée) vs semaine */
export function splitRecords(recs, todayYmd) {
  const week = recs || [];
  const evening = week.filter((r) => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return ymd === todayYmd;
  });
  return { week, evening };
}

/**
 * Machines libres pendant un concours en cours.
 * settings = venue.settings ; c = concours moteur.
 */
export function freeMachines(c, settings) {
  if (!c || c.status !== 'en_cours') return [];
  const N = E.machines(settings);
  const out = [];
  for (let k = 1; k <= N; k++) {
    if (!E.onMachine(c, k)) out.push(k);
  }
  return out;
}

/** Y a-t-il un « temps mort » ? Au moins une machine libre et pas d'annonce en cours */
export function isIdle(c, settings) {
  if (!c) return true;
  if (c.status === 'ouvert' || c.status === 'brouillon') return true;
  if (c.status === 'termine') return false;
  return freeMachines(c, settings).length > 0;
}

/**
 * Carte « Défi Count-Up » pour une machine libre.
 * eveningBest / weekBest : { player_name, score } | null
 */
export function challengeCardHTML(machine, eveningBest, weekBest) {
  const soiree = eveningBest
    ? `<b>${esc(eveningBest.player_name)}</b> · <span class="clock" style="font-size:1.4em">${eveningBest.score}</span>`
    : '<span class="muted">à battre</span>';
  const semaine = weekBest
    ? `${esc(weekBest.player_name)} · ${weekBest.score}`
    : 'pas encore de score';
  return `<div class="idle-challenge tvm">
    <div class="tvmh"><b>Machine ${machine}</b><span class="pill" style="background:var(--yellow);color:var(--ink)">Libre</span></div>
    <div class="idle-cta">Défi <b>Count-Up</b></div>
    <p class="idle-hint">8 tours · qui fait le plus gros score ?</p>
    <div class="idle-best"><span class="eyebrow">Meilleur ce soir</span><div>${soiree}</div></div>
    <div class="idle-week muted small">Record de la semaine · ${esc(semaine)}</div>
  </div>`;
}

/**
 * Panneau record (semaine + soirée) pour les temps morts / avant tirage.
 * games = ['Count-Up','Big Bull']
 */
export function recordsPanelHTML(recs, todayYmd, { title = 'Record de la semaine', compact = false } = {}) {
  const { week, evening } = splitRecords(recs, todayYmd);
  const row = (g) => {
    const w = bestOf(week, g);
    const e = bestOf(evening, g);
    return `<div class="idle-rec-row">
      <div><b>${esc(g)}</b>
        ${e && (!w || e.score >= w.score) ? `<span class="pill ok" style="margin-left:6px">meilleur ce soir</span>` : ''}
      </div>
      <div class="idle-rec-scores">
        <span title="Semaine"><span class="muted small">Sem.</span> ${w ? `<b>${esc(w.player_name)}</b> <span class="clock" style="font-size:1.25em">${w.score}</span>` : '–'}</span>
        <span title="Ce soir"><span class="muted small">Soir</span> ${e ? `<b>${esc(e.player_name)}</b> <span class="clock" style="font-size:1.25em">${e.score}</span>` : '–'}</span>
      </div>
    </div>`;
  };
  return `<section class="panel idle-records ${compact ? 'compact' : ''}">
    <h3>${esc(title)}</h3>
    <p class="muted small">Count-Up ou Big Bull en solo sur une machine libre. Demandez au staff de noter votre score.</p>
    ${['Count-Up', 'Big Bull'].map(row).join('')}
  </section>`;
}

/**
 * Bloc à injecter dans le bandeau bas (strip) pendant en_cours :
 * une carte défi par machine libre + mini record soirée.
 */
export function idleStripHTML(c, settings, recs, todayYmd) {
  const free = freeMachines(c, settings);
  if (!free.length) return '';
  const { week, evening } = splitRecords(recs, todayYmd);
  const eCU = bestOf(evening, 'Count-Up');
  const wCU = bestOf(week, 'Count-Up');
  return free.map((k) => challengeCardHTML(k, eCU, wCU)).join('');
}

/**
 * Vue « temps mort » plus large : si toutes les machines sont libres un instant
 * (ou entre deux phases), on peut alterner avec le tableau.
 * Retourne du HTML pour une colonne latérale ou une page d'idle.
 */
export function idleSideHTML(c, settings, recs, todayYmd) {
  const free = freeMachines(c, settings);
  if (!free.length && c?.status === 'en_cours') return '';
  const { week, evening } = splitRecords(recs, todayYmd);
  let challenges = '';
  if (free.length) {
    const eCU = bestOf(evening, 'Count-Up');
    const wCU = bestOf(week, 'Count-Up');
    challenges = `<div class="stack" style="gap:10px">${free.map((k) => challengeCardHTML(k, eCU, wCU)).join('')}</div>`;
  }
  return `${challenges}${recordsPanelHTML(recs, todayYmd, { title: free.length ? 'Records' : 'Record de la semaine', compact: true })}`;
}

export const IDLE_CSS = `
.idle-challenge{border:2px dashed var(--yellow)!important;background:#fffdf5!important}
.idle-cta{font:900 clamp(18px,1.8vw,32px) var(--display);color:var(--ink);margin:6px 0 2px}
.idle-hint{margin:0;color:var(--muted);font-size:clamp(13px,1.1vw,18px)}
.idle-best{margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}
.idle-best .eyebrow{display:block;margin-bottom:2px}
.idle-week{margin-top:4px}
.idle-records .idle-rec-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)}
.idle-records .idle-rec-row:last-child{border-bottom:0}
.idle-rec-scores{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:baseline}
.idle-records.compact{padding:12px}
.idle-records.compact h3{font-size:clamp(16px,1.4vw,24px)}
`;
