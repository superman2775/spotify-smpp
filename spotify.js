// ... bestaande variabelen en functies blijven gelijk

async function fetchNowPlaying(token) {
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` }
  });

  const container = document.getElementById('spotify-info');

  if (!response.ok || response.status === 204) {
    container.innerHTML = '<span style="opacity: 0.7;">Nothing is playing</span>';
    return;
  }

  const data = await response.json();
  if (data && data.item) {
    const track = data.item;
    container.innerHTML = `
      <img src="${track.album.images[0].url}" width="64" height="64" style="border-radius: 6px; margin-bottom: 8px;">
      <div style="font-weight: bold;">${track.name}</div>
      <div style="font-size: 0.9em; color: #aaa;">${track.artists.map(a => a.name).join(', ')}</div>
    `;
  } else {
    container.innerHTML = '<span style="opacity: 0.7;">Nothing is playing</span>';
  }
}

(async () => {
  const connectBtn = document.getElementById('spotify-connect');
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has('code')) {
    const { access_token } = await exchangeToken(urlParams.get('code'));
    localStorage.setItem('spotify_access_token', access_token);
    window.history.replaceState({}, document.title, redirectUri);
    connectBtn.style.display = 'none';
    fetchNowPlaying(access_token);
  } else if (localStorage.getItem('spotify_access_token')) {
    connectBtn.style.display = 'none';
    fetchNowPlaying(localStorage.getItem('spotify_access_token'));
  } else {
    connectBtn.style.display = 'inline-block';
  }
})();
