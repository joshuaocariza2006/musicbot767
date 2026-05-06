/**
 * Multi-instance launcher — starts up to 4 bot instances from separate tokens.
 * Usage: node src/launcher.js
 */
require("dotenv").config();
const { fork } = require("child_process");
const path = require("path");

const tokens = [
  process.env.BOT_TOKEN_1,
  process.env.BOT_TOKEN_2,
  process.env.BOT_TOKEN_3,
  process.env.BOT_TOKEN_4,
].filter(Boolean);

if (!tokens.length) {
  console.error("❌ No bot tokens found. Set BOT_TOKEN_1 in your .env file.");
  process.exit(1);
}

console.log(`🚀 Launching ${tokens.length} bot instance(s)...\n`);

tokens.forEach((token, i) => {
  const child = fork(path.join(__dirname, "index.js"), [], {
    env: {
      ...process.env,
      DISCORD_TOKEN: token,
      INSTANCE_ID: String(i + 1),
    },
  });

  child.on("exit", (code) => {
    console.log(`⚠️  Instance #${i + 1} exited with code ${code}`);
  });
});
