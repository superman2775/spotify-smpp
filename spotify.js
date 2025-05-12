// This code can only be used with permission
// How to get permission? You can't!

import { widget } from "smpp";
import "./spotify.css";

const SpotifyWidget = widget("spotify", async ({ dom, storage, settings }) => {
  console.log("[SpotifyWidget] Initialiseren...");
  if (settings.get("spotify.enabled") === false) return;

  let token = storage.get("spotify_token");
  const clientId = "YOUR_SPOTIFY_CLIENT_ID";
  const redirectUri = window.location.origin;
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-library-read",
    "user-library-modify",
    "user-read-currently-playing",
    "user-read-private",
    "user-read-email"
  ];

  function authorize() {
    console.log("[SpotifyWidget] Start autorisatie...");
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
      console.log("[SpotifyWidget] Token gevonden in URL");
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

  let toast = null;
  let loader = null;

  const fetchWithToken = async (url, options = {}) => {
    console.log("[SpotifyWidget] Fetch", url);
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
    console.log("[SpotifyWidget] Toast:", message);
    toast.textContent = message;
    toast.className = success ? 'widget-toast success' : 'widget-toast error';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  };

  const handleApiError = (res) => {
    console.warn("[SpotifyWidget] API Fout:", res.status);
    const map = {
      400: "❌ Ongeldig verzoek.",
      401: "🔐 Niet geautoriseerd.",
      403: "🚫 Verboden.",
      404: "❓ Niet gevonden.",
      429: "🐢 Te veel verzoeken.",
      500: "💥 Interne fout.",
      502: "🌩️ Bad Gateway.",
      503: "⏳ Niet beschikbaar.",
      504: "🚫 Timeout."
    };
    showToast(map[res.status] || `⚠️ Fout (${res.status})`, false);
  };

  const checkLikedTracks = async (ids) => {
    console.log("[SpotifyWidget] Check liked tracks:", ids);
    if (ids.length === 0) return [];
    const res = await fetchWithToken(`https://api.spotify.com/v1/me/tracks/contains?ids=${ids.join(',')}`);
    if (!res.ok) return [];
    return await res.json();
  };

  const searchSpotify = async (query, type = 'all', offset = 0) => {
    console.log("[SpotifyWidget] Zoek:", query, type, offset);
    if (loader) loader.style.display = 'flex';
    const t = type === 'all' ? 'track,album,artist' : type;
    const res = await fetchWithToken(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${t}&limit=5&offset=${offset}`
    );
    if (loader) loader.style.display = 'none';
    if (!res.ok) return handleApiError(res);
    const data = await res.json();
    const items = [
      ...(data.tracks?.items || []).map(i => ({ type: '🎵', ...i })),
      ...(data.albums?.items || []).map(i => ({ type: '💿', ...i })),
      ...(data.artists?.items || []).map(i => ({ type: '👤', ...i }))
    ];
    return items.length ? items : null;
  };

  const likeTrack = async (id, icon) => {
    console.log("[SpotifyWidget] Like toggle:", id);
    const liked = icon.getAttribute('data-liked') === 'true';
    const method = liked ? 'DELETE' : 'PUT';
    const res = await fetchWithToken(`https://api.spotify.com/v1/me/tracks?ids=${id}`, { method });
    if (!res.ok) return handleApiError(res);
    icon.src = liked ? 'like-icon-png/heart-outline.png' : 'like-icon-png/heart-filled.png';
    icon.setAttribute('data-liked', liked ? 'false' : 'true');
    showToast(liked ? "💔 Verwijderd uit favorieten" : "❤️ Toegevoegd aan favorieten");
  };

  let currentOffset = 0;
  let lastQuery = storage.get("spotify_last_query") || "";

  dom.innerHTML = `
    <div class="widget spotify widget-dark">
      <div class="widget-header">
        <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_CMYK_Green.png" style="height:20px;margin-right:5px"> Spotify
      </div>
      <div class="widget-controls">
        <select class="widget-filter">
          <option value="all">🔍 Alles</option>
          <option value="track">🎵 Tracks</option>
          <option value="album">💿 Albums</option>
          <option value="artist">👤 Artiesten</option>
        </select>
        <input placeholder="Zoek naar tracks, albums of artiesten" class="widget-input" value="${lastQuery}">
      </div>
      <div class="widget-loader" style="display:none"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
      <div class="widget-results" style="max-height: 300px; overflow-y: auto;"></div>
      <div class="widget-pagination">
        <button class="widget-prev">⬅️ Vorige</button>
        <span class="widget-page">Pagina 1</span>
        <button class="widget-next">Volgende ➡️</button>
      </div>
      <div class="widget-toast"></div>
    </div>
  `;

  const input = dom.querySelector(".widget-input");
  const filter = dom.querySelector(".widget-filter");
  const results = dom.querySelector(".widget-results");
  const next = dom.querySelector(".widget-next");
  const prev = dom.querySelector(".widget-prev");
  const page = dom.querySelector(".widget-page");
  toast = dom.querySelector(".widget-toast");
  loader = dom.querySelector(".widget-loader");

  const renderResults = async () => {
    console.log("[SpotifyWidget] Resultaten tonen", lastQuery, filter.value, currentOffset);
    const entries = await searchSpotify(lastQuery, filter.value, currentOffset);
    results.scrollTo({ top: 0, behavior: 'smooth' });
    if (!entries) {
      results.innerHTML = `<div style="padding:1em;color:gray;text-align:center;">❌ Geen resultaten gevonden.</div>`;
      page.textContent = `Pagina ${Math.floor(currentOffset / 5) + 1}`;
      return;
    }
    const trackEntries = entries.filter(e => e.type === '🎵');
    const trackIds = trackEntries.map(e => e.id);
    const likedMap = await checkLikedTracks(trackIds);
    results.innerHTML = entries.map((entry, idx) => {
      const label = entry.type + ' ' + (entry.name || '(geen naam)');
      const image = entry.images?.[0]?.url || entry.album?.images?.[0]?.url || '';
      const link = entry.external_urls?.spotify || '#';
      const likeIdx = trackEntries.findIndex(te => te.id === entry.id);
      const isLiked = likeIdx >= 0 ? likedMap[likeIdx] : false;
      const likeBtn = entry.type === '🎵' ? `<img data-id="${entry.id}" data-liked="${isLiked}" class="widget-like-icon" src="like-icon-png/${isLiked ? 'heart-filled' : 'heart-outline'}.png" style="height:20px;cursor:pointer;">` : '';
      return `<div class="widget-item" style="display:flex;align-items:center;gap:10px;margin:5px 0;">
        <img src="${image}" class="widget-thumb" style="height:40px;width:40px;object-fit:cover;">
        <div style="flex:1"><a href="${link}" target="_blank">${label}</a></div>
        ${likeBtn}
      </div>`;
    }).join('');

    results.querySelectorAll(".widget-like-icon").forEach(icon => {
      icon.onclick = () => likeTrack(icon.dataset.id, icon);
    });

    page.textContent = `Pagina ${Math.floor(currentOffset / 5) + 1}`;
  };

  if (lastQuery) renderResults();

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      console.log("[SpotifyWidget] Zoekopdracht verstuurd");
      currentOffset = 0;
      lastQuery = input.value;
      storage.set("spotify_last_query", lastQuery);
      renderResults();
    }
  });

  next.addEventListener("click", () => {
    currentOffset += 5;
    renderResults();
  });

  prev.addEventListener("click", () => {
    if (currentOffset >= 5) {
      currentOffset -= 5;
      renderResults();
    }
  });
});

export default SpotifyWidget;
