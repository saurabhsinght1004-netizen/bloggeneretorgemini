-- Per-client writing/reference/QA rules, and stored QA reviews of generated articles.

create table public.guideline_profiles (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  name               text not null check (length(trim(name)) > 0),
  writing_rules      text not null default '',
  reference_rules    text not null default '',
  qa_checklist       text not null default '',
  score_scale        integer not null default 100 check (score_scale in (10, 100)),
  reference_style    text not null default 'harvard_short'
                       check (reference_style in ('harvard_short', 'harvard_full')),
  reference_count    integer not null default 5 check (reference_count between 1 and 30),
  reference_mix      text not null default '',
  allowed_domains    text[] not null default '{}',
  min_word_count     integer not null default 2400 check (min_word_count >= 0),
  cta                text not null default '',
  internal_links     text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index guideline_profiles_tenant_idx on public.guideline_profiles (tenant_id, name);

create trigger guideline_profiles_touch before update on public.guideline_profiles
  for each row execute function public.touch_updated_at();

alter table public.projects
  add column guideline_profile_id uuid references public.guideline_profiles (id) on delete set null;

-- Latest QA result for the session, so it shows again when the session is reopened.
alter table public.sessions add column qa_review jsonb;

create table public.qa_reviews (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  project_id          text references public.projects (id) on delete set null,
  session_id          text,
  guideline_profile_id uuid references public.guideline_profiles (id) on delete set null,
  article             text not null,
  review              text not null,
  verdict             text,
  score               numeric(5, 1),
  score_after         numeric(5, 1),
  score_scale         integer not null,
  model               text not null,
  total_tokens        integer,
  created_at          timestamptz not null default now()
);
create index qa_reviews_tenant_idx on public.qa_reviews (tenant_id, created_at desc);
create index qa_reviews_project_idx on public.qa_reviews (project_id, created_at desc);

alter table public.guideline_profiles enable row level security;
alter table public.qa_reviews enable row level security;

create policy "members use guideline profiles" on public.guideline_profiles for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "members read qa reviews" on public.qa_reviews for select
  using (public.is_tenant_member(tenant_id));
create policy "members add qa reviews" on public.qa_reviews for insert
  with check (public.is_tenant_member(tenant_id) and user_id = auth.uid());
