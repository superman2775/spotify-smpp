const clientId = 'YOUR_CLIENT_ID';
const redirectUri = window.location.href.split('?')[0]; // huidige pagina
const scopes = 'user-read-currently-playing';

async function connectSpotify() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  localStorage.setItem('spotify_code_verifier', codeVerifier);

  const args = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  window.location = `https://accounts.spotify.com/authorize?${args.toString()}`;
}

async function exchangeToken(code) {
  const codeVerifier = localStorage.getItem('spotify_code_verifier');

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  return await response.json();
}

async function fetchNowPlaying(token) {
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    document.getElementById('spotify-widget').innerText = 'Nothing is playing.';
    return;
  }

  const data = await response.json();
  if (data && data.item) {
    const track = data.item;
    document.getElementById('spotify-widget').innerHTML = `
      <img src="${track.album.images[0].url}" width="80"><br>
      <strong>${track.name}</strong><br>
      <em>${track.artists.map(a => a.name).join(', ')}</em>
    `;
  } else {
    document.getElementById('spotify-widget').innerText = 'Nothing is playing.';
  }
}

// --- PKCE Helpers ---

function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// --- Check for OAuth redirect ---

(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('code')) {
    const { access_token } = await exchangeToken(urlParams.get('code'));
    localStorage.setItem('spotify_access_token', access_token);
    window.history.replaceState({}, document.title, redirectUri);
    fetchNowPlaying(access_token);
  } else if (localStorage.getItem('spotify_access_token')) {
    fetchNowPlaying(localStorage.getItem('spotify_access_token'));
  }
})();
