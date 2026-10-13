-- Correction de l'alerte Supabase « Security Definer View » (public_teams, season_team_standings, season_player_standings).
-- Ces vues lisaient les tables protégées avec les droits de leur créateur. Elles passent en « security_invoker » :
-- elles s'exécutent avec les droits de la personne qui les lit. Pour que le public voie toujours les noms d'équipe
-- et les classements (mais jamais les numéros de téléphone), elles s'appuient sur des fonctions placées dans un schéma
-- privé, non exposé par l'API, qui ne renvoient que ces colonnes.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.public_teams() returns table (registration_id uuid, contest_id uuid, status text, present boolean, created_at timestamptz, team_name text, captain_name text, captain_level text, mate_name text, mate_level text)
language sql stable security definer set search_path = public as $$
select r.id as registration_id, r.contest_id, r.status, r.present, r.created_at,
       t.name as team_name,
       coalesce(nullif(c.nickname,''), c.first_name) as captain_name, c.level as captain_level,
       coalesce(nullif(m.nickname,''), m.first_name) as mate_name, m.level as mate_level
from public.registrations r
join public.teams t on t.id = r.team_id
join public.players c on c.id = t.captain_id
left join public.players m on m.id = t.mate_id
join public.contests k on k.id = r.contest_id
where r.status <> 'annulee' and k.status <> 'brouillon'
$$;
revoke all on function private.public_teams() from public;
grant execute on function private.public_teams() to anon, authenticated, service_role;

create or replace view public.public_teams with (security_invoker = true) as
  select * from private.public_teams();
grant select on public.public_teams to anon, authenticated;

create or replace function private.season_team_standings() returns table (season_id uuid, team_key text, team_name text, points int, wins int, contests int)
language sql stable security definer set search_path = public as $$
select s.id as season_id, lower(t.name) as team_key, max(t.name) as team_name,
       sum(res.points)::int as points, sum(res.wins)::int as wins, count(*)::int as contests
from public.results res
join public.registrations r on r.id = res.registration_id
join public.teams t on t.id = r.team_id
join public.contests k on k.id = res.contest_id
join public.seasons s on s.id = k.season_id
group by s.id, lower(t.name)
$$;
revoke all on function private.season_team_standings() from public;
grant execute on function private.season_team_standings() to anon, authenticated, service_role;

create or replace view public.season_team_standings with (security_invoker = true) as
  select * from private.season_team_standings();
grant select on public.season_team_standings to anon, authenticated;

create or replace function private.season_player_standings() returns table (season_id uuid, player_key text, player_name text, points int, wins int, contests int)
language sql stable security definer set search_path = public as $$
with base as (
  select k.season_id, p.id as pid, coalesce(nullif(p.nickname,''), p.first_name) as name, res.points, res.wins
  from public.results res
  join public.registrations r on r.id = res.registration_id
  join public.teams t on t.id = r.team_id
  join public.players p on p.id in (t.captain_id, t.mate_id)
  join public.contests k on k.id = res.contest_id
  where p.erased_at is null
), weekly as (
  select distinct on (week_start, game) week_start, game, player_name, score from public.records
  where week_start < date_trunc('week', now() at time zone 'Europe/Paris')::date
  order by week_start, game, score desc
)
select season_id, lower(name) as player_key, max(name) as player_name, sum(points)::int as points, sum(wins)::int as wins, count(*)::int as contests
from (
  select season_id, name, points, wins from base
  union all
  select s.id, w.player_name, (s.points->>'rec')::int, 0 from weekly w join public.seasons s on w.week_start between s.starts_on and s.ends_on
) x group by season_id, lower(name)
$$;
revoke all on function private.season_player_standings() from public;
grant execute on function private.season_player_standings() to anon, authenticated, service_role;

create or replace view public.season_player_standings with (security_invoker = true) as
  select * from private.season_player_standings();
grant select on public.season_player_standings to anon, authenticated;
