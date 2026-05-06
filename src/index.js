require("dotenv").config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");
const { commands, slashCommands } = require("./commands");

const INSTANCE_ID = process.env.INSTANCE_ID || "1";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

// Per-guild music queues
client.queues = new Collection();
// Per-guild channel locks: guildId -> channelId
client.channelLocks = new Collection();
// Instance identifier
client.instanceId = INSTANCE_ID;

client.once("clientReady", async () => {
  console.log(`✅ Instance #${INSTANCE_ID} logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: slashCommands,
    });
    console.log(`✅ Instance #${INSTANCE_ID}: Slash commands registered`);
  } catch (err) {
    console.error(`Instance #${INSTANCE_ID}: Failed to register commands:`, err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ── Channel lock check ──
  const lockedChannel = client.channelLocks.get(interaction.guildId);
  if (lockedChannel && interaction.channelId !== lockedChannel) {
    // Allow /unlock from any channel so admins can fix it
    if (interaction.commandName !== "unlock") {
      return interaction.reply({
        content: `🔒 This bot is locked to <#${lockedChannel}>. Use commands there, or an admin can \`/unlock\`.`,
        ephemeral: true,
      });
    }
  }

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Instance #${INSTANCE_ID}:`, error);
    const msg = {
      content: "❌ An error occurred running this command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
