const { Client: GeniusClient } = require("genius-lyrics");

let geniusClient = null;

function getGeniusClient() {
  if (!geniusClient) {
    const key = process.env.GENIUS_API_KEY;
    if (!key) return null;
    geniusClient = new GeniusClient(key);
  }
  return geniusClient;
}

/**
 * Search for lyrics by song title.
 * Returns { title, lyrics } or null if not found.
 */
async function fetchLyrics(query) {
  const genius = getGeniusClient();
  if (!genius) return null;

  try {
    const searches = await genius.songs.search(query);
    if (!searches.length) return null;

    const song = searches[0];
    const lyrics = await song.lyrics();
    if (!lyrics) return null;

    return { title: song.fullTitle, lyrics };
  } catch (err) {
    console.error("Lyrics fetch error:", err.message);
    return null;
  }
}

module.exports = { fetchLyrics };
