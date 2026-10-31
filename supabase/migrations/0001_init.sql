-- BlogCraft Studio schema: workspaces (tenants), projects, sessions, research and usage.
-- Every content table is scoped by tenant_id and guarded by row level security,
-- so the browser can talk to Supabase directly with the anon key.

create extension if not exists pgcrypto;

-- Workspaces ---------------------------------------------------------------

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_members_user_idx on public.tenant_members (user_id);

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null,
  display_name       text,
  avatar_url         text,
  current_tenant_id  uuid references public.tenants (id) on delete set null,
  preferences        jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Blog generation ----------------------------------------------------------

create table public.projects (
  id                 text primary key,
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  description        text not null default '',
  target_audience    text not null default '',
  tone               text not null default '',
  target_word_count  integer not null default 1500,
  tags               text[] not null default '{}',
  reference_urls     text[] not null default '{}',
  steps              jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index projects_tenant_idx on public.projects (tenant_id, updated_at desc);

create table public.sessions (
  id                  text primary key,
  project_id          text not null references public.projects (id) on delete cascade,
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  user_input          text not null default '',
  status              text not null default 'idle'
                        check (status in ('idle', 'running', 'paused', 'completed', 'failed')),
  current_step_index  integer not null default 0,
  step_outputs        jsonb not null default '{}'::jsonb,
  chat_messages       jsonb not null default '[]'::jsonb,
  research            jsonb,
  final_blog          text,
  total_tokens        jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index sessions_project_idx on public.sessions (project_id, updated_at desc);
create index sessions_tenant_idx on public.sessions (tenant_id);

-- One row per web research run. Kept separately from sessions so research can be
-- audited (which sources backed which blog) and reused for related topics later.
create table public.research_runs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  project_id       text references public.projects (id) on delete set null,
  session_id       text,
  topic            text not null,
  search_queries   text[] not null default '{}',
  reference_urls   text[] not null default '{}',
  brief            text not null,
  style_notes      text,
  sources          jsonb not null default '[]'::jsonb,
  model            text not null,
  total_tokens     integer,
  created_at       timestamptz not null default now()
);
create index research_runs_tenant_idx on public.research_runs (tenant_id, created_at desc);
create index research_runs_topic_idx on public.research_runs using gin (to_tsvector('english', topic));

create table public.usage_records (
  id                  text primary key,
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  project_id          text not null,
  project_name        text not null,
  date                date not null,
  "timestamp"         timestamptz not null,
  prompt_tokens       integer not null default 0,
  candidates_tokens   integer not null default 0,
  total_tokens        integer not null default 0,
  estimated_cost_usd  numeric(12, 6) not null default 0,
  session_topic       text,
  steps_completed     integer
);
create index usage_records_tenant_idx on public.usage_records (tenant_id, "timestamp" desc);

-- updated_at maintenance -----------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- Access helpers -------------------------------------------------------------
-- security definer so policies on tenant_members can call it without recursing.

create or replace function public.is_tenant_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = tid and user_id = auth.uid()
  );
$$;

create or replace function public.tenant_role(tid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.tenant_members
  where tenant_id = tid and user_id = auth.uid();
$$;

-- Creates a workspace, makes the caller its owner and switches them to it.
create or replace function public.create_tenant(tenant_name text) returns public.tenants
language plpgsql security definer set search_path = public as $$
declare
  t public.tenants;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.tenants (name, owner_id)
  values (coalesce(nullif(trim(tenant_name), ''), 'New Workspace'), auth.uid())
  returning * into t;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (t.id, auth.uid(), 'owner');

  update public.profiles set current_tenant_id = t.id where id = auth.uid();
  return t;
end;
$$;

-- New sign-ups get a profile and a personal workspace automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  display text := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );
  tid uuid;
begin
  insert into public.tenants (name, owner_id)
  values (
    coalesce(nullif(new.raw_user_meta_data ->> 'workspace_name', ''), display || '''s Workspace'),
    new.id
  )
  returning id into tid;

  insert into public.tenant_members (tenant_id, user_id, role) values (tid, new.id, 'owner');

  insert into public.profiles (id, email, display_name, avatar_url, current_tenant_id)
  values (new.id, new.email, display, new.raw_user_meta_data ->> 'avatar_url', tid);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security -----------------------------------------------------------

alter table public.tenants        enable row level security;
alter table public.tenant_members enable row level security;
alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.sessions       enable row level security;
alter table public.research_runs  enable row level security;
alter table public.usage_records  enable row level security;

create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and (current_tenant_id is null or public.is_tenant_member(current_tenant_id)));

create policy "members read tenant"  on public.tenants for select using (public.is_tenant_member(id));
create policy "admins update tenant" on public.tenants for update
  using (public.tenant_role(id) in ('owner', 'admin'));
create policy "owner deletes tenant" on public.tenants for delete using (owner_id = auth.uid());

create policy "members read membership" on public.tenant_members for select
  using (public.is_tenant_member(tenant_id));
create policy "admins manage membership" on public.tenant_members for all
  using (public.tenant_role(tenant_id) in ('owner', 'admin'))
  with check (public.tenant_role(tenant_id) in ('owner', 'admin') and role <> 'owner');

create policy "members use projects" on public.projects for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "members use sessions" on public.sessions for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "members read research" on public.research_runs for select
  using (public.is_tenant_member(tenant_id));
create policy "members add research" on public.research_runs for insert
  with check (public.is_tenant_member(tenant_id) and user_id = auth.uid());

create policy "members read usage" on public.usage_records for select
  using (public.is_tenant_member(tenant_id));
create policy "members add usage" on public.usage_records for insert
  with check (public.is_tenant_member(tenant_id) and user_id = auth.uid());

revoke execute on function public.create_tenant(text) from anon;
