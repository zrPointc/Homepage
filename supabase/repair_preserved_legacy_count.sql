-- Anonymous Auth移行後、旧いいね件数を表示カウントへ足すための修復SQL。
-- データは削除しません。既存の関数定義だけを上書きします。

begin;

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

-- 実行後の確認用。homepageは旧26件 + 新方式分になるはずです。
select
  (select count(*) from public.page_likes_legacy_20261012 where content_key = 'homepage') as legacy_homepage_likes,
  (select count(*) from public.page_likes where content_key = 'homepage') as new_homepage_likes,
  public.get_like_count('homepage') as displayed_homepage_likes;
