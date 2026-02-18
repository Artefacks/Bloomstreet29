-- Admin RLS: allow league admins to update league (e.g. status) and to remove members

-- LEAGUES: admins of the league can update it (e.g. start/finish)
drop policy if exists "leagues_update_admin" on public.leagues;
create policy "leagues_update_admin"
  on public.leagues
  for update
  using (
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = leagues.id
        and lm.user_id = auth.uid()
        and lm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = leagues.id
        and lm.user_id = auth.uid()
        and lm.role = 'admin'
    )
  );

-- LEAGUE_MEMBERS: admins of the league can delete any member (e.g. remove player)
drop policy if exists "league_members_delete_admin" on public.league_members;
create policy "league_members_delete_admin"
  on public.league_members
  for delete
  using (
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = league_members.league_id
        and lm.user_id = auth.uid()
        and lm.role = 'admin'
    )
  );
