const accessToken = "YOUR_ACCESS_TOKEN"; // Vervang dit door je eigen logica voor het verkrijgen van het toegangstoken

export async function getCurrentlyPlayingTrack() {
  const res = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok || res.status === 204) return null;
  return await res.json();
}

export async function togglePlay(isPlaying) {
  await fetch(`https://api.spotify.com/v1/me/player/${isPlaying ? "pause" : "play"}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function nextTrack() {
  await fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function previousTrack() {
  await fetch("https://api.spotify.com/v1/me/player/previous", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
