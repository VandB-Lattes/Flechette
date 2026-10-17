// Fil conducteur de l'espace staff : l'application dit en permanence au staff ce qu'il y a à faire maintenant,
// avec le bouton qui le fait. Personne n'a besoin de deviner dans quel onglet aller.
import * as E from './engine.js';
import { esc, fmtDate, hhmm, today } from './util.js';
import { tname } from './views.js';

export const STEPS = ['Inscriptions', 'Pointage', 'Tirage', 'Matchs', 'Résultats'];
const daysTo = (d) => Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5);
const s_ = (n) => (n > 1 ? 's' : '');
const since = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? '' : ` (depuis ${m} min)`; };

/** Étape en cours et action à faire. Renvoie { i, tone, title, body, action, extra } */
export function nextStep({ c, regs, contests, settings }) {
  const go = (label, act, data = {}) => ({ label, act, data });

  if (!contests.length) return { i: 0, tone: 'go', title: 'Bienvenue dans l’espace staff',
    body: 'Rien n’est encore programmé. Créez votre premier concours, ou un concours de test pour vous entraîner sans toucher aux vrais.',
    action: go('Créer un concours', 'newContest'), extra: go('Créer un concours de test', 'testCreate') };
  if (!c) return { i: 0, tone: 'go', title: 'Choisissez un concours',
    body: 'Sélectionnez un concours dans la liste ci-dessous, ou créez-en un nouveau.', action: go('Créer un concours', 'newContest') };

  const conf = regs.filter((r) => r.status === 'confirmee');
  const pres = conf.filter((r) => r.present);
  const d = daysTo(c.date), hStart = hhmm(c.start_time).replace(':', 'h');

  if (c.status === 'brouillon') return { i: 0, tone: 'go', title: 'Ouvrez les inscriptions',
    body: `Le concours du ${fmtDate(c.date)} à ${hStart} est en brouillon : personne ne le voit encore, ni les joueurs sur leur téléphone, ni l’écran TV.`,
    action: go('Ouvrir les inscriptions', 'openReg'), extra: go('Modifier le concours', 'goTab', { t: 'concours' }) };

  if (c.status === 'ouvert') {
    if (d > 0) {
      const left = Math.max(0, c.max_teams - conf.length);
      return { i: 0, tone: d <= 1 ? 'go' : left ? 'go' : 'ok',
        title: d === 1 ? 'Le concours est demain' : `Concours dans ${d} jours`,
        body: `${conf.length} équipe${s_(conf.length)} inscrite${s_(conf.length)} sur ${c.max_teams}. ` +
          (left ? `Il reste ${left} place${s_(left)} : publiez l’annonce et le QR code sur Instagram pour remplir le tableau.` : 'C’est complet : les équipes suivantes passent automatiquement en liste d’attente.'),
        action: go('Copier l’annonce Instagram', 'goTab', { t: 'com' }), extra: go('Voir les équipes', 'goTab', { t: 'equipes' }) };
    }
    if (d < 0) return { i: 1, tone: 'warn', title: 'Ce concours est passé',
      body: `Il était prévu le ${fmtDate(c.date)} et n’a jamais été lancé. Lancez le tirage s’il a lieu maintenant, ou passez au concours suivant.`,
      action: go('Aller au tirage', 'goTab', { t: 'jourj' }), extra: go('Créer le prochain concours', 'dupContest') };
    if (conf.length < 2) return { i: 1, tone: 'wait', title: 'En attente d’équipes',
      body: `C’est aujourd’hui à ${hStart}, et il n’y a que ${conf.length} équipe inscrite. Les joueurs s’inscrivent sur leur téléphone, ou vous les inscrivez au comptoir.`,
      action: go('Inscrire une équipe', 'goTab', { t: 'equipes' }) };
    if (pres.length < conf.length) return { i: 1, tone: 'go', title: 'Pointez les équipes à leur arrivée',
      body: `${pres.length} équipe${s_(pres.length)} pointée${s_(pres.length)} sur ${conf.length}. Touchez « Pointer présente » quand une équipe se présente au comptoir : seules les équipes présentes entrent dans le tirage.`,
      action: go('Pointer les équipes', 'goTab', { t: 'jourj' }) };
    return { i: 2, tone: 'go', title: 'Tout le monde est là : lancez le tirage',
      body: `${pres.length} équipes pointées présentes. Le tirage ferme les inscriptions et affiche aussitôt le tableau sur les téléphones et sur l’écran TV.`,
      action: go('Lancer le tirage', 'goTab', { t: 'jourj' }) };
  }

  if (c.status === 'en_cours') {
    if (E.poolsDone(c) && !E.lives(c).length) return { i: 3, tone: 'go', title: 'Poules terminées',
      body: 'Tous les matchs de poules sont joués. Générez le tableau final : les deux premiers de chaque poule sont qualifiés.',
      action: go('Générer le tableau final', 'finalDraw') };
    const k = E.freeMachine(c, settings), nx = E.launchable(c)[0];
    if (k && nx) return { i: 3, tone: 'go', title: `Machine ${k} libre : lancez le match suivant`,
      body: `${tname(c, nx.a)} contre ${tname(c, nx.b)}. Lancez une partie de ${E.gameFor(c, nx)} sur la DARTSLIVE ${k}, appelez les équipes, puis touchez le bouton.`,
      action: go(`Lancer sur la machine ${k}`, 'golive', { mid: nx.id, k }), extra: go('Voir les machines', 'goTab', { t: 'jourj' }) };
    const lv = E.lives(c);
    if (lv.length) return { i: 3, tone: 'ok', title: `${lv.length} match${s_(lv.length)} en cours`,
      body: lv.map((m) => `Machine ${m.machine || 1} : ${tname(c, m.a)} contre ${tname(c, m.b)}${since(m.live_at)}`).join(' · ') + '. Dès qu’un match se termine, touchez l’équipe gagnante — ou laissez les joueurs le déclarer depuis leur téléphone.',
      action: go('Voir les machines', 'goTab', { t: 'jourj' }) };
    return { i: 3, tone: 'wait', title: 'Aucun match à lancer',
      body: 'Les prochains matchs attendent la fin d’un match en cours.', action: go('Voir le tableau', 'goTab', { t: 'jourj' }) };
  }

  const conso = c.prizes?.conso || [];
  const pending = conso.find((x) => x.rule === 'tirage' && !x.winner);
  if (pending) return { i: 4, tone: 'go', title: 'Tirez au sort les prix de consolation',
    body: `Le concours est terminé. Il reste à attribuer : ${pending.label}.`, action: go('Aller aux résultats', 'goTab', { t: 'resultats' }) };
  if (!c.podium_photo_url) return { i: 4, tone: 'go', title: 'Photo du podium',
    body: 'Prenez la photo des gagnants, avec leur accord, et publiez-la. Les points de la saison sont déjà comptés.',
    action: go('Publier la photo', 'goTab', { t: 'resultats' }), extra: go('Copier la légende Instagram', 'goTab', { t: 'com' }) };
  return { i: 4, tone: 'ok', title: 'Concours terminé, tout est en ordre',
    body: 'Podium, lots et points de la saison sont enregistrés. Il ne reste qu’à publier les résultats et à préparer la semaine prochaine.',
    action: go('Copier la légende des résultats', 'goTab', { t: 'com' }), extra: go('Dupliquer pour la semaine prochaine', 'dupContest') };
}

/** Onglet concerné par l'étape en cours (pour y poser une pastille) */
export function stepTab(s) {
  if (!s) return null;
  if (s.action.act === 'goTab') return s.action.data.t;
  if (s.action.act === 'golive' || s.action.act === 'finalDraw') return 'jourj';
  if (s.action.act === 'newContest' || s.action.act === 'openReg') return 'concours';
  return null;
}

const attrs = (d) => Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');

export function flowHTML(s) {
  return `<section class="flow ${s.tone}" aria-label="Prochaine étape">
    <div class="flowBody">
      <div class="eyebrow">Étape ${s.i + 1} sur ${STEPS.length} · ${esc(STEPS[s.i])}</div>
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.body)}</p>
      <div class="row"><button class="btn red xl" data-act="${esc(s.action.act)}"${attrs(s.action.data)}>${esc(s.action.label)}</button>
        ${s.extra ? `<button class="btn ghost" data-act="${esc(s.extra.act)}"${attrs(s.extra.data)}>${esc(s.extra.label)}</button>` : ''}</div>
    </div>
    <ol class="flowSteps">${STEPS.map((l, i) => `<li class="${i < s.i ? 'done' : i === s.i ? 'now' : ''}"><b>${i < s.i ? '✓' : i + 1}</b><span>${esc(l)}</span></li>`).join('')}</ol>
  </section>`;
}

export const FLOW_CSS = `
.flow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 24px;align-items:center;border:2px solid var(--line);border-left:10px solid var(--yellow);border-radius:14px;padding:16px 20px;margin-bottom:16px;background:var(--surface)}
.flow.go{border-left-color:var(--yellow);background:#fffdf5}
.flow.ok{border-left-color:var(--teal);background:#f5faf9}
.flow.wait{border-left-color:var(--line)}
.flow.warn{border-left-color:var(--orange);background:#fdf6f3}
.flowBody h2{font-size:clamp(20px,2.4vw,30px);margin:2px 0 4px;text-transform:none}
.flowBody p{margin:0 0 12px;font-size:clamp(14px,1.3vw,17px);max-width:72ch}
.flowSteps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;min-width:132px}
.flowSteps li{display:flex;align-items:center;gap:9px;font:700 12px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:3px 0}
.flowSteps b{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--chip);color:var(--muted);font-size:11px}
.flowSteps li.done b{background:var(--teal);color:#fff}
.flowSteps li.now{color:var(--ink)}
.flowSteps li.now b{background:var(--yellow);color:var(--ink)}
.tbadge{display:inline-grid;place-items:center;min-width:19px;height:19px;padding:0 5px;margin-left:7px;border-radius:999px;background:var(--chip);color:var(--muted);font:800 11px var(--body);vertical-align:1px}
[aria-selected="true"] .tbadge{background:var(--ink);color:#fff}
.tdot{display:inline-block;width:9px;height:9px;margin-left:7px;border-radius:50%;background:var(--orange);vertical-align:1px}
nav.tabs .sep{flex:none;width:1px;background:var(--line);margin:9px 8px;align-self:stretch}
@media (max-width:760px){.flow{grid-template-columns:1fr;padding:14px 16px}
  .flowSteps{flex-direction:row;flex-wrap:wrap;gap:4px 14px;border-top:1px solid var(--line);padding-top:10px}
  .flowSteps li span{display:none}.flowSteps li.now span{display:inline}}
`;
