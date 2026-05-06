const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} = require("@discordjs/voice");
const play = require("play-dl");
const { nowPlayingEmbed } = require("./embeds");
const { applyFFmpegFilters } = require("./filters");

async function playSong(queue) {
  if (!queue.songs.length) {
    queue.connection?.destroy();
    queue.playing = false;
    return;
  }

  const song = queue.songs[0];

  try {
    let streamUrl = song.url;

    // For Spotify songs, search YouTube
    if (song.source === "sp") {
      let searched = await play.search(song.title, { limit: 1, source: "youtube" });
      if (!searched?.length) {
        searched = await play.search(song.title, { limit: 1, source: "yt_search" });
      }
      if (!searched?.length) {
        queue.songs.shift();
        queue.textChannel?.send({
          content: `⚠️ Could not find a source for: **${song.title}**`,
        });
        return playSong(queue);
      }
      if (!searched[0]?.url) {
        queue.songs.shift();
        console.warn(`Invalid result for: ${song.title}`);
        return playSong(queue);
      }
      streamUrl = searched[0].url;
    }

    // Check if any filters are active
    const activeFilters = Object.entries(queue.filters).filter(([, v]) => v).map(([k]) => k);

    let resource;

    if (activeFilters.length > 0) {
      // Use FFmpeg for audio filters
      const stream = await play.stream(streamUrl);
      const ffmpegStream = applyFFmpegFilters(stream.stream, stream.type, activeFilters);
      resource = createAudioResource(ffmpegStream, {
        inputType: StreamType.OggOpus,
      });
    } else {
      const stream = await play.stream(streamUrl);
      resource = createAudioResource(stream.stream, {
        inputType: stream.type,
      });
    }

    if (!queue.player) {
      queue.player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });

      queue.player.on(AudioPlayerStatus.Idle, () => {
        if (queue.loopSingle) {
          // Replay same song
        } else if (queue.loop) {
          queue.songs.push(queue.songs[0]);
          queue.songs.shift();
        } else {
          queue.songs.shift();
        }
        playSong(queue);
      });

      queue.player.on("error", (error) => {
        console.error("Player error:", error.message);
        queue.songs.shift();
        playSong(queue);
      });

      queue.connection.subscribe(queue.player);
    }

    queue.player.play(resource);
    queue.resource = resource;
    queue.playing = true;

    queue.textChannel?.send({ embeds: [nowPlayingEmbed(song, queue.filters)] });
  } catch (error) {
    console.error("Play error:", error.message);
    queue.songs.shift();
    playSong(queue);
  }
}

module.exports = { playSong };
