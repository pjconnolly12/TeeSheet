create extension if not exists "pgcrypto";

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  tee_time timestamptz not null,
  max_players integer not null check (max_players > 0 and max_players <= 4),
  location text not null,
  holes integer not null check (holes in (9, 18, 27, 36)),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  email text not null,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.round_players
  drop column if exists name;

create table if not exists public.distribution_list_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.round_invitations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.round_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  promoted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists round_players_round_id_email_idx
  on public.round_players (round_id, lower(email));

create unique index if not exists distribution_list_entries_owner_id_email_idx
  on public.distribution_list_entries (owner_id, lower(email));

create unique index if not exists round_invitations_round_id_email_idx
  on public.round_invitations (round_id, lower(email));

create unique index if not exists round_waitlist_entries_active_email_idx
  on public.round_waitlist_entries (round_id, lower(email))
  where promoted_at is null;

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert, update, delete on public.rounds to authenticated;
grant select, insert, update, delete on public.round_players to authenticated;
grant select, insert, update, delete on public.distribution_list_entries to authenticated;
grant select, insert, update, delete on public.round_invitations to authenticated;
grant select, insert, update, delete on public.round_waitlist_entries to authenticated;

grant select, insert, update, delete on public.rounds to service_role;
grant select, insert, update, delete on public.round_players to service_role;
grant select, insert, update, delete on public.distribution_list_entries to service_role;
grant select, insert, update, delete on public.round_invitations to service_role;
grant select, insert, update, delete on public.round_waitlist_entries to service_role;

alter table public.rounds enable row level security;
alter table public.round_players enable row level security;
alter table public.distribution_list_entries enable row level security;
alter table public.round_invitations enable row level security;
alter table public.round_waitlist_entries enable row level security;

create or replace function public.enforce_round_capacity()
returns trigger
language plpgsql
as $$
declare
  round_capacity integer;
  assigned_players integer;
begin
  select max_players into round_capacity
  from public.rounds
  where id = new.round_id;

  if round_capacity is null then
    raise exception 'Round not found.';
  end if;

  select count(*) into assigned_players
  from public.round_players
  where round_id = new.round_id;

  if assigned_players >= round_capacity then
    raise exception 'Round is already full.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_waitlist_rules()
returns trigger
language plpgsql
as $$
declare
  round_capacity integer;
  assigned_players integer;
begin
  select max_players into round_capacity
  from public.rounds
  where id = new.round_id;

  if round_capacity is null then
    raise exception 'Round not found.';
  end if;

  select count(*) into assigned_players
  from public.round_players
  where round_id = new.round_id;

  if assigned_players < round_capacity then
    raise exception 'Round still has open spots.';
  end if;

  if exists (
    select 1
    from public.round_players
    where round_id = new.round_id
      and lower(email) = lower(new.email)
  ) then
    raise exception 'Golfer is already in this round.';
  end if;

  return new;
end;
$$;

create or replace function public.user_can_view_round(target_round_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rounds
    where rounds.id = target_round_id
      and (
        rounds.created_by = auth.uid()
        or exists (
          select 1
          from public.round_players
          where round_players.round_id = rounds.id
            and lower(round_players.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        or exists (
          select 1
          from public.round_invitations
          where round_invitations.round_id = rounds.id
            and lower(round_invitations.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
  );
$$;

grant execute on function public.user_can_view_round(uuid) to authenticated;
grant execute on function public.user_can_view_round(uuid) to service_role;

drop trigger if exists round_capacity_guard on public.round_players;
create trigger round_capacity_guard
before insert on public.round_players
for each row execute function public.enforce_round_capacity();

drop trigger if exists round_waitlist_guard on public.round_waitlist_entries;
create trigger round_waitlist_guard
before insert on public.round_waitlist_entries
for each row execute function public.enforce_waitlist_rules();

drop policy if exists "Authenticated users can view rounds" on public.rounds;
drop policy if exists "Users can view rounds they created or were invited to" on public.rounds;
drop policy if exists "Users can create their own rounds" on public.rounds;
drop policy if exists "Users can update their own rounds" on public.rounds;
drop policy if exists "Users can delete their own rounds" on public.rounds;

create policy "Users can view rounds they created or were invited to"
on public.rounds
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.round_players
    where round_players.round_id = rounds.id
      and lower(round_players.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or exists (
    select 1
    from public.round_invitations
    where round_invitations.round_id = rounds.id
      and lower(round_invitations.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "Users can create their own rounds"
on public.rounds
for insert
with check (auth.uid() = created_by);

create policy "Users can update their own rounds"
on public.rounds
for update
using (auth.uid() = created_by);

create policy "Users can delete their own rounds"
on public.rounds
for delete
using (auth.uid() = created_by);

drop policy if exists "Authenticated users can view players on rounds" on public.round_players;
drop policy if exists "Users can view players on visible rounds" on public.round_players;
drop policy if exists "Users can add players to their rounds" on public.round_players;
drop policy if exists "Users can update players on their rounds" on public.round_players;
drop policy if exists "Users can delete players on their rounds" on public.round_players;

create policy "Users can view players on visible rounds"
on public.round_players
for select
using (public.user_can_view_round(round_id));

create policy "Users can add players to their rounds"
on public.round_players
for insert
with check (
  exists (
    select 1 from public.rounds
    where rounds.id = round_players.round_id
      and rounds.created_by = auth.uid()
  )
  or (
    lower(round_players.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and public.user_can_view_round(round_players.round_id)
  )
);

create policy "Users can update players on their rounds"
on public.round_players
for update
using (
  exists (
    select 1 from public.rounds
    where rounds.id = round_players.round_id
      and rounds.created_by = auth.uid()
  )
);

create policy "Users can delete players on their rounds"
on public.round_players
for delete
using (
  exists (
    select 1 from public.rounds
    where rounds.id = round_players.round_id
      and rounds.created_by = auth.uid()
  )
);

drop policy if exists "Owners can view their distribution list" on public.distribution_list_entries;
drop policy if exists "Owners can create distribution list entries" on public.distribution_list_entries;
drop policy if exists "Owners can update their distribution list" on public.distribution_list_entries;
drop policy if exists "Owners can delete their distribution list" on public.distribution_list_entries;

create policy "Owners can view their distribution list"
on public.distribution_list_entries
for select
using (auth.uid() = owner_id);

create policy "Owners can create distribution list entries"
on public.distribution_list_entries
for insert
with check (auth.uid() = owner_id);

create policy "Owners can update their distribution list"
on public.distribution_list_entries
for update
using (auth.uid() = owner_id);

create policy "Owners can delete their distribution list"
on public.distribution_list_entries
for delete
using (auth.uid() = owner_id);

drop policy if exists "Users can view invitations on visible rounds" on public.round_invitations;
drop policy if exists "Round owners can create invitations" on public.round_invitations;
drop policy if exists "Round owners can delete invitations" on public.round_invitations;

create policy "Users can view invitations on visible rounds"
on public.round_invitations
for select
using (public.user_can_view_round(round_id));

create policy "Round owners can create invitations"
on public.round_invitations
for insert
with check (
  exists (
    select 1 from public.rounds
    where rounds.id = round_invitations.round_id
      and rounds.created_by = auth.uid()
  )
);

create policy "Round owners can delete invitations"
on public.round_invitations
for delete
using (
  exists (
    select 1 from public.rounds
    where rounds.id = round_invitations.round_id
      and rounds.created_by = auth.uid()
  )
);

drop policy if exists "Authenticated users can view round waitlists" on public.round_waitlist_entries;
drop policy if exists "Users can view waitlists on visible rounds" on public.round_waitlist_entries;
drop policy if exists "Authenticated users can join round waitlists" on public.round_waitlist_entries;
drop policy if exists "Round owners can update waitlist entries" on public.round_waitlist_entries;
drop policy if exists "Round owners can delete waitlist entries" on public.round_waitlist_entries;

create policy "Users can view waitlists on visible rounds"
on public.round_waitlist_entries
for select
using (public.user_can_view_round(round_id));

create policy "Authenticated users can join round waitlists"
on public.round_waitlist_entries
for insert
with check (auth.role() = 'authenticated');

create policy "Round owners can update waitlist entries"
on public.round_waitlist_entries
for update
using (
  exists (
    select 1 from public.rounds
    where rounds.id = round_waitlist_entries.round_id
      and rounds.created_by = auth.uid()
  )
);

create policy "Round owners can delete waitlist entries"
on public.round_waitlist_entries
for delete
using (
  exists (
    select 1 from public.rounds
    where rounds.id = round_waitlist_entries.round_id
      and rounds.created_by = auth.uid()
  )
);
