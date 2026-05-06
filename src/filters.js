/**
 * Audio filter pipeline using FFmpeg via prism-media.
 *
 * Each filter maps to an FFmpeg audio filter string.
 * Multiple filters are chained together.
 */
const prism = require("prism-media");
const { StreamType } = require("@discordjs/voice");

const FILTER_MAP = {
  bassboost: "bass=g=15,dynaudnorm=f=200",
  eightd: "apulsator=hz=0.09",
  karaoke: "stereotools=mlev=0.03",
  distortion: "aeval=val(0)*1.5:c=same,acrusher=bits=8:mode=log:aa=1",
  tremolo: "tremolo=f=6:d=0.5",
};

/**
 * Wraps an input stream through FFmpeg with the requested filters,
 * outputting Opus in OGG container for Discord.
 */
function applyFFmpegFilters(inputStream, inputType, activeFilters) {
  const filterChain = activeFilters
    .map((f) => FILTER_MAP[f])
    .filter(Boolean)
    .join(",");

  const inputArgs = [];

  // Determine input format flags
  if (inputType === StreamType.WebmOpus || inputType === StreamType.OggOpus) {
    // Already encoded — let FFmpeg auto-detect
  }

  const ffmpeg = new prism.FFmpeg({
    args: [
      "-analyzeduration", "0",
      "-loglevel", "0",
      "-i", "pipe:0",
      "-af", filterChain || "anull",
      "-f", "opus",
      "-ar", "48000",
      "-ac", "2",
      "pipe:1",
    ],
  });

  inputStream.pipe(ffmpeg);
  return ffmpeg;
}

module.exports = { applyFFmpegFilters, FILTER_MAP };
