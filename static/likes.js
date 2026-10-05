(() => {
  const config = window.TEN_LIKES_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const publishableKey = String(config.supabasePublishableKey || "");
  const widgets = [...document.querySelectorAll("[data-like-widget]")];

  if (!widgets.length || !supabaseUrl || !publishableKey) return;

  const memoryStorage = new Map();

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return memoryStorage.get(key) || null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      memoryStorage.set(key, value);
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      memoryStorage.delete(key);
    }
  }

  function createClientId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
      const random = Math.random() * 16 | 0;
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  let clientId = storageGet("ten-like-client-id");
  if (!clientId) {
    clientId = createClientId();
    storageSet("ten-like-client-id", clientId);
  }

  async function rpc(name, body) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
      },
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

    const likedKey = `ten-like:${contentKey}`;
    let liked = storageGet(likedKey) === "yes";
    setPressed(button, liked);
    widget.hidden = false;

    try {
      const initialCount = await rpc("get_like_count", { p_content_key: contentKey });
      count.textContent = String(initialCount ?? 0);
    } catch (error) {
      console.error(error);
      count.textContent = "–";
      if (status) status.textContent = "いまはいいね数を読み込めません。";
    }

    button.addEventListener("click", async () => {
      const nextLiked = !liked;
      button.disabled = true;
      widget.classList.add("is-busy");

      try {
        const nextCount = await rpc("set_like_state", {
          p_content_key: contentKey,
          p_client_id: clientId,
          p_liked: nextLiked,
        });

        liked = nextLiked;
        setPressed(button, liked);
        count.textContent = String(nextCount ?? 0);
        if (liked) storageSet(likedKey, "yes");
        else storageRemove(likedKey);
        if (status) status.textContent = liked ? "ありがとう。反応を受け取りました。" : "いいねを取り消しました。";
      } catch (error) {
        console.error(error);
        if (status) status.textContent = "通信に失敗しました。少ししてからもう一度。";
      } finally {
        button.disabled = false;
        widget.classList.remove("is-busy");
      }
    });
  }

  widgets.forEach(setupWidget);
})();
