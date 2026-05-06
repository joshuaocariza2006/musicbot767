const { EmbedBuilder } = require("discord.js");

const COLORS = {
  primary: 0x1db954,
  error: 0xff4444,
  info: 0x5865f2,
  warning: 0xffa500,
  lyrics: 0xffff00,
  filter: 0xff69b4,
  lock: 0xff8c00,
};

function nowPlayingEmbed(song, filters) {
  const sourceLabel =
    song.source === "sp" ? "🟢 Spotify" :
    song.source === "sc" ? "🟠 SoundCloud" :
    "🔴 YouTube";

  const activeFilters = filters
    ? Object.entries(filters).filter(([, v]) => v).map(([k]) => k)
    : [];

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🎶 Now Playing")
    .setDescription(`**[${song.title}](${song.url})**`)
    .addFields(
      { name: "Duration", value: song.duration || "Live", inline: true },
      { name: "Requested by", value: `${song.requestedBy}`, inline: true },
      { name: "Source", value: sourceLabel, inline: true }
    )
    .setThumbnail(song.thumbnail || null)
    .setTimestamp();

  if (activeFilters.length) {
    embed.addFields({ name: "🎛️ Active Filters", value: activeFilters.map(f => `\`${f}\``).join(", "), inline: false });
  }

  return embed;
}

function queueEmbed(songs) {
  const upcoming = songs.slice(1, 11);
  const current = songs[0];
  const remaining = Math.max(0, songs.length - 11);

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("📋 Music Queue")
    .setDescription(
      `**Now Playing:**\n🎵 [${current.title}](${current.url}) — \`${current.duration || "Live"}\`\n\n` +
      (upcoming.length
        ? "**Up Next:**\n" +
          upcoming.map((s, i) => `\`${i + 1}.\` [${s.title}](${s.url}) — \`${s.duration || "Live"}\``).join("\n") +
          (remaining > 0 ? `\n\n*...and ${remaining} more*` : "")
        : "*No more songs in queue*")
    )
    .setFooter({ text: `${songs.length} song(s) in queue` })
    .setTimestamp();

  return embed;
}

function addedToQueueEmbed(song, position) {
  const sourceLabel =
    song.source === "sp" ? "🟢 Spotify" :
    song.source === "sc" ? "🟠 SoundCloud" :
    "🔴 YouTube";

  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("✅ Added to Queue")
    .setDescription(`**[${song.title}](${song.url})**`)
    .addFields(
      { name: "Duration", value: song.duration || "Live", inline: true },
      { name: "Position", value: `#${position}`, inline: true },
      { name: "Source", value: sourceLabel, inline: true }
    )
    .setThumbnail(song.thumbnail || null);
}

function lyricsEmbed(title, lyrics) {
  // Discord embed description max is 4096 chars
  const trimmed = lyrics.length > 3900 ? lyrics.slice(0, 3900) + "\n\n*...lyrics trimmed*" : lyrics;

  return new EmbedBuilder()
    .setColor(COLORS.lyrics)
    .setTitle(`📝 Lyrics — ${title}`)
    .setDescription(trimmed)
    .setTimestamp();
}

function filterEmbed(filters) {
  const lines = Object.entries(filters).map(
    ([name, active]) => `${active ? "✅" : "⬛"} **${name.charAt(0).toUpperCase() + name.slice(1)}**`
  );

  return new EmbedBuilder()
    .setColor(COLORS.filter)
    .setTitle("🎛️ Audio Filters")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Use /filter <name> to toggle" });
}

function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle("❌ Error")
    .setDescription(message);
}

function infoEmbed(title, message) {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(title)
    .setDescription(message);
}

function lockEmbed(channelId, locked) {
  return new EmbedBuilder()
    .setColor(COLORS.lock)
    .setTitle(locked ? "🔒 Bot Locked" : "🔓 Bot Unlocked")
    .setDescription(
      locked
        ? `This bot is now locked to <#${channelId}>. Commands will only work in that channel.`
        : "This bot is now unlocked and can be used in any channel."
    );
}

module.exports = {
  nowPlayingEmbed,
  queueEmbed,
  addedToQueueEmbed,
  lyricsEmbed,
  filterEmbed,
  errorEmbed,
  infoEmbed,
  lockEmbed,
};
