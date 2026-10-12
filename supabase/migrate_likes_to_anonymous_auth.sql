-- 旧「任意の client_id をブラウザから送る」方式から、Supabase Anonymous Auth 方式へ移行します。
-- 現在の page_likes は page_likes_legacy_20261012 として固定保存し、
-- その件数を「記念の初期いいね数」として今後の表示カウントに加算します。
-- このファイルは一度だけ実行してください。

begin;

-- 旧APIを先に止めます。
drop function if exists public.set_like_state(text, uuid, boolean);
drop function if exists public.set_like_state(text, boolean);
drop function if exists public.get_like_state(text);

-- 旧いいねは削除せず、そのまま記念データとして固定保存します。
alter table public.page_likes rename to page_likes_legacy_20261012;
alter table public.page_likes_legacy_20261012 enable row level security;
revoke all on table public.page_likes_legacy_20261012 from public, anon, authenticated;

-- 新方式のいいねだけを保存するテーブルです。
create table public.page_likes (
  content_key text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (content_key, user_id),
  constraint page_likes_content_key_length
    check (char_length(content_key) between 1 and 200)
);

alter table public.page_likes enable row level security;
revoke all on table public.page_likes from public, anon, authenticated;

-- 表示件数 = 旧方式で付いた記念いいね + 新方式の安全ないいね。
create or replace function public.get_like_count(p_content_key text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)
     from public.page_likes_legacy_20261012
     where content_key = p_content_key)
    +
    (select count(*)
     from public.page_likes
     where content_key = p_content_key);
$$;

create or replace function public.get_like_state(p_content_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.page_likes
    where content_key = p_content_key
      and user_id = v_user_id
  );
end;
$$;

create or replace function public.set_like_state(
  p_content_key text,
  p_liked boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_legacy_count bigint;
  v_new_count bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_content_key is null
     or p_liked is null
     or not (
       p_content_key = 'homepage'
       or p_content_key ~ '^diary:[A-Za-z0-9._~-]{1,120}$'
     ) then
    raise exception 'invalid like request';
  end if;

  if p_liked then
    insert into public.page_likes (content_key, user_id)
    values (p_content_key, v_user_id)
    on conflict (content_key, user_id) do nothing;
  else
    delete from public.page_likes
    where content_key = p_content_key
      and user_id = v_user_id;
  end if;

  select count(*) into v_legacy_count
  from public.page_likes_legacy_20261012
  where content_key = p_content_key;

  select count(*) into v_new_count
  from public.page_likes
  where content_key = p_content_key;

  return v_legacy_count + v_new_count;
end;
$$;

revoke all on function public.get_like_count(text) from public;
revoke all on function public.get_like_state(text) from public;
revoke all on function public.set_like_state(text, boolean) from public;

grant execute on function public.get_like_count(text) to anon, authenticated;
grant execute on function public.get_like_state(text) to authenticated;
grant execute on function public.set_like_state(text, boolean) to authenticated;

commit;
