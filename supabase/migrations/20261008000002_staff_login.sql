-- ============================================================
-- Connexion du staff par identifiant et mot de passe (sans e-mail)
-- Les comptes se créent depuis l'espace staff (Réglages › Identifiants staff).
-- Le tout premier identifiant se crée sur la page staff tant qu'aucun compte n'existe.
-- ============================================================

create table public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  login text not null unique check (login ~ '^[a-z0-9._-]{3,30}$'),
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login timestamptz
);
alter table public.staff_accounts enable row level security;   -- aucune politique : accès par les fonctions ci-dessous

-- Chaque appareil connecté est rattaché à un identifiant : supprimer l'identifiant déconnecte ses appareils
alter table public.staff_devices add column account_id uuid references public.staff_accounts(id) on delete cascade;
-- Les appareils ouverts sans mot de passe (version précédente) doivent maintenant se connecter
update public.staff_devices set revoked_at = now() where account_id is null and revoked_at is null;

-- Anciennes façons d'ouvrir l'espace staff (lien avec clé, ouverture directe) : supprimées,
-- quelle que soit la version installée auparavant
drop function if exists public.join_staff(text);
drop function if exists public.join_staff(text, text);
drop function if exists public.create_staff_invite();
drop function if exists public.revoke_staff_device(uuid);
drop table if exists public.staff_invites;

-- Faut-il créer le premier identifiant ?
create or replace function public.staff_setup_needed() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.staff_accounts);
$$;

-- Connexion : vérifie l'identifiant et le mot de passe, puis autorise la session de cet appareil
create or replace function public.staff_login(p_login text, p_password text, p_device text) returns json
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if auth.uid() is null then raise exception 'Session manquante'; end if;
  select * into a from public.staff_accounts where login = lower(trim(p_login));
  if not found or a.password_hash <> extensions.crypt(coalesce(p_password, ''), a.password_hash) then
    perform pg_sleep(1);   -- freine les essais au hasard
    raise exception 'Identifiant ou mot de passe incorrect';
  end if;
  update public.staff_accounts set last_login = now() where id = a.id;
  insert into public.staff_devices (user_id, name, account_id) values (auth.uid(), left(coalesce(nullif(trim(p_device), ''), 'Appareil'), 40), a.id)
    on conflict (user_id) do update set account_id = excluded.account_id, revoked_at = null, last_seen = now();
  return json_build_object('login', a.login);
end $$;

-- Déconnexion de cet appareil
create or replace function public.staff_logout() returns void
language sql security definer set search_path = public as $$
  update public.staff_devices set revoked_at = now() where user_id = auth.uid();
$$;

-- Ouverture de l'espace staff : renvoie aussi l'identifiant connecté
create or replace function public.staff_hello() returns json
language plpgsql security definer set search_path = public as $$
declare d record; a record;
begin
  update public.staff_devices set last_seen = now() where user_id = auth.uid() and revoked_at is null and account_id is not null returning * into d;
  if not found then return null; end if;
  select login into a from public.staff_accounts where id = d.account_id;
  return json_build_object('name', d.name, 'since', d.created_at, 'login', a.login, 'account_id', d.account_id);
end $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_devices where user_id = auth.uid() and revoked_at is null and account_id is not null);
$$;

-- Créer un identifiant : réservé au staff connecté, sauf pour le tout premier
create or replace function public.create_staff_account(p_login text, p_password text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; l text := lower(trim(coalesce(p_login, '')));
begin
  lock table public.staff_accounts in exclusive mode;   -- un seul « premier identifiant » possible
  if exists (select 1 from public.staff_accounts) and not public.is_staff() then raise exception 'Réservé au staff'; end if;
  if l !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Identifiant : 3 à 30 caractères, lettres sans accent, chiffres, point, tiret'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Mot de passe : 6 caractères minimum'; end if;
  if exists (select 1 from public.staff_accounts where login = l) then raise exception 'Cet identifiant existe déjà'; end if;
  insert into public.staff_accounts (login, password_hash) values (l, extensions.crypt(p_password, extensions.gen_salt('bf'))) returning id into v;
  return v;
end $$;

create or replace function public.set_staff_password(p_account uuid, p_password text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé au staff'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Mot de passe : 6 caractères minimum'; end if;
  update public.staff_accounts set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = p_account;
end $$;

create or replace function public.delete_staff_account(p_account uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé au staff'; end if;
  if (select count(*) from public.staff_accounts) <= 1 then raise exception 'Impossible de supprimer le dernier identifiant'; end if;
  delete from public.staff_accounts where id = p_account;
end $$;

create or replace function public.list_staff_accounts() returns table (id uuid, login text, created_at timestamptz, last_login timestamptz, devices int)
language sql stable security definer set search_path = public as $$
  select a.id, a.login, a.created_at, a.last_login,
         (select count(*)::int from public.staff_devices d where d.account_id = a.id and d.revoked_at is null)
  from public.staff_accounts a where public.is_staff() order by a.login;
$$;

revoke execute on function public.staff_login, public.staff_logout, public.create_staff_account, public.set_staff_password, public.delete_staff_account, public.list_staff_accounts from public, anon;
grant execute on function public.staff_login, public.staff_logout, public.create_staff_account, public.set_staff_password, public.delete_staff_account, public.list_staff_accounts to authenticated;
grant execute on function public.staff_setup_needed to anon, authenticated;
