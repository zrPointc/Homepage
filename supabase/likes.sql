-- Homepage の「いいね」保存用。
-- Supabase SQL Editor で一度だけ実行してください。

create table if not exists public.page_likes (
  content_key text not null,
  client_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (content_key, client_id),
  constraint page_likes_content_key_length
    check (char_length(content_key) between 1 and 200)
);

alter table public.page_likes enable row level security;

-- ブラウザからテーブルを直接読み書きさせず、下の関数だけ公開します。
revoke all on table public.page_likes from anon, authenticated;

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

create or replace function public.set_like_state(
  p_content_key text,
  p_client_id uuid,
  p_liked boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_content_key is null
     or char_length(p_content_key) < 1
     or char_length(p_content_key) > 200
     or p_client_id is null
     or p_liked is null then
    raise exception 'invalid like request';
  end if;

  if p_liked then
    insert into public.page_likes (content_key, client_id)
    values (p_content_key, p_client_id)
    on conflict (content_key, client_id) do nothing;
  else
    delete from public.page_likes
    where content_key = p_content_key
      and client_id = p_client_id;
  end if;

  return (
    select count(*)
    from public.page_likes
    where content_key = p_content_key
  );
end;
$$;

revoke all on function public.get_like_count(text) from public;
revoke all on function public.set_like_state(text, uuid, boolean) from public;

grant execute on function public.get_like_count(text) to anon, authenticated;
grant execute on function public.set_like_state(text, uuid, boolean) to anon, authenticated;
