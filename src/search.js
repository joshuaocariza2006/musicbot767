const SpotifyWebApi = require('spotify-web-api-node');
const yts = require('youtube-search-api');

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let spotifyAccessToken = null;
let spotifyTokenExpiry = null;

/**
 * Get valid Spotify access token
 */
async function getSpotifyToken() {
  try {
    if (spotifyAccessToken && spotifyTokenExpiry && Date.now() < spotifyTokenExpiry) {
      return spotifyAccessToken;
    }

    const data = await spotifyApi.clientCredentialsFlow();
    spotifyAccessToken = data.body.access_token;
    spotifyTokenExpiry = Date.now() + data.body.expires_in * 1000;
    spotifyApi.setAccessToken(spotifyAccessToken);
    return spotifyAccessToken;
  } catch (err) {
    console.error('Error getting Spotify token:', err);
    return null;
  }
}

/**
 * Search YouTube for a song
 */
async function searchYouTube(query, limit = 1) {
  try {
    const results = await yts.searchSimple({ query, limit });
    return results.map(v => ({
      title: v.title,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      duration: v.length ? formatDuration(v.length) : 'Unknown',
      thumbnail: v.thumbnail,
      source: 'yt',
      videoId: v.id,
    }));
  } catch (err) {
    console.error('YouTube search error:', err);
    return [];
  }
}

/**
 * Search Spotify for a track
 */
async function searchSpotify(query, limit = 1) {
  try {
    await getSpotifyToken();
    const results = await spotifyApi.searchTracks(query, { limit });
    
    if (!results.body.tracks.items.length) {
      return [];
    }

    // For each Spotify track, search YouTube to get a playable URL
    const tracks = [];
    for (const track of results.body.tracks.items.slice(0, limit)) {
      const ytResults = await searchYouTube(`${track.name} ${track.artists[0].name}`, 1);
      if (ytResults.length > 0) {
        tracks.push({
          title: track.name,
          url: ytResults[0].url,
          duration: formatDuration(track.duration_ms),
          thumbnail: track.album.images[0]?.url,
          source: 'sp',
          spotifyId: track.id,
          artist: track.artists[0].name,
        });
      }
    }
    return tracks;
  } catch (err) {
    console.error('Spotify search error:', err);
    return [];
  }
}

/**
 * Unified search across Spotify and YouTube
 */
async function searchSong(query, requestedBy) {
  const allResults = [];

  // Try Spotify first
  const spotifyResults = await searchSpotify(query, 1);
  if (spotifyResults.length > 0) {
    allResults.push(spotifyResults[0]);
  }

  // Fall back to YouTube
  if (allResults.length === 0) {
    const youtubeResults = await searchYouTube(query, 1);
    if (youtubeResults.length > 0) {
      allResults.push(youtubeResults[0]);
    }
  }

  // Add requestedBy to all results
  return allResults.map(song => ({
    ...song,
    requestedBy,
  }));
}

/**
 * Format duration from milliseconds
 */
function formatDuration(ms) {
  if (typeof ms === 'string') {
    // Already formatted or unknown
    return ms;
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

module.exports = {
  searchSong,
  searchYouTube,
  searchSpotify,
  getSpotifyToken,
  formatDuration,
};
