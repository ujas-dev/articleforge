-- ArticleForge initial schema.
--
-- Idempotent (finding F26): every statement is guarded with `if not exists` /
-- `drop ... if exists`, the template seed has a real unique constraint to
-- conflict on, and the whole file runs in a single transaction so a failure
-- leaves the database untouched.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  site_name text not null default '',
  avatar_url text not null default '',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  structure_json jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
-- Required so the seed below can use `on conflict (name) do nothing`.
create unique index if not exists templates_name_unique on public.templates (name);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  keyword text not null default '',
  content_html text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  template_id uuid references public.templates(id) on delete set null,
  seo_json jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists articles_slug_published_unique on public.articles (slug) where status = 'published';
create index if not exists articles_author_idx on public.articles (author_id);
create index if not exists articles_status_idx on public.articles (status);

create table if not exists public.seo_strategies (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists seo_strategies_article_idx on public.seo_strategies (article_id);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles(id) on delete cascade,
  event_type text not null check (event_type in ('view','scroll_25','scroll_50','scroll_75','scroll_100')),
  referrer_host text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists analytics_article_idx on public.analytics_events (article_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.articles enable row level security;
alter table public.seo_strategies enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid());

drop policy if exists templates_select_all on public.templates;
create policy templates_select_all on public.templates for select using (true);
drop policy if exists templates_insert_own on public.templates;
create policy templates_insert_own on public.templates for insert with check (author_id = auth.uid());
drop policy if exists templates_update_own on public.templates;
create policy templates_update_own on public.templates for update using (author_id = auth.uid());
drop policy if exists templates_delete_own on public.templates;
create policy templates_delete_own on public.templates for delete using (author_id = auth.uid());

drop policy if exists articles_select_own on public.articles;
create policy articles_select_own on public.articles
  for select using (author_id = auth.uid() or (status = 'published' and deleted_at is null));
drop policy if exists articles_insert_own on public.articles;
create policy articles_insert_own on public.articles for insert with check (author_id = auth.uid());
drop policy if exists articles_update_own on public.articles;
create policy articles_update_own on public.articles for update using (author_id = auth.uid());
drop policy if exists articles_delete_own on public.articles;
create policy articles_delete_own on public.articles for delete using (author_id = auth.uid());

drop policy if exists seo_select_own on public.seo_strategies;
create policy seo_select_own on public.seo_strategies for select using (author_id = auth.uid());
drop policy if exists seo_insert_own on public.seo_strategies;
create policy seo_insert_own on public.seo_strategies for insert with check (author_id = auth.uid());
drop policy if exists seo_update_own on public.seo_strategies;
create policy seo_update_own on public.seo_strategies for update using (author_id = auth.uid());
drop policy if exists seo_delete_own on public.seo_strategies;
create policy seo_delete_own on public.seo_strategies for delete using (author_id = auth.uid());

drop policy if exists analytics_select_own on public.analytics_events;
create policy analytics_select_own on public.analytics_events for select using (
  exists (select 1 from public.articles a where a.id = analytics_events.article_id and a.author_id = auth.uid())
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, site_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Creator'), 'My ArticleForge')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at before update on public.articles
  for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Names must match BUILT_IN_TEMPLATES in src/lib/templates.ts: the editor
-- resolves a template slug to this row's id and stores it in articles.template_id.
insert into public.templates (name, description, structure_json, is_default) values
 ('How-To Guide', 'Step-by-step walkthrough', '[{"type":"h2","text":"Prerequisites"},{"type":"h2","text":"Step-by-Step Guide"},{"type":"h2","text":"Tips and Pitfalls"},{"type":"h2","text":"FAQ"}]', true),
 ('Listicle', 'Ranked list with quick picks', '[{"type":"h2","text":"Quick Picks"},{"type":"h2","text":"The Full List"},{"type":"h2","text":"How We Selected"},{"type":"h2","text":"FAQ"}]', false),
 ('Comparison', 'Side-by-side comparison', '[{"type":"h2","text":"Comparison Overview"},{"type":"h2","text":"Option A vs Option B"},{"type":"h2","text":"Which Should You Choose"},{"type":"h2","text":"FAQ"}]', false),
 ('Review', 'In-depth review with verdict', '[{"type":"h2","text":"First Impressions"},{"type":"h2","text":"Features and Performance"},{"type":"h2","text":"Pros and Cons"},{"type":"h2","text":"Verdict"},{"type":"h2","text":"FAQ"}]', false),
 ('FAQ', 'Question and answer format', '[{"type":"h2","text":"Top Questions"},{"type":"h2","text":"Deeper Answers"},{"type":"h2","text":"Still Unsure"}]', false)
on conflict (name) do nothing;

commit;
