import { useEffect, useState } from "react";
import {
  getCurrentlyPlayingTrack,
  togglePlay,
  nextTrack,
  previousTrack,
} from "./spotifyApi";
import themeStyles from "./themeStyles";

export function SpotifyWidget() {
  const [track, setTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    // Detecteer het actieve thema
    const currentTheme = localStorage.getItem("theme") || "default";
    setTheme(currentTheme);

    // Voeg een eventlistener toe voor themawijzigingen
    const handleThemeChange = () => {
      const newTheme = localStorage.getItem("theme") || "default";
      setTheme(newTheme);
    };

    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    async function fetchTrack() {
      const data = await getCurrentlyPlayingTrack();
      if (data) {
        setTrack(data.item);
        setIsPlaying(data.is_playing);
      }
    }
    fetchTrack();
    const interval = setInterval(fetchTrack, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!track)
    return <div style={{ color: themeStyles[theme]?.textColor || "#000" }}>Geen muziek afgespeeld</div>;

  const playPause = async () => {
    await togglePlay(isPlaying);
    setIsPlaying(!isPlaying);
  };

  const currentStyles = themeStyles[theme] || themeStyles["default"];

  return (
    <div
      style={{
        backgroundColor: currentStyles.backgroundColor,
        color: currentStyles.textColor,
        borderRadius: "1rem",
        padding: "1rem",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        width: "16rem",
        textAlign: "center",
      }}
    >
      <img
        src={track.album.images[0].url}
        alt="Album"
        style={{ borderRadius: "0.5rem", width: "100%", marginBottom: "0.5rem" }}
      />
      <div style={{ fontWeight: "bold" }}>{track.name}</div>
      <div style={{ fontSize: "0.875rem" }}>
        {track.artists.map((a) => a.name).join(", ")}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "0.5rem",
          fontSize: "1.25rem",
        }}
      >
        <button onClick={previousTrack}>⏮️</button>
        <button onClick={playPause}>{isPlaying ? "⏸️" : "▶️"}</button>
        <button onClick={nextTrack}>⏭️</button>
      </div>
    </div>
  );
}
