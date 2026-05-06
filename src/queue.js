class MusicQueue {
  constructor() {
    this.songs = [];
    this.playing = false;
    this.connection = null;
    this.player = null;
    this.resource = null;
    this.textChannel = null;
    this.voiceChannel = null;
    this.loop = false;
    this.loopSingle = false;
    this.volume = 100;
    this.filters = {
      bassboost: false,
      eightd: false,
      karaoke: false,
      distortion: false,
      tremolo: false,
    };
  }
}

module.exports = { MusicQueue };
