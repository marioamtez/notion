-- =========================================================
-- Zotion: Supabase Postgres schema
-- Paste once into the Supabase Dashboard -> SQL Editor -> Run.
-- =========================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------
-- documents
-- ---------------------------------------------------------
create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  title              text not null,
  is_archived        boolean not null default false,
  parent_document    uuid references public.documents(id) on delete set null,
  content            text,
  cover_image        text,
  icon               text,
  is_published       boolean not null default false,
  sort_order         integer,               -- was "order" in the old backend; renamed, reserved SQL word
  updated_at         timestamptz,
  is_favorite        boolean not null default false,
  editor_font        text,
  full_width         boolean not null default true,
  small_text         boolean not null default false,
  show_toc           boolean not null default true,
  notion_source_id   text unique,           -- multiple NULLs allowed; unique only when set
  created_at         timestamptz not null default now()
);

create index documents_user_idx          on public.documents (user_id);
create index documents_user_parent_idx   on public.documents (user_id, parent_document);
create index documents_user_archived_idx on public.documents (user_id, is_archived);

-- ---------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------
create table public.user_settings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  editor_font  text,
  focus_mode   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table public.documents     enable row level security;
alter table public.user_settings enable row level security;

create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using (auth.uid() = user_id);

-- Additional, separate permissive SELECT policy: published + non-archived
-- documents are readable by anyone (including anon), for the /preview route.
create policy "documents_select_published"
  on public.documents for select
  to anon, authenticated
  using (is_published = true and is_archived = false);

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "documents_update_own"
  on public.documents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "user_settings_owner_all"
  on public.user_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.documents to anon;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

-- ---------------------------------------------------------
-- RPCs: operations that aren't a single plain UPDATE
-- ---------------------------------------------------------

-- Recursively archives target_id and all its descendants in one transaction.
create or replace function public.archive_document(target_id uuid)
returns setof public.documents
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.documents where id = target_id and user_id = auth.uid()
  ) then
    raise exception 'Document not found or not authorized' using errcode = '42501';
  end if;

  return query
  with recursive descendants as (
    select id from public.documents where id = target_id
    union all
    select d.id
    from public.documents d
    join descendants desc_ on d.parent_document = desc_.id
    where d.user_id = auth.uid()
  )
  update public.documents
  set is_archived = true
  where id in (select id from descendants)
    and user_id = auth.uid()
  returning *;
end;
$$;

-- Recursively restores target_id and all its descendants; un-parents
-- target_id itself if its former parent is (still) archived.
create or replace function public.restore_document(target_id uuid)
returns setof public.documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_parent_archived boolean;
begin
  if not exists (
    select 1 from public.documents where id = target_id and user_id = auth.uid()
  ) then
    raise exception 'Document not found or not authorized' using errcode = '42501';
  end if;

  select parent_document into v_parent_id from public.documents where id = target_id;

  if v_parent_id is not null then
    select is_archived into v_parent_archived from public.documents where id = v_parent_id;
  end if;

  return query
  with recursive descendants as (
    select id from public.documents where id = target_id
    union all
    select d.id
    from public.documents d
    join descendants desc_ on d.parent_document = desc_.id
    where d.user_id = auth.uid()
  )
  update public.documents
  set is_archived = false,
      parent_document = case
        when id = target_id and coalesce(v_parent_archived, false)
          then null
        else parent_document
      end
  where id in (select id from descendants)
    and user_id = auth.uid()
  returning *;
end;
$$;

-- Bulk-applies a client-computed sibling order in one statement.
create or replace function public.reorder_documents(
  p_parent_document uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.documents d
  set sort_order = o.idx - 1
  from unnest(p_ordered_ids) with ordinality as o(id, idx)
  where d.id = o.id
    and d.user_id = auth.uid()
    and d.parent_document is not distinct from p_parent_document;
end;
$$;

-- Atomic favorite toggle.
create or replace function public.toggle_favorite(target_id uuid)
returns setof public.documents
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.documents
  set is_favorite = not is_favorite
  where id = target_id and user_id = auth.uid()
  returning *;
end;
$$;

revoke all on function public.archive_document(uuid)   from public;
revoke all on function public.restore_document(uuid)   from public;
revoke all on function public.reorder_documents(uuid, uuid[]) from public;
revoke all on function public.toggle_favorite(uuid)    from public;

grant execute on function public.archive_document(uuid)   to authenticated;
grant execute on function public.restore_document(uuid)   to authenticated;
grant execute on function public.reorder_documents(uuid, uuid[]) to authenticated;
grant execute on function public.toggle_favorite(uuid)    to authenticated;
