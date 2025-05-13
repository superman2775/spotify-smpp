// This code can only be used with permission
// How to get permission? You can't!

import { widget } from "smpp";
import "./spotify.css";

const SpotifyWidget = widget("spotify", async ({ dom, storage, settings }) => {
  if (settings.get("spotify.enabled") === false) return;

  const clientId = "f193259a379944d3b2a1e929f860712e";
  const redirectUri = window.location.origin;
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "streaming",
    "app-remote-control",
    "user-read-email",
    "user-read-private"
  ];

  let token = storage.get("spotify_token");

  function authorize() {
    const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${encodeURIComponent(
      scopes.join(" ")
    )}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  }

  function extractTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const t = params.get("access_token");
    if (t) {
      storage.set("spotify_token", t);
      window.location.hash = "";
      return t;
    }
    return null;
  }

  if (!token) {
    token = extractTokenFromUrl();
    if (!token) return authorize();
  }

  const fetchWithToken = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    if (res.status === 401) authorize();
    return res;
  };

  const showToast = (message, success = true) => {
    if (!toast) return;
    toast.textContent = message;
    toast.className = success ? "widget-toast success" : "widget-toast error";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  };

  let isPaused = false;
  let pauseButton;

  const pausePlayback = async () => {
    const url = isPaused
      ? "https://api.spotify.com/v1/me/player/play"
      : "https://api.spotify.com/v1/me/player/pause";
    const res = await fetchWithToken(url, { method: "PUT" });
    if (!res.ok) {
      const map = {
        403: isPaused
          ? "🚫 Kan niet hervatten"
          : "🚫 Je kunt momenteel niet pauzeren",
        404: "❓ Geen actief apparaat",
        429: "🐢 Te veel verzoeken",
        503: "⏳ Service niet beschikbaar"
      };
      showToast(
        map[res.status] ||
          `⚠️ Fout (${res.status}) bij ${
            isPaused ? "hervatten" : "pauzeren"
          }`,
        false
      );
    } else {
      isPaused = !isPaused;
      pauseButton.textContent = isPaused ? "▶️ Hervat" : "⏸️ Pauzeer";
    }
  };

  const renderPauseButton = () => {
    pauseButton = document.createElement("button");
    pauseButton.textContent = "⏸️ Pauzeer";
    pauseButton.className = "widget-pause";
    pauseButton.onclick = pausePlayback;
    return pauseButton;
  };

  const pollPlaybackState = async () => {
    const res = await fetchWithToken("https://api.spotify.com/v1/me/player");
    if (!res.ok) return;
    const data = await res.json();
    const playingUri = data?.item?.uri;
    const isPlaying = data?.is_playing;
    results.querySelectorAll(".widget-item").forEach((item) => {
      const playBtn = item.querySelector(".widget-play");
      if (playBtn && playBtn.dataset.uri === playingUri && isPlaying) {
        item.classList.add("playing");
      } else {
        item.classList.remove("playing");
      }
    });
    setTimeout(pollPlaybackState, 10000);
  };

  const searchSpotify = async (query, type = "track") => {
    loader.style.display = "flex";
    const res = await fetchWithToken(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=${type}&limit=5`
    );
    loader.style.display = "none";
    if (!res.ok)
      return showToast(`❌ Fout tijdens zoeken (${res.status})`, false);
    const data = await res.json();
    return data[type + "s"]?.items || [];
  };

  const renderResults = async (query, type) => {
    const items = await searchSpotify(query, type);
    if (!items.length) {
      results.innerHTML = `<div style="padding:1em;color:gray;text-align:center;">❌ Geen resultaten gevonden.</div>`;
      return;
    }
    results.innerHTML = items
      .map((entry) => {
        const image =
          entry.images?.[0]?.url || entry.album?.images?.[0]?.url || "";
        const label = `${
          type === "track" ? "🎵" : type === "album" ? "💿" : "👤"
        } ${entry.name}`;
        const link = entry.external_urls?.spotify || "#";
        return `<div class="widget-item" style="display:flex;align-items:center;gap:10px;margin:5px 0;">
        <img src="${image}" class="widget-thumb" alt="cover" style="height:40px;width:40px;object-fit:cover;">
        <div style="flex:1"><a href="${link}" target="_blank">${label}</a></div>
      </div>`;
      })
      .join("");
  };

  const widgetRoot = document.createElement("div");
  widgetRoot.className = "widget spotify widget-dark";
  widgetRoot.innerHTML = `
    <div class="widget-header">
      <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png" style="height:20px;margin-right:5px"> Spotify
    </div>
    <div class="widget-controls">
      <select class="widget-filter">
        <option value="track">🎵 Tracks</option>
        <option value="album">💿 Albums</option>
        <option value="artist">👤 Artiesten</option>
      </select>
      <input class="widget-input" placeholder="Zoek iets op Spotify">
    </div>
    <div class="widget-loader" style="display:none"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    <div class="widget-results"></div>
    <div class="widget-toast" role="alert"></div>
  `;
  widgetRoot.querySelector(".widget-controls").appendChild(renderPauseButton());
  dom.appendChild(widgetRoot);

  const toast = widgetRoot.querySelector(".widget-toast");
  const loader = widgetRoot.querySelector(".widget-loader");
  const results = widgetRoot.querySelector(".widget-results");
  const input = widgetRoot.querySelector(".widget-input");
  const filter = widgetRoot.querySelector(".widget-filter");

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") renderResults(input.value, filter.value);
  });

  setTimeout(pollPlaybackState, 1000);
});

export default SpotifyWidget;
