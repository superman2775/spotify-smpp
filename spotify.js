// Only use with permission
// You can't get permission rn 💀
class SpotifyWidget extends WidgetBase 
import { widget, registerWidget } from "smpp";
import "./spotify.css";

const spotifyWidget = widget("spotify", async ({ dom, storage, settings }) => {
    if (settings.get("spotify.enabled") === false) return;

  let token = storage.get("spotify_token");
  const clientId = "f193259a379944d3b2a1e929f860712e";
  const redirectUri = window.location.origin;
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-library-read",
    "user-library-modify",
    "user-read-currently-playing",
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative",
    "streaming",
    "app-remote-control"
  ];

  function authorize() {
    const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(redirectUri)}`;
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

  let toast, loader;

  const fetchWithToken = async (url, options = {}) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers
        }
      });
      if (res.status === 401) {
        console.warn("[Spotify] 401 Unauthorized — triggering reauth");
        authorize();
      }
      return res;
    } catch (err) {
      console.error("[Spotify] fetch failed:", err);
      showToast("🌐 Netwerkfout. Controleer je verbinding.", false);
      throw err;
    }
  };

  const showToast = (message, success = true) => {
    if (!toast) return;
    toast.textContent = message;
    toast.className = success ? 'widget-toast success' : 'widget-toast error';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  };

  const checkLikedTracks = async (ids) => {
    if (!ids.length) return [];
    const res = await fetchWithToken(`https://api.spotify.com/v1/me/tracks/contains?ids=${ids.join(',')}`);
    if (!res.ok) return Array(ids.length).fill(false);
    return await res.json();
  };

  const toggleLike = async (trackId, icon) => {
    const isLiked = icon.dataset.liked === 'true';
    const method = isLiked ? 'DELETE' : 'PUT';
    const res = await fetchWithToken(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, { method });
    if (!res.ok) {
      showToast(`⚠️ Fout bij ${isLiked ? 'unliken' : 'liken'} (${res.status})`, false);
    } else {
      icon.src = isLiked ? "like-icon-like.png" : "like-icon-liked.png";
      icon.dataset.liked = (!isLiked).toString();
      showToast(isLiked ? "💔 Verwijderd uit favorieten" : "❤️ Toegevoegd aan favorieten");
    }
  };

  const renderPlaylists = async () => {
  const res = await fetchWithToken("https://api.spotify.com/v1/me/playlists?limit=10");
  if (!res.ok) return showToast(`❌ Fout bij ophalen van playlists (${res.status})`, false);
  const data = await res.json();
  const playlists = data.items || [];
  const html = playlists.map(pl => `
    <div class="widget-item">
      <img class="widget-cover" src="${pl.images?.[0]?.url || ''}" alt="playlist" />
      <div class="widget-meta">
        <a class="widget-label" href="${pl.external_urls.spotify}" target="_blank">📂 ${pl.name}</a>
        <a class="widget-spotify-link" href="${pl.external_urls.spotify}" target="_blank">🔗 Bekijk in Spotify</a>
      </div>
    </div>
  `).join('');
  results.innerHTML = `
    <div class="widget-section-title">📚 Jouw playlists</div>
    ${html}
  `;
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
        403: isPaused ? "🚫 Kan niet hervatten. Mogelijke reden: Geen Premium" : "🚫 Kan niet pauzeren. Mogelijke reden: Geen Premium",
        404: "❓ Geen actief apparaat",
        429: "🐢 Te veel verzoeken",
        503: "⏳ Service niet beschikbaar"
      };
      showToast(map[res.status] || `⚠️ Fout (${res.status}) bij ${isPaused ? 'hervatten' : 'pauzeren'}`, false);
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
    try {
      const res = await fetchWithToken("https://api.spotify.com/v1/me/player");
      if (!res.ok) return;
      const data = await res.json();
      const playingUri = data?.item?.uri;
      const isPlaying = data?.is_playing;
      results.querySelectorAll(".widget-item").forEach(item => {
        const playBtn = item.querySelector(".widget-play");
        if (playBtn && playBtn.dataset.uri === playingUri && isPlaying) {
          item.classList.add("playing");
        } else {
          item.classList.remove("playing");
        }
      });
    } catch (err) {
      console.warn("[Spotify] playback poll error:", err);
    }
    setTimeout(pollPlaybackState, 10000);
  };

  const searchSpotify = async (query, type = 'track') => {
    loader.style.display = 'flex';
    const res = await fetchWithToken(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`);
    loader.style.display = 'none';
    if (!res.ok) return showToast(`❌ Fout tijdens zoeken (${res.status})`, false);
    const data = await res.json();
    return data[type + 's']?.items || [];
  };

const renderResults = async (query, type) => {
  if (query.trim() === "" && type === "playlist") return renderPlaylists();
  const items = await searchSpotify(query, type);
  if (!items.length) {
    results.innerHTML = `
      <div class="widget-section-empty">❌ Geen resultaten gevonden.</div>
    `;
    return;
  }
  const trackIds = items.map(item => item.id).filter(Boolean);
  const liked = await checkLikedTracks(trackIds);

  results.innerHTML = items.map((entry, index) => {
    const image = entry.images?.[0]?.url || entry.album?.images?.[0]?.url || '';
    const label = `${type === 'track' ? '🎵' : type === 'album' ? '💿' : type === 'playlist' ? '📂' : '👤'} ${entry.name}`;
    const link = entry.external_urls?.spotify || '#';
    const likeState = liked[index] ? 'true' : 'false';
    const likeIcon = liked[index] ? 'like-icon-liked.png' : 'like-icon-like.png';
    const likeBtn = type === 'track'
      ? `<img class="widget-like" src="https://raw.githubusercontent.com/superman2775/spotify-smpp/main/${likeIcon}" data-id="${entry.id}" data-liked="${likeState}" />`
      : '';

    return `
      <div class="widget-item">
        <img class="widget-cover" src="https://raw.githubusercontent.com/superman2775/spotify-smpp/main/${image}" alt="cover" />
        <div class="widget-meta">
          <a class="widget-label" href="${link}" target="_blank">${label}</a>
          ${likeBtn}
          <a class="widget-spotify-link" href="${link}" target="_blank">🔗 Bekijk in Spotify</a>
        </div>
      </div>
    `;
  }).join('');

  results.querySelectorAll(".widget-like").forEach(icon => {
    icon.onclick = () => toggleLike(icon.dataset.id, icon);
  });
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
        <option value="playlist">📂 Playlists</option>
      </select>
      <input class="widget-input" placeholder="Zoek iets op Spotify">
    </div>
    <div class="widget-loader" style="display:none"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    <div class="widget-results"></div>
    <div class="widget-toast" role="alert"></div>
  `;
  widgetRoot.querySelector(".widget-controls").appendChild(renderPauseButton());
  dom.appendChild(widgetRoot);

  toast = widgetRoot.querySelector(".widget-toast");
  loader = widgetRoot.querySelector(".widget-loader");
  const results = widgetRoot.querySelector(".widget-results");
  const input = widgetRoot.querySelector(".widget-input");
  const filter = widgetRoot.querySelector(".widget-filter");

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") renderResults(input.value, filter.value);
  });

  filter.addEventListener("change", () => {
    if (filter.value === "playlist") renderPlaylists();
  });

  results.addEventListener("click", (e) => {
    const btn = e.target.closest(".widget-play");
    if (btn?.dataset?.uri) playUri(btn.dataset.uri);
  });

  const playUri = async (uri) => {
    const res = await fetchWithToken("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      body: JSON.stringify({ context_uri: uri })
    });
    if (!res.ok) {
      showToast(`⚠️ Kon playlist niet afspelen (${res.status})`, false);
    } else {
      showToast("▶️ Afspelen gestart");
    }
  };

  setTimeout(pollPlaybackState, 1000);
});
registerWidget(spotifyWidget);
export default spotifyWidget;
