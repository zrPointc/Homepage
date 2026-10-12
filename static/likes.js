(() => {
  const config = window.TEN_LIKES_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const publishableKey = String(config.supabasePublishableKey || "");
  const widgets = [...document.querySelectorAll("[data-like-widget]")];
  const supabaseGlobal = window.supabase;

  if (!widgets.length || !supabaseUrl || !publishableKey) return;

  function formatError(error) {
    if (!error) return "unknown error";
    const parts = [];
    if (error.name) parts.push(error.name);
    if (error.message) parts.push(error.message);
    if (error.code) parts.push(`code=${error.code}`);
    if (error.status) parts.push(`status=${error.status}`);
    return parts.join(" / ") || String(error);
  }

  if (!supabaseGlobal?.createClient) {
    console.error("Supabase client library was not loaded.");
    widgets.forEach((widget) => {
      widget.hidden = false;
      const status = widget.querySelector("[data-like-status]");
      if (status) status.textContent = "診断: Supabaseライブラリを読み込めませんでした。";
    });
    return;
  }

  const client = supabaseGlobal.createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "ten-supabase-like-auth-v2",
    },
  });

  function setPressed(button, liked) {
    button.setAttribute("aria-pressed", liked ? "true" : "false");
    const heart = button.querySelector(".like-heart");
    if (heart) heart.textContent = liked ? "♥" : "♡";
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(`session: ${formatError(error)}`);
    return data.session || null;
  }

  async function ensureAuthenticated() {
    const existing = await getSession();
    if (existing) return existing;

    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw new Error(`anonymous auth: ${formatError(error)}`);
    if (!data.session) throw new Error("anonymous auth: session was not returned");

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw new Error(`auth verify: ${formatError(userError)}`);
    if (!userData.user) throw new Error("auth verify: user was not returned");

    return data.session;
  }

  async function rpc(name, params) {
    const { data, error } = await client.rpc(name, params);
    if (error) throw new Error(`${name}: ${formatError(error)}`);
    return data;
  }

  async function setupWidget(widget) {
    const contentKey = widget.dataset.likeKey;
    const button = widget.querySelector("[data-like-button]");
    const count = widget.querySelector("[data-like-count]");
    const status = widget.querySelector("[data-like-status]");
    if (!contentKey || !button || !count) return;

    let liked = false;
    setPressed(button, false);
    widget.hidden = false;

    try {
      const initialCount = await rpc("get_like_count", { p_content_key: contentKey });
      count.textContent = String(initialCount ?? 0);
    } catch (error) {
      console.error("Could not load like count", error);
      count.textContent = "–";
      if (status) status.textContent = `診断: ${formatError(error)}`;
    }

    try {
      const session = await getSession();
      if (session) {
        liked = Boolean(await rpc("get_like_state", { p_content_key: contentKey }));
        setPressed(button, liked);
      }
    } catch (error) {
      console.warn("Could not load like state", error);
      if (status) status.textContent = `診断: ${formatError(error)}`;
    }

    button.addEventListener("click", async () => {
      const nextLiked = !liked;
      button.disabled = true;
      widget.classList.add("is-busy");
      if (status) status.textContent = "認証していいねを送信中…";

      try {
        await ensureAuthenticated();
        const nextCount = await rpc("set_like_state", {
          p_content_key: contentKey,
          p_liked: nextLiked,
        });

        liked = nextLiked;
        setPressed(button, liked);
        count.textContent = String(nextCount ?? 0);
        if (status) {
          status.textContent = liked
            ? "ありがとう。反応を受け取りました。"
            : "いいねを取り消しました。";
        }
      } catch (error) {
        console.error("Could not update like", error);
        if (status) status.textContent = `診断: ${formatError(error)}`;
      } finally {
        button.disabled = false;
        widget.classList.remove("is-busy");
      }
    });
  }

  widgets.forEach((widget) => {
    setupWidget(widget);
  });
})();
