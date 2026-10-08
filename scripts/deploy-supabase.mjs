// Déploiement de la base Supabase depuis GitHub Actions, sans SQL à exécuter à la main.
// Utilise l'API de gestion Supabase avec le jeton SUPABASE_ACCESS_TOKEN (secret GitHub) :
//   1. autorise les connexions anonymes (appareils du staff) et coupe les e-mails d'authentification ;
//   2. applique les fichiers de supabase/migrations qui ne l'ont pas encore été ;
//   3. met à jour les identifiants du staff listés dans le secret ACCES_STAFF (voir ACCES_STAFF.md) ;
//   4. écrit la clé publique « anon » dans web/config.js pour la publication du site.
import fs from 'node:fs';
import path from 'node:path';

const REF = process.env.PROJECT_REF || 'ifjiysdhxmidiswcsiuq';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (!TOKEN) { console.log('::error::Secret GitHub SUPABASE_ACCESS_TOKEN manquant (voir README, étape 2).'); process.exit(1); }

async function api(method, p, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}${p}`, {
    method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}
const sql = async (query) => {
  const r = await api('POST', '/database/query', { query });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`);
  return r.data;
};

// 1. Authentification : sessions anonymes pour les appareils du staff, aucun e-mail
{
  const r = await api('PATCH', '/config/auth', { external_anonymous_users_enabled: true, external_email_enabled: false });
  console.log(r.ok ? '✓ Connexions anonymes autorisées, connexion par e-mail désactivée' : `::warning::Réglage auth non appliqué (${r.status}) : ${JSON.stringify(r.data)}`);
}

// 2. Migrations
const files = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
let applied = null;
const list = await api('GET', '/database/migrations');
if (list.ok && Array.isArray(list.data)) applied = new Set(list.data.map((m) => m.name));
// suivi de secours dans un schéma privé si la liste des migrations n'est pas disponible
if (!applied) {
  await sql('create schema if not exists deploy; create table if not exists deploy.migrations (name text primary key, applied_at timestamptz default now());');
  applied = new Set((await sql('select name from deploy.migrations')).map((r) => r.name));
}
for (const f of files) {
  const name = f.replace(/\.sql$/, '');
  if (applied.has(name)) { console.log(`· ${name} déjà appliquée`); continue; }
  const query = fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8');
  if (list.ok) {
    const r = await api('POST', '/database/migrations', { name, query });
    if (!r.ok) throw new Error(`Migration ${name} refusée (${r.status}) : ${JSON.stringify(r.data)}`);
  } else {
    await sql(`begin;\n${query}\n;insert into deploy.migrations (name) values ('${name.replace(/'/g, "''")}');\ncommit;`);
  }
  console.log(`✓ ${name} appliquée`);
}

// 3. Identifiants du staff (secret GitHub ACCES_STAFF, une ligne « identifiant : mot de passe » par personne)
const ACCES = process.env.ACCES_STAFF || '';
if (ACCES.trim()) {
  const rows = [];
  for (const [i, raw] of ACCES.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const k = line.indexOf(':');
    const login = (k < 0 ? '' : line.slice(0, k)).trim().toLowerCase(), pw = k < 0 ? '' : line.slice(k + 1).trim();
    if (!/^[a-z0-9._-]{3,30}$/.test(login)) throw new Error(`ACCES_STAFF, ligne ${i + 1} : identifiant invalide (3 à 30 caractères : lettres sans accent, chiffres, point, tiret).`);
    if (pw.length < 6) throw new Error(`ACCES_STAFF, ligne ${i + 1} : mot de passe trop court pour « ${login} » (6 caractères minimum).`);
    rows.push([login, pw]);
  }
  if (!rows.length) throw new Error('ACCES_STAFF ne contient aucun identifiant.');
  const q = (x) => `'${x.replace(/'/g, "''")}'`;
  const values = rows.map(([l, p]) => `(${q(l)}, ${q(p)})`).join(', ');
  await sql(`with src(login, pw) as (values ${values})
    insert into public.staff_accounts (login, password_hash)
      select login, extensions.crypt(pw, extensions.gen_salt('bf')) from src
    on conflict (login) do update set password_hash = excluded.password_hash;
    delete from public.staff_accounts where login not in (${rows.map(([l]) => q(l)).join(', ')});`);
  console.log(`✓ Accès staff : ${rows.length} identifiant(s) à jour (${rows.map(([l]) => l).join(', ')}). Les autres identifiants sont supprimés.`);
} else console.log('· Pas de secret ACCES_STAFF : les identifiants se gèrent dans l’espace staff (Réglages › Accès staff).');

// 4. Clé publique pour le site
const keys = await api('GET', '/api-keys');
const anon = Array.isArray(keys.data) ? keys.data.find((k) => k.name === 'anon' && k.api_key) : null;
if (!anon) throw new Error(`Clé anon introuvable (${keys.status}).`);
const cfg = path.join(root, 'web/config.js');
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('__SUPABASE_ANON_KEY__', anon.api_key));
console.log('✓ Clé publique écrite dans web/config.js');
