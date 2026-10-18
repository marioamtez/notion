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
  )
  update public.documents
  set is_archived = true
  where id in (select id from descendants)
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
  )
  update public.documents
  set is_archived = false,
      parent_document = case
        when id = target_id and coalesce(v_parent_archived, false) then null
        else parent_document
      end
  where id in (select id from descendants)
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
  if p_parent_document is not null
     and not public.can_access_document(p_parent_document, auth.uid()) then
    raise exception 'Not authorized to reorder documents in this parent' using errcode = '42501';
  end if;

  update public.documents d
  set sort_order = o.idx - 1
  from unnest(p_ordered_ids) with ordinality as o(id, idx)
  where d.id = o.id
    and d.parent_document is not distinct from p_parent_document
    and public.can_access_document(d.id, auth.uid());
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

-- =========================================================
-- Espacio personal + Pilas públicas: sharing/visibility
-- Paste this block once into the Supabase Dashboard -> SQL Editor -> Run.
-- Safe to re-run (idempotent: create or replace / drop-if-exists / defaults).
-- =========================================================

-- ---------------------------------------------------------
-- 1. New columns on documents
-- ---------------------------------------------------------
alter table public.documents
  add column if not exists space_type text not null default 'personal'
    check (space_type in ('personal', 'public')),
  add column if not exists is_shared boolean not null default false;

comment on column public.documents.space_type is
  'Only meaningful when parent_document is null (root docs). ''personal'' = owner-only (Espacio personal); ''public'' = visible to all authenticated users unless a nearer document_shares restriction applies. Ignored for non-root rows.';
comment on column public.documents.is_shared is
  'Denormalized: true iff this exact document has one or more rows in document_shares. Maintained by trigger document_shares_sync_is_shared. UI badge signal only -- visibility is enforced independently via can_view_document.';

-- ---------------------------------------------------------
-- 2. profiles (org user directory, for the "share with..." picker)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

grant select on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time backfill for users that already exist (safe to re-run).
insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (id) do update set email = excluded.email;

-- ---------------------------------------------------------
-- 3. document_shares
-- ---------------------------------------------------------
create table if not exists public.document_shares (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (document_id, user_id)
);

create index if not exists document_shares_document_idx on public.document_shares (document_id);
create index if not exists document_shares_user_idx     on public.document_shares (user_id);

alter table public.document_shares enable row level security;

drop policy if exists "document_shares_select" on public.document_shares;
create policy "document_shares_select"
  on public.document_shares for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.documents d
               where d.id = document_id and d.user_id = auth.uid())
  );

drop policy if exists "document_shares_insert_owner" on public.document_shares;
create policy "document_shares_insert_owner"
  on public.document_shares for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.documents d
                where d.id = document_id and d.user_id = auth.uid())
  );

drop policy if exists "document_shares_delete_owner" on public.document_shares;
create policy "document_shares_delete_owner"
  on public.document_shares for delete
  to authenticated
  using (
    exists (select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid())
  );

grant select, insert, delete on public.document_shares to authenticated;

-- ---------------------------------------------------------
-- 4. Visibility helpers ("nearest restricting ancestor" rule)
-- ---------------------------------------------------------
create or replace function public.can_view_document(doc_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select d.id, d.parent_document, d.space_type, 0 as depth
    from public.documents d
    where d.id = doc_id
    union all
    select p.id, p.parent_document, p.space_type, c.depth + 1
    from public.documents p
    join chain c on p.id = c.parent_document
    where c.depth < 500
  ),
  nearest_share_node as (
    select c.id
    from chain c
    where exists (select 1 from public.document_shares s where s.document_id = c.id)
    order by c.depth asc
    limit 1
  ),
  root as (
    select c.id, c.space_type
    from chain c
    where c.parent_document is null
    order by c.depth desc
    limit 1
  )
  select case
    when (select id from nearest_share_node) is not null then
      exists (
        select 1 from public.document_shares s
        where s.document_id = (select id from nearest_share_node)
          and s.user_id = uid
      )
      or exists (
        select 1 from public.documents d
        where d.id = (select id from nearest_share_node)
          and d.user_id = uid
      )
    else
      coalesce((select space_type from root) = 'public', false)
  end;
$$;

-- Owner-OR-view predicate, used for INSERT/UPDATE and the fixed RPCs below.
create or replace function public.can_access_document(doc_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.documents d where d.id = doc_id and d.user_id = uid)
      or public.can_view_document(doc_id, uid);
$$;

grant execute on function public.can_view_document(uuid, uuid)   to authenticated;
grant execute on function public.can_access_document(uuid, uuid) to authenticated;

-- ---------------------------------------------------------
-- 5. Updated documents RLS (additive -- existing policies untouched
--    except insert, which gains a parent-access check)
-- ---------------------------------------------------------
drop policy if exists "documents_select_shared_or_public" on public.documents;
create policy "documents_select_shared_or_public"
  on public.documents for select
  to authenticated
  using (
    auth.uid() <> user_id
    and public.can_view_document(id, auth.uid())
  );

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      parent_document is null
      or public.can_access_document(parent_document, auth.uid())
    )
  );

drop policy if exists "documents_update_shared" on public.documents;
create policy "documents_update_shared"
  on public.documents for update
  to authenticated
  using (public.can_view_document(id, auth.uid()))
  with check (public.can_view_document(id, auth.uid()));

-- Defense-in-depth: a collaborator (who now has generic UPDATE rights via
-- documents_update_shared) must not be able to reassign ownership, re-parent
-- a doc, or flip space_type -- only the owner can.
create or replace function public.prevent_collaborator_structural_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = OLD.user_id then
    return NEW;
  end if;
  if NEW.user_id is distinct from OLD.user_id
     or NEW.parent_document is distinct from OLD.parent_document
     or NEW.space_type is distinct from OLD.space_type then
    raise exception 'Only the document owner can change ownership, parent, or space type'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists documents_prevent_collaborator_structural_changes on public.documents;
create trigger documents_prevent_collaborator_structural_changes
  before update on public.documents
  for each row execute function public.prevent_collaborator_structural_changes();

-- ---------------------------------------------------------
-- 6. is_shared sync trigger (avoids N+1 queries for the sidebar badge)
-- ---------------------------------------------------------
create or replace function public.sync_document_is_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc_id uuid;
begin
  v_doc_id := coalesce(NEW.document_id, OLD.document_id);
  update public.documents
  set is_shared = exists (select 1 from public.document_shares where document_id = v_doc_id)
  where id = v_doc_id;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists document_shares_sync_is_shared on public.document_shares;
create trigger document_shares_sync_is_shared
  after insert or delete on public.document_shares
  for each row execute function public.sync_document_is_shared();

-- ---------------------------------------------------------
-- 7. convert_document_space_type RPC (the sidebar "convertir en pila
--    pública / espacio personal" toggle -- owner + root-only)
-- ---------------------------------------------------------
create or replace function public.convert_document_space_type(
  target_id uuid,
  new_space_type text
)
returns public.documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_doc public.documents;
begin
  if new_space_type not in ('personal', 'public') then
    raise exception 'Invalid space_type' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.documents
    where id = target_id and user_id = auth.uid() and parent_document is null
  ) then
    raise exception 'Document not found, not a root document, or not authorized'
      using errcode = '42501';
  end if;

  update public.documents
  set space_type = new_space_type
  where id = target_id
  returning * into v_doc;

  return v_doc;
end;
$$;

revoke all on function public.convert_document_space_type(uuid, text) from public;
grant execute on function public.convert_document_space_type(uuid, text) to authenticated;


-- =========================================================
-- Pilas públicas cerradas por defecto + mover páginas dentro
-- Paste this block once into the Supabase Dashboard -> SQL Editor -> Run.
-- Safe to re-run (idempotent).
-- =========================================================

comment on column public.documents.space_type is
  'Denormalized on EVERY row (not just roots): the effective space_type of this document''s root, kept in sync by the sync_space_type_from_parent / cascade_space_type_to_descendants triggers. ''personal'' can never be shared (document_shares insert is blocked); ''public'' can be shared via document_shares, but is NOT visible to anyone besides the owner until at least one document_shares grant exists somewhere in its ancestor chain.';

-- ---------------------------------------------------------
-- 9. space_type cascade: a document's space_type always mirrors its
--    parent's at the moment it's created or moved, and propagates down
--    to the whole subtree whenever it changes on an ancestor (root
--    conversion, or moving a subtree into/out of a pila).
-- ---------------------------------------------------------
create or replace function public.sync_space_type_from_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.parent_document is not null
     and (TG_OP = 'INSERT' or NEW.parent_document is distinct from OLD.parent_document) then
    select space_type into NEW.space_type
    from public.documents where id = NEW.parent_document;
  end if;
  return NEW;
end;
$$;

drop trigger if exists documents_sync_space_type_from_parent on public.documents;
create trigger documents_sync_space_type_from_parent
  before insert or update on public.documents
  for each row execute function public.sync_space_type_from_parent();

-- Re-guarded below: system-initiated cascades/backfills must bypass the
-- owner-only check, since they legitimately touch rows owned by other
-- users (e.g. a collaborator's page inside a moved/converted folder).
-- Uses a transaction-local setting so real client-driven updates from a
-- non-owner are still blocked exactly as before.
create or replace function public.prevent_collaborator_structural_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = OLD.user_id then
    return NEW;
  end if;
  if coalesce(current_setting('app.bypass_structural_guard', true), 'false') = 'true' then
    return NEW;
  end if;
  if NEW.user_id is distinct from OLD.user_id
     or NEW.parent_document is distinct from OLD.parent_document
     or NEW.space_type is distinct from OLD.space_type then
    raise exception 'Only the document owner can change ownership, parent, or space type'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

create or replace function public.cascade_space_type_to_descendants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.space_type is distinct from OLD.space_type
     or NEW.parent_document is distinct from OLD.parent_document then
    perform set_config('app.bypass_structural_guard', 'true', true);
    with recursive descendants as (
      select id from public.documents where parent_document = NEW.id
      union all
      select d.id
      from public.documents d
      join descendants desc_ on d.parent_document = desc_.id
    )
    update public.documents
    set space_type = NEW.space_type
    where id in (select id from descendants)
      and space_type is distinct from NEW.space_type;
    perform set_config('app.bypass_structural_guard', 'false', true);
  end if;
  return NEW;
end;
$$;

drop trigger if exists documents_cascade_space_type on public.documents;
create trigger documents_cascade_space_type
  after update on public.documents
  for each row execute function public.cascade_space_type_to_descendants();

-- One-time backfill: recompute every existing row's space_type from its
-- actual root, since the column previously only had meaning on root rows.
-- Both triggers disabled for the duration: the structural-changes guard
-- because this runs outside any end-user's auth context (auth.uid() is
-- null in the SQL Editor), and the cascade trigger because this single
-- bulk statement already computes the correct final value for every row
-- in one pass -- letting the AFTER-UPDATE cascade also fire per row would
-- redundantly re-cascade overlapping subtrees on top of each other
-- (combinatorial, not infinite, but extremely slow on a real tree).
alter table public.documents disable trigger documents_prevent_collaborator_structural_changes;
alter table public.documents disable trigger documents_cascade_space_type;

with recursive tree as (
  select id, space_type
  from public.documents
  where parent_document is null
  union all
  select d.id, t.space_type
  from public.documents d
  join tree t on d.parent_document = t.id
)
update public.documents d
set space_type = t.space_type
from tree t
where d.id = t.id
  and d.space_type is distinct from t.space_type;

alter table public.documents enable trigger documents_prevent_collaborator_structural_changes;
alter table public.documents enable trigger documents_cascade_space_type;

-- ---------------------------------------------------------
-- 10. New visibility rule: closed by default, with "pass-through"
--     ancestor visibility so a shared subtree can still be navigated to.
-- ---------------------------------------------------------
create or replace function public.has_direct_share_access(doc_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select d.id, d.parent_document, 0 as depth
    from public.documents d
    where d.id = doc_id
    union all
    select p.id, p.parent_document, c.depth + 1
    from public.documents p
    join chain c on p.id = c.parent_document
    where c.depth < 500
  ),
  nearest_share_node as (
    select c.id
    from chain c
    where exists (select 1 from public.document_shares s where s.document_id = c.id)
    order by c.depth asc
    limit 1
  )
  select
    (select space_type from public.documents where id = doc_id) = 'public'
    and (select id from nearest_share_node) is not null
    and (
      exists (
        select 1 from public.document_shares s
        where s.document_id = (select id from nearest_share_node)
          and s.user_id = uid
      )
      or exists (
        select 1 from public.documents d
        where d.id = (select id from nearest_share_node)
          and d.user_id = uid
      )
    );
$$;

create or replace function public.can_view_document(doc_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.documents where id = doc_id and user_id = uid)
    or public.has_direct_share_access(doc_id, uid)
    or exists (
      with recursive descendants as (
        select id from public.documents where parent_document = doc_id
        union all
        select d.id
        from public.documents d
        join descendants desc_ on d.parent_document = desc_.id
      )
      select 1 from descendants desc_ where public.has_direct_share_access(desc_.id, uid)
      limit 1
    );
$$;

grant execute on function public.has_direct_share_access(uuid, uuid) to authenticated;

-- ---------------------------------------------------------
-- 11. document_shares can only be created on a document whose space_type
--     is already 'public' -- Espacio personal can never be shared, even
--     by mistake.
-- ---------------------------------------------------------
drop policy if exists "document_shares_insert_owner" on public.document_shares;
create policy "document_shares_insert_owner"
  on public.document_shares for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid() and d.space_type = 'public'
    )
  );
