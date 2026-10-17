// Cérémonies TV côté staff : 180, finish, tirage, roue des lots, score défi rapide.
// Importé par staff.js (voir INSTALL-TV.md).
import { sb } from './sb.js';
import { weekMonday } from './util.js';
import { tname } from './views.js';

const ch = sb.channel('tv-flash');
let ready = false;
ch.subscribe((s) => { if (s === 'SUBSCRIBED') ready = true; });

export function sendCeremony(payload) {
  return ch.send({ type: 'broadcast', event: 'ceremony', payload });
}

/** Après le tirage au sort du tableau */
export function notifyTirage(teamNames) {
  return sendCeremony({ kind: 'tirage', teams: teamNames || [] });
}

/** Après tirage d'un lot de consolation */
export function notifyRoue(label, poolNames, winnerName) {
  return sendCeremony({ kind: 'roue', label, names: poolNames || [], winner: winnerName });
}

export function notify180(name) {
  return sendCeremony({ kind: '180', name });
}

export function notifyFinish(name) {
  return sendCeremony({ kind: 'finish', name });
}

/** Panneau 180 / Finish + score défi (onglet Ce soir, concours en cours) */
export function ceremonyPanelHTML() {
  return `<section class="panel">
    <h3>Moment fort (écran TV)</h3>
    <p class="muted small">180 ou finish spectaculaire : plein écran sur la télé avec le prénom.</p>
    <div class="row">
      <div class="field" style="flex:1;min-width:160px"><label for="flashName">Prénom du joueur</label>
        <input id="flashName" maxlength="30" placeholder="ex. Léa" autocomplete="off"></div>
      <button type="button" class="btn red" data-act="flash180">180 !</button>
      <button type="button" class="btn" data-act="flashFinish">Finish !</button>
    </div>
  </section>
  <section class="panel">
    <h3>Score défi (TV)</h3>
    <p class="muted small">Count-Up ou Big Bull sur une machine libre — visible sur la TV (meilleur ce soir).</p>
    <form id="quickRec" class="row" style="align-items:flex-end">
      <div class="field"><label for="qrGame">Jeu</label>
        <select id="qrGame"><option>Count-Up</option><option>Big Bull</option></select></div>
      <div class="field" style="flex:1;min-width:120px"><label for="qrPlayer">Prénom</label>
        <input id="qrPlayer" required maxlength="30" placeholder="ex. Karim"></div>
      <div class="field" style="width:110px"><label for="qrScore">Score</label>
        <input id="qrScore" type="number" required min="0" max="2000" inputmode="numeric"></div>
      <button class="btn red" type="submit">Noter</button>
    </form>
  </section>`;
}

/** À brancher dans l'objet A des actions staff */
export const ceremonyActions = {
  flash180: (toast) => {
    const name = (document.getElementById('flashName')?.value || '').trim();
    if (!name) return toast('Indiquez le prénom du joueur');
    notify180(name);
    toast('Animation 180 envoyée sur la TV');
  },
  flashFinish: (toast) => {
    const name = (document.getElementById('flashName')?.value || '').trim();
    if (!name) return toast('Indiquez le prénom du joueur');
    notifyFinish(name);
    toast('Animation Finish envoyée sur la TV');
  },
};

export async function submitQuickRecord(toast) {
  const game = document.getElementById('qrGame')?.value || 'Count-Up';
  const player_name = (document.getElementById('qrPlayer')?.value || '').trim();
  const score = +document.getElementById('qrScore')?.value;
  if (!player_name) return toast('Indiquez le prénom');
  if (!Number.isFinite(score) || score < 0) return toast('Score invalide');
  const { error } = await sb.from('records').insert({ week_start: weekMonday(), game, player_name, score });
  if (error) return toast(error.message);
  toast(`Score noté : ${player_name} ${score} (${game})`);
  document.getElementById('quickRec')?.reset();
}

/** Noms d'équipes présentes (pour le tirage TV) */
export function presentTeamNames(regs) {
  return (regs || []).filter((r) => r.status === 'confirmee' && r.present).map((r) => r.teams?.name || r.team_name || '').filter(Boolean);
}

export function allConfirmedNames(regs) {
  return (regs || []).filter((r) => r.status === 'confirmee' && r.present).map((r) => r.teams?.name || '').filter(Boolean);
}

export { tname, ready as tvFlashReady };
