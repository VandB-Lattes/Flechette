// Charge les fichiers hébergés dans Supabase Storage (bucket « assets ») et l'illustration de l'en-tête.
import { ASSETS_URL, LOGO_PATH } from '../config.js';
import { DART_ART } from './art.js';

export const assetUrl = (name) => `${ASSETS_URL}/${name.split('/').map(encodeURIComponent).join('/')}`;

document.querySelectorAll('[data-asset]').forEach((el) => { el.src = assetUrl(el.dataset.asset === 'logo' ? LOGO_PATH : el.dataset.asset); });
const art = document.getElementById('art');
if (art) {
  art.innerHTML = DART_ART;
  // taille fixée directement sur l'image : petite sur téléphone, même si une ancienne feuille de style est encore en mémoire
  const svg = art.firstElementChild;
  if (svg) Object.assign(svg.style, { width: 'clamp(44px, 12vw, 150px)', height: 'auto', display: 'block' });
}
