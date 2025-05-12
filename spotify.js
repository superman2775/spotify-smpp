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
    "user-read-email",
    "streaming",
    "app-remote-control"
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

  const playTrack = async (trackUri) => {
    console.log("[SpotifyWidget] Afspelen:", trackUri);
    const res = await fetchWithToken("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      body: JSON.stringify({ uris: [trackUri] })
    });
    if (!res.ok) {
      results.querySelectorAll(".widget-item").forEach(el => el.classList.remove("playing"));
      switch (res.status) {
        case 401: return showToast("🔐 Niet geautoriseerd om af te spelen", false);
        case 403: return showToast("🚫 Geen afspeelrechten op dit apparaat", false);
        case 404: return showToast("❓ Geen actief apparaat gevonden", false);
        case 429: return showToast("🐢 Te veel verzoeken, probeer later opnieuw", false);
        case 503: return showToast("⏳ Spotify service tijdelijk niet beschikbaar", false);
        default: return showToast(`⚠️ Fout bij afspelen (${res.status})`, false);
      }
    } else {
      showToast("▶️ Afspelen gestart");
      setTimeout(pollPlaybackState, 1500);
    }
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

  let currentOffset = 0;
  let lastQuery = storage.get("spotify_last_query") || "";

  const results = dom.querySelector(".widget-results");
  const page = dom.querySelector(".widget-page");

  const renderResults = async () => {
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
      const likeBtn = entry.type === '🎵' ? `<img data-id="${entry.id}" data-liked="${isLiked}" class="widget-like-icon" src="like-icon-png/${isLiked ? 'heart-filled' : 'heart-outline'}.png" alt="${isLiked ? 'unlike' : 'like'} knop" style="height:20px;cursor:pointer;">` : '';
      const playBtn = entry.type === '🎵' ? `<button class="widget-play" data-uri="${entry.uri}" title="Afspelen">▶️</button>` : '';
      return `$1<span class=\"widget-status\"></span>
        <img src="${image}" class="widget-thumb" alt="cover image" style="height:40px;width:40px;object-fit:cover;">
        <div style="flex:1"><a href="${link}" target="_blank">${label}</a></div>
        ${playBtn}
        ${likeBtn}
      </div>`;
    }).join('');

    results.querySelectorAll(".widget-like-icon").forEach(icon => {
      icon.onclick = () => likeTrack(icon.dataset.id, icon);
    });
    results.querySelectorAll(".widget-play").forEach(btn => {
      btn.onclick = () => {
        results.querySelectorAll(".widget-item").forEach(el => el.classList.remove("playing"));
        btn.closest(".widget-item").classList.add("playing");
        playTrack(btn.dataset.uri);
      };
    });

    page.textContent = `Pagina ${Math.floor(currentOffset / 5) + 1}`;
  };
});

const pollPlaybackState = async () => {
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
    setTimeout(pollPlaybackState, 10000);
  };

  setTimeout(pollPlaybackState, 1000);
});

export default SpotifyWidget;
// The end (i think) 
