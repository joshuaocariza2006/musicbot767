# Music Bot Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd c:\Users\verbo\Desktop\musicdcbot
npm install
```

### 2. Configure `.env` File
Edit `.env` and add your Discord bot token:
```
DISCORD_TOKEN=your_discord_bot_token_here
```

**Spotify API Setup** (for music search):
- Go to https://developer.spotify.com/dashboard
- Create an app
- Get your **Client ID** and **Client Secret**
- Add to `.env`:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

Optionally add Genius API key for lyrics (get it from https://genius.com/api-clients):
```
GENIUS_API_KEY=your_genius_api_key_here
```

### 3. Run the Bot
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Available Commands
- `/play <song>` - Play a song from YouTube, Spotify, or SoundCloud
- `/skip` - Skip current song
- `/stop` - Stop music and clear queue
- `/queue` - Show current queue
- `/pause` - Pause music
- `/resume` - Resume music
- `/loop <mode>` - Set loop mode (off/queue/single)
- `/nowplaying` - Show current song info
- `/filter <name>` - Toggle audio filter
- `/filters` - Show all filter states
- `/lyrics [query]` - Get lyrics for current or searched song
- `/lock` - Lock bot to current channel (admin only)
- `/unlock` - Unlock bot (admin only)

## Troubleshooting

### "Could not find any songs!"
- Make sure your search query is specific (e.g., "Never Gonna Give You Up Rick Astley" instead of just "song")
- The bot now searches Spotify first, then YouTube
- Make sure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are set in `.env`
- Try a direct YouTube/Spotify URL instead

### Bot doesn't start
- Check that `DISCORD_TOKEN` is set correctly in `.env`
- Ensure Node.js 18+ is installed
- Run `npm install` to verify all dependencies are installed

### Music plays for a second then stops
- Try a different song
- Check your bot has permission to speak in voice channels
- Some region-restricted songs may not work
