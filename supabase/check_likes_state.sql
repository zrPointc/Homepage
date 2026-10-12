-- いいね移行後の状態確認用。読み取りだけで、データは変更しません。
select
  (select count(*) from public.page_likes_legacy_20261012 where content_key = 'homepage') as legacy_homepage_likes,
  (select count(*) from public.page_likes where content_key = 'homepage') as new_homepage_likes,
  public.get_like_count('homepage') as displayed_homepage_likes;
