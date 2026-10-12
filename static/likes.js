(() => {
  const config = window.TEN_LIKES_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const publishableKey = String(config.supabasePublishableKey || "");
  const widgets = [...document.querySelectorAll("[data-like-widget]")];

  if (!widgets.length || !supabaseUrl || !publishableKey) return;

  const sessionStorageKey = "ten-supabase-auth-session";

  function loadSession() {
    try {
      const raw = localStorage.getItem(sessionStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    } catch (_) { /* Private browsing may block storage. */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem(sessionStorageKey);
    } catch (_) { /* Ignore storage failures. */ }
  }

  function normalizeSession(payload) {
    if (!payload?.access_token || !payload?.refresh_token) return null;
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
      user_id: payload.user?.id || null,
    };
  }

  async function authRequest(path, body) {
    const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.msg || payload?.message || payload?.error_description || `Auth API ${response.status}`);
    }
    return payload;
  }

  async function refreshSession(session) {
    if (!session?.refresh_token) return null;
    try {
      const payload = await authRequest("token?grant_type=refresh_token", {
        refresh_token: session.refresh_token,
      });
      const refreshed = normalizeSession(payload);
      if (refreshed) saveSession(refreshed);
      return refreshed;
    } catch (error) {
      console.warn("Could not refresh anonymous like session", error);
      clearSession();
      return null;
    }
  }

  async function existingSession() {
    let session = loadSession();
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (Number(session.expires_at || 0) > now + 60) return session;
    session = await refreshSession(session);
    return session;
  }

  async function ensureAuthenticated() {
    const current = await existingSession();
    if (current) return current;

    const payload = await authRequest("signup", {
      data: {},
      gotrue_meta_security: {},
    });
    const created = normalizeSession(payload);
    if (!created) throw new Error("Anonymous session was not returned.");
    saveSession(created);
    return created;
  }

  async function rpc(name, body, accessToken = null) {
    const headers = {
      "Content-Type": "application/json",
      apikey: publishableKey,
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`likes API ${response.status}: ${detail}`);
    }
    return response.json();
  }

  function setPressed(button, liked) {
    button.setAttribute("aria-pressed", liked ? "true" : "false");
    const heart = button.querySelector(".like-heart");
    if (heart) heart.textContent = liked ? "♥" : "♡";
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
      console.error(error);
      count.textContent = "–";
      if (status) status.textContent = "いまはいいね数を読み込めません。";
    }

    const session = await existingSession();
    if (session) {
      try {
        liked = Boolean(await rpc("get_like_state", { p_content_key: contentKey }, session.access_token));
        setPressed(button, liked);
      } catch (error) {
        console.warn("Could not load like state", error);
      }
    }

    button.addEventListener("click", async () => {
      const nextLiked = !liked;
      button.disabled = true;
      widget.classList.add("is-busy");

      try {
        let authSession = await ensureAuthenticated();
        let nextCount;
        try {
          nextCount = await rpc(
            "set_like_state",
            { p_content_key: contentKey, p_liked: nextLiked },
            authSession.access_token,
          );
        } catch (error) {
          if (!String(error).includes("401")) throw error;
          authSession = await refreshSession(authSession);
          if (!authSession) throw error;
          nextCount = await rpc(
            "set_like_state",
            { p_content_key: contentKey, p_liked: nextLiked },
            authSession.access_token,
          );
        }

        liked = nextLiked;
        setPressed(button, liked);
        count.textContent = String(nextCount ?? 0);
        if (status) status.textContent = liked ? "ありがとう。反応を受け取りました。" : "いいねを取り消しました。";
      } catch (error) {
        console.error(error);
        if (status) status.textContent = "いまはいいねを受け取れません。少ししてからもう一度。";
      } finally {
        button.disabled = false;
        widget.classList.remove("is-busy");
      }
    });
  }

  widgets.forEach(widget => { setupWidget(widget); });
})();
