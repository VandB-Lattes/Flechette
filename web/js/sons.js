// Bruitages de l'écran TV : de vrais fichiers MP3 (dossier web/sons), lus par la TV au moment de chaque animation.
// Pour remplacer un son par le vôtre : Staff › Réglages › Fichiers du site, « Son TV : … ». Le fichier déposé passe avant celui du site.
// Les navigateurs coupent le son tant que personne n'a touché la page : bouton « Activer le son » sur l'écran TV.
import { ASSETS_URL, ASSETS_DIR } from '../config.js';

export const SONS = ['appel', 'tick', 'go', 'pop', 'tada', '180', 'finish', 'victoire', 'finale', 'roue', 'roulement'];
let ctx = null, on = false;
const bufs = {};
const remote = (k) => `${ASSETS_URL}/${ASSETS_DIR.split('/').map(encodeURIComponent).join('/')}/son-${k}.mp3`;

async function fetchAudio(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok || !/audio|mpeg|octet/.test(r.headers.get('content-type') || '')) throw new Error('absent');
  return r.arrayBuffer();
}
/** Télécharge et décode tous les sons une fois pour toutes : ils partent sans délai au bon moment */
export async function load() {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  await Promise.all(SONS.map(async (k) => {
    let data = null;
    try { data = await fetchAudio(remote(k)); } catch { try { data = await fetchAudio(`sons/${k}.mp3`); } catch { return; } }
    try { bufs[k] = await ctx.decodeAudioData(data); } catch { /* fichier illisible */ }
  }));
}
/** À appeler lors d'un appui (souris, télécommande) : le navigateur autorise alors le son */
export function unlock() { try { ctx?.resume(); } catch {} on = true; }
export const enabled = () => on;
/** Joue un son, éventuellement avec un délai en secondes */
export function play(k, delay = 0, volume = 1) {
  if (!on || !ctx || !bufs[k]) return;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = bufs[k]; g.gain.value = volume;
  s.connect(g).connect(ctx.destination); s.start(ctx.currentTime + delay);
}
