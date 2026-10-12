-- Homepage の「いいね」保存用。
-- 新規セットアップ用。既に旧版を使っている場合は migrate_likes_to_anonymous_auth.sql を実行してください。

create table if not exists public.page_likes (
  content_key text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (content_key, user_id),
  constraint page_likes_content_key_length
    check (char_length(content_key) between 1 and 200)
);

alter table public.page_likes enable row level security;

-- テーブル自体はブラウザから直接触らせません。
-- いいね数の取得／本人の状態取得／いいね切替は下の関数だけを使います。
revoke all on table public.page_likes from public, anon, authenticated;

create or replace function public.get_like_count(p_content_key text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.page_likes
  where content_key = p_content_key;
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

  return (
    select count(*)
    from public.page_likes
    where content_key = p_content_key
  );
end;
$$;

revoke all on function public.get_like_count(text) from public;
revoke all on function public.get_like_state(text) from public;
revoke all on function public.set_like_state(text, boolean) from public;

grant execute on function public.get_like_count(text) to anon, authenticated;
grant execute on function public.get_like_state(text) to authenticated;
grant execute on function public.set_like_state(text, boolean) to authenticated;
