const { SlashCommandBuilder, Collection, PermissionFlagsBits } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const play = require("play-dl");
const { MusicQueue } = require("./queue");
const { playSong } = require("./player");
const { fetchLyrics } = require("./lyrics");
const { FILTER_MAP } = require("./filters");
const { searchSong } = require("./search");
const {
  queueEmbed,
  addedToQueueEmbed,
  errorEmbed,
  infoEmbed,
  nowPlayingEmbed,
  lyricsEmbed,
  filterEmbed,
  lockEmbed,
} = require("./embeds");

const commands = new Collection();

// ═══════════════════════════════════════════
//  /play — YouTube, Spotify, SoundCloud
// ═══════════════════════════════════════════
const playCmd = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube, Spotify, or SoundCloud")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song name, YT/Spotify/SoundCloud URL").setRequired(true)
    ),

  async execute(interaction, client) {
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ embeds: [errorEmbed("You must be in a voice channel!")], ephemeral: true });
    }

    await interaction.deferReply();
    const query = interaction.options.getString("query")?.trim();
    let queue = client.queues.get(interaction.guildId);

    if (!query) {
      return interaction.editReply({ embeds: [errorEmbed("Please provide a song name, URL, or search term.")] });
    }

    if (!queue) {
      queue = new MusicQueue();
      queue.textChannel = interaction.channel;
      queue.voiceChannel = voiceChannel;
      client.queues.set(interaction.guildId, queue);
    }

    try {
      let songs = [];

      // ── Spotify ──
      const spValidation = play.sp_validate(query);
      if (spValidation && spValidation !== "search") {
        if (play.is_expired()) await play.refreshToken();

        if (spValidation === "track") {
          const sp = await play.spotify(query);
          songs.push(makeSong(sp, "sp", interaction.user));
        } else if (spValidation === "playlist" || spValidation === "album") {
          const sp = await play.spotify(query);
          const tracks = await sp.all_tracks();
          songs = tracks.slice(0, 100).map((t) => makeSong(t, "sp", interaction.user));
        }

      // ── SoundCloud ──
      } else if (play.so_validate(query)) {
        const soType = await play.so_validate(query);
        if (soType === "track") {
          const info = await play.soundcloud(query);
          songs.push({
            title: info.name,
            url: info.url,
            duration: formatDuration(info.durationInMs),
            thumbnail: info.thumbnail,
            source: "sc",
            requestedBy: interaction.user,
          });
        } else if (soType === "playlist") {
          const pl = await play.soundcloud(query);
          const tracks = await pl.all_tracks();
          songs = tracks.slice(0, 100).map((t) => ({
            title: t.name,
            url: t.url,
            duration: formatDuration(t.durationInMs),
            thumbnail: t.thumbnail,
            source: "sc",
            requestedBy: interaction.user,
          }));
        }

      // ── YouTube video ──
      } else if (play.yt_validate(query) === "video") {
        const info = (await play.video_info(query)).video_details;
        songs.push({
          title: info.title,
          url: info.url,
          duration: info.durationRaw,
          thumbnail: info.thumbnails?.[0]?.url,
          source: "yt",
          requestedBy: interaction.user,
        });

      // ── YouTube playlist ──
      } else if (play.yt_validate(query) === "playlist") {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        songs = videos.slice(0, 100).map((v) => ({
          title: v.title,
          url: v.url,
          duration: v.durationRaw,
          thumbnail: v.thumbnails?.[0]?.url,
          source: "yt",
          requestedBy: interaction.user,
        }));

      // ── Search YouTube / SoundCloud / Spotify ──
      } else {
        songs = await searchAcrossSources(query, interaction.user);
        if (!songs.length) {
          return interaction.editReply({ embeds: [errorEmbed("No results found!")] });
        }
      }

      if (!songs.length) {
        return interaction.editReply({ embeds: [errorEmbed("Could not find any songs!")] });
      }

      const wasEmpty = queue.songs.length === 0;
      queue.songs.push(...songs);

      if (wasEmpty) {
        queue.connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        await interaction.editReply({
          embeds: [infoEmbed("🎵 Starting Playback", `Loading **${songs.length}** song(s)...`)],
        });
        playSong(queue);
      } else {
        if (songs.length === 1) {
          await interaction.editReply({ embeds: [addedToQueueEmbed(songs[0], queue.songs.length)] });
        } else {
          await interaction.editReply({
            embeds: [infoEmbed("✅ Added to Queue", `Added **${songs.length}** songs`)],
          });
        }
      }
    } catch (error) {
      console.error("Play error:", error);
      await interaction.editReply({
        embeds: [errorEmbed("Failed to play. Try a different link or search term.")],
      });
    }
  },
};

// ═══════════════════════════════════════════
//  /skip
// ═══════════════════════════════════════════
const skipCmd = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.playing) return interaction.reply({ embeds: [errorEmbed("Nothing is playing!")], ephemeral: true });
    queue.loopSingle = false;
    queue.player.stop();
    await interaction.reply({ embeds: [infoEmbed("⏭️ Skipped", "Playing next song...")] });
  },
};

// ═══════════════════════════════════════════
//  /stop
// ═══════════════════════════════════════════
const stopCmd = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stop playback and clear the queue"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [errorEmbed("Nothing is playing!")], ephemeral: true });
    queue.songs = [];
    queue.player?.stop();
    queue.connection?.destroy();
    client.queues.delete(interaction.guildId);
    await interaction.reply({ embeds: [infoEmbed("⏹️ Stopped", "Music stopped and queue cleared.")] });
  },
};

// ═══════════════════════════════════════════
//  /queue
// ═══════════════════════════════════════════
const queueCmd = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Show the current queue"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.songs.length) return interaction.reply({ embeds: [errorEmbed("The queue is empty!")], ephemeral: true });
    await interaction.reply({ embeds: [queueEmbed(queue.songs)] });
  },
};

// ═══════════════════════════════════════════
//  /pause
// ═══════════════════════════════════════════
const pauseCmd = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current song"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.playing) return interaction.reply({ embeds: [errorEmbed("Nothing is playing!")], ephemeral: true });
    queue.player.pause();
    await interaction.reply({ embeds: [infoEmbed("⏸️ Paused", "Use `/resume` to continue.")] });
  },
};

// ═══════════════════════════════════════════
//  /resume
// ═══════════════════════════════════════════
const resumeCmd = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume paused music"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.player) return interaction.reply({ embeds: [errorEmbed("Nothing to resume!")], ephemeral: true });
    queue.player.unpause();
    await interaction.reply({ embeds: [infoEmbed("▶️ Resumed", "Music resumed!")] });
  },
};

// ═══════════════════════════════════════════
//  /loop — off / queue / single
// ═══════════════════════════════════════════
const loopCmd = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode")
    .addStringOption((o) =>
      o.setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Queue", value: "queue" },
          { name: "Single Song", value: "single" }
        )
    ),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [errorEmbed("Nothing is playing!")], ephemeral: true });

    const mode = interaction.options.getString("mode");
    if (mode === "off") {
      queue.loop = false;
      queue.loopSingle = false;
      await interaction.reply({ embeds: [infoEmbed("➡️ Loop Off", "Looping is disabled.")] });
    } else if (mode === "queue") {
      queue.loop = true;
      queue.loopSingle = false;
      await interaction.reply({ embeds: [infoEmbed("🔁 Queue Loop", "The entire queue will loop.")] });
    } else {
      queue.loop = false;
      queue.loopSingle = true;
      await interaction.reply({ embeds: [infoEmbed("🔂 Single Loop", "Current song will repeat.")] });
    }
  },
};

// ═══════════════════════════════════════════
//  /nowplaying
// ═══════════════════════════════════════════
const npCmd = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current song"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.songs.length) return interaction.reply({ embeds: [errorEmbed("Nothing is playing!")], ephemeral: true });
    await interaction.reply({ embeds: [nowPlayingEmbed(queue.songs[0], queue.filters)] });
  },
};

// ═══════════════════════════════════════════
//  /filter — toggle audio filters
// ═══════════════════════════════════════════
const filterCmd = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Toggle an audio filter")
    .addStringOption((o) =>
      o.setName("name")
        .setDescription("Filter to toggle")
        .setRequired(true)
        .addChoices(
          { name: "🔊 Bass Boost", value: "bassboost" },
          { name: "🎧 8D Audio", value: "eightd" },
          { name: "🎤 Karaoke", value: "karaoke" },
          { name: "💥 Distortion", value: "distortion" },
          { name: "〰️ Tremolo", value: "tremolo" }
        )
    ),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    if (!queue?.songs.length) return interaction.reply({ embeds: [errorEmbed("Nothing is playing!")], ephemeral: true });

    const name = interaction.options.getString("name");
    queue.filters[name] = !queue.filters[name];

    await interaction.reply({
      embeds: [
        infoEmbed(
          queue.filters[name] ? `✅ ${name} Enabled` : `⬛ ${name} Disabled`,
          "The filter will apply on the **next song**. Use `/skip` to hear it now."
        ),
      ],
    });
  },
};

// ═══════════════════════════════════════════
//  /filters — show all filter states
// ═══════════════════════════════════════════
const filtersCmd = {
  data: new SlashCommandBuilder().setName("filters").setDescription("Show all audio filters"),
  async execute(interaction, client) {
    const queue = client.queues.get(interaction.guildId);
    const filters = queue?.filters || {
      bassboost: false,
      eightd: false,
      karaoke: false,
      distortion: false,
      tremolo: false,
    };
    await interaction.reply({ embeds: [filterEmbed(filters)] });
  },
};

// ═══════════════════════════════════════════
//  /lyrics — fetch lyrics for current song
// ═══════════════════════════════════════════
const lyricsCmd = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Show lyrics for the current song or a search query")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song to search lyrics for (leave empty for current song)").setRequired(false)
    ),
  async execute(interaction, client) {
    await interaction.deferReply();

    let searchQuery = interaction.options.getString("query");

    if (!searchQuery) {
      const queue = client.queues.get(interaction.guildId);
      if (!queue?.songs.length) {
        return interaction.editReply({ embeds: [errorEmbed("Nothing is playing! Provide a song name to search.")] });
      }
      searchQuery = queue.songs[0].title;
    }

    const result = await fetchLyrics(searchQuery);
    if (!result) {
      return interaction.editReply({ embeds: [errorEmbed(`No lyrics found for: **${searchQuery}**`)] });
    }

    await interaction.editReply({ embeds: [lyricsEmbed(result.title, result.lyrics)] });
  },
};

// ═══════════════════════════════════════════
//  /lock — lock bot to current channel
// ═══════════════════════════════════════════
const lockCmd = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock this bot to the current text channel (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, client) {
    client.channelLocks.set(interaction.guildId, interaction.channelId);
    await interaction.reply({ embeds: [lockEmbed(interaction.channelId, true)] });
  },
};

// ═══════════════════════════════════════════
//  /unlock — remove channel lock
// ═══════════════════════════════════════════
const unlockCmd = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock this bot so it can be used in any channel (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, client) {
    client.channelLocks.delete(interaction.guildId);
    await interaction.reply({ embeds: [lockEmbed(null, false)] });
  },
};

// ═══════════════════════════════════════════
//  Register all
// ═══════════════════════════════════════════
const allCommands = [
  playCmd, skipCmd, stopCmd, queueCmd,
  pauseCmd, resumeCmd, loopCmd, npCmd,
  filterCmd, filtersCmd, lyricsCmd,
  lockCmd, unlockCmd,
];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

const slashCommands = allCommands.map((c) => c.data.toJSON());

// ── Helpers ──
function formatDuration(ms) {
  if (!ms) return "Unknown";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function makeSong(sp, source, user) {
  return {
    title: `${sp.name} - ${sp.artists?.map((a) => a.name).join(", ") || "Unknown"}`,
    url: sp.url,
    duration: formatDuration(sp.durationInMs),
    thumbnail: sp.thumbnail?.url,
    source,
    requestedBy: user,
  };
}

async function searchAcrossSources(query, requestedBy) {
  try {
    const results = await searchSong(query, requestedBy);
    if (results?.length) {
      return results;
    }
  } catch (err) {
    console.error("Search failed:", err?.message ?? err);
  }

  return [];
}

module.exports = { commands, slashCommands };
