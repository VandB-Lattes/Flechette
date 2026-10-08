-- Inscription par les joueurs : le nom de l'équipe devient obligatoire (au comptoir, le staff peut toujours le laisser vide).
create or replace function public.register_team(
  p_contest uuid, p_team_name text, p_captain text, p_phone text,
  p_captain_level text, p_mate text, p_mate_level text, p_adult boolean,
  p_source text default 'en_ligne'
) returns table (registration_id uuid, status text, cancel_token uuid, pin text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare k record; n_conf int; v_cap uuid; v_mate uuid; v_team uuid; v_name text; v_status text; v_reg record; v_now timestamp; v_phone text; v_last text;
begin
  if not p_adult then raise exception 'Le concours est réservé aux majeurs'; end if;
  if coalesce(trim(p_captain),'') = '' then raise exception 'Prénom du capitaine manquant'; end if;
  if p_source = 'sur_place' and not public.is_staff() then raise exception 'Réservé au staff'; end if;
  v_phone := public.norm_phone(p_phone);
  if v_phone is not null and v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Numéro de téléphone invalide'; end if;
  if v_phone is null and p_source <> 'sur_place' then raise exception 'Indiquez votre numéro de téléphone'; end if;
  if coalesce(trim(p_team_name), '') = '' and p_source <> 'sur_place' then raise exception 'Indiquez le nom de votre équipe'; end if;
  if char_length(trim(coalesce(p_team_name, ''))) > 30 then raise exception 'Nom d''équipe : 30 caractères maximum'; end if;

  select * into k from public.contests where id = p_contest for update;   -- verrou : pas de surréservation
  if not found or k.status <> 'ouvert' then raise exception 'Les inscriptions ne sont pas ouvertes pour ce concours'; end if;
  v_now := now() at time zone 'Europe/Paris';
  if not public.is_staff() and v_now > (k.date + k.deadline_time) then raise exception 'Les inscriptions en ligne sont closes'; end if;

  -- le numéro de téléphone identifie le joueur d'un concours à l'autre : même fiche, même nom d'équipe par défaut
  if v_phone is not null then
    select id into v_cap from public.players where phone = v_phone and erased_at is null order by created_at desc limit 1;
    if v_cap is not null then
      select t.name into v_last from public.teams t join public.registrations r on r.team_id = t.id
        where t.captain_id = v_cap and t.name not like '% (test)' and t.name not like 'Solo · %' order by r.created_at desc limit 1;
    end if;
  end if;
  v_name := coalesce(nullif(trim(p_team_name),''), v_last, case when coalesce(trim(p_mate),'') = '' then 'Solo · ' || trim(p_captain) else trim(p_captain) || ' & ' || trim(p_mate) end);
  if exists (select 1 from public.registrations r join public.teams t on t.id = r.team_id
             where r.contest_id = p_contest and r.status <> 'annulee' and lower(t.name) = lower(v_name)) then
    raise exception 'Ce nom d''équipe est déjà pris pour ce concours';
  end if;
  -- un nom d'équipe appartient au numéro qui l'a utilisé en premier (suivi des scores sur la saison)
  if v_phone is not null and exists (select 1 from public.teams t join public.players p on p.id = t.captain_id
      where lower(t.name) = lower(v_name) and p.phone is not null and p.phone <> v_phone and p.erased_at is null and t.name not like 'Solo · %') then
    raise exception 'Ce nom d''équipe est déjà utilisé par une autre équipe (autre numéro de téléphone). Choisissez-en un autre.';
  end if;
  if v_phone is not null and exists (select 1 from public.registrations r join public.teams t on t.id = r.team_id join public.players p on p.id = t.captain_id
      where r.contest_id = p_contest and r.status <> 'annulee' and p.phone = v_phone) then
    raise exception 'Ce numéro a déjà inscrit une équipe à ce concours';
  end if;

  if v_cap is null then
    insert into public.players (first_name, phone, level, adult_confirmed)
      values (trim(p_captain), v_phone, coalesce(p_captain_level,'occasionnel'), true)
      returning id into v_cap;
  else
    update public.players set first_name = trim(p_captain), level = coalesce(p_captain_level, level), adult_confirmed = true where id = v_cap;
  end if;
  if coalesce(trim(p_mate),'') <> '' then
    insert into public.players (first_name, level, adult_confirmed) values (trim(p_mate), coalesce(p_mate_level,'occasionnel'), true) returning id into v_mate;
  end if;
  insert into public.teams (name, captain_id, mate_id) values (v_name, v_cap, v_mate) returning id into v_team;

  select count(*) into n_conf from public.registrations where contest_id = p_contest and registrations.status = 'confirmee';
  v_status := case when n_conf >= k.max_teams then 'attente' else 'confirmee' end;
  insert into public.registrations (contest_id, team_id, status, source, was_waitlisted)
    values (p_contest, v_team, v_status, coalesce(p_source,'en_ligne'), v_status = 'attente')
    returning * into v_reg;
  -- pas de code d'équipe en liste d'attente : il n'est donné qu'une fois la place confirmée
  return query select v_reg.id, v_reg.status, v_reg.cancel_token, case when v_reg.status = 'confirmee' then v_reg.pin end;
end $$;
