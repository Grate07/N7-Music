import { REST, Routes, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { Client, GatewayIntentBits, Events, ChannelType } from "discord.js";
import { Player, QueryType, QueueRepeatMode } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import ffmpegPath from "ffmpeg-static";
import { commands } from "./commands.js";
import { config } from "./config.js";
import {
  embed,
  errorEmbed,
  formatDuration,
  successEmbed,
  truncate,
} from "./embeds.js";
import { startHealthServer } from "./health.js";

const resolvedFfmpegPath = ffmpegPath as unknown as string | null;

if (resolvedFfmpegPath) {
  process.env.FFMPEG_PATH = resolvedFfmpegPath;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const player = new Player(client as never);
let isReady = false;

const reply = async (
  interaction: ChatInputCommandInteraction,
  message: ReturnType<typeof embed>,
): Promise<void> => {
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [message] });
  } else {
    await interaction.reply({ embeds: [message] });
  }
};

const getMemberVoiceChannel = (interaction: ChatInputCommandInteraction) => {
  const member = interaction.member as GuildMember | null;
  const channel = member?.voice.channel;

  if (!channel || channel.type !== ChannelType.GuildVoice) {
    return null;
  }

  return channel;
};

const sameVoiceChannel = (
  interaction: ChatInputCommandInteraction,
  queue: ReturnType<typeof player.nodes.create>,
): boolean => {
  const member = interaction.member as GuildMember | null;
  const botChannel = queue.connection?.joinConfig.channelId;

  return Boolean(member?.voice.channelId && botChannel === member.voice.channelId);
};

const featuresMessage = embed(
  "Midnight Music",
  "A focused music bot for servers that want clean controls and reliable playback.",
)
  .addFields(
    {
      name: "Playback",
      value: "`/play` searches for a song or accepts a supported URL. Add more songs while one is playing.",
      inline: false,
    },
    {
      name: "Queue controls",
      value:
        "`/queue` shows upcoming songs, `/nowplaying` shows the current track, and `/skip` moves forward.",
      inline: false,
    },
    {
      name: "Player controls",
      value:
        "`/pause`, `/resume`, `/volume`, and `/loop` give you control without leaving Discord.",
      inline: false,
    },
    {
      name: "Cleanup",
      value: "`/stop` clears playback. `/leave` disconnects the bot and clears the queue.",
      inline: false,
    },
  )
  .setTimestamp();

const registerCommands = async (applicationId: string): Promise<void> => {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(applicationId, config.guildId)
    : Routes.applicationCommands(applicationId);

  await rest.put(route, { body: commands });
  console.info(
    config.guildId
      ? `Registered ${commands.length} slash commands in guild ${config.guildId}.`
      : `Registered ${commands.length} global slash commands.`,
  );
};

client.once(Events.ClientReady, async (readyClient) => {
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    await registerCommands(readyClient.user.id);
    isReady = true;
    console.info(`Logged in as ${readyClient.user.tag}.`);
  } catch (error) {
    console.error("Bot startup failed:", error);
    process.exitCode = 1;
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    if (interaction.commandName === "features") {
      await interaction.reply({ embeds: [featuresMessage] });
      return;
    }

    if (!interaction.guildId) {
      await reply(interaction, errorEmbed("These commands can only be used inside a server."));
      return;
    }

    if (interaction.commandName === "play") {
      const voiceChannel = getMemberVoiceChannel(interaction);
      if (!voiceChannel) {
        await reply(
          interaction,
          errorEmbed("Join a voice channel first, then run `/play` again."),
        );
        return;
      }

      await interaction.deferReply();
      const query = interaction.options.getString("query", true);
      const queue = player.nodes.create(interaction.guildId, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30_000,
      });

      if (queue.connection && !sameVoiceChannel(interaction, queue)) {
        await reply(
          interaction,
          errorEmbed("I am already playing in another voice channel in this server."),
        );
        return;
      }

      if (!queue.connection) {
        await queue.connect(voiceChannel as never);
      }

      const result = await player.search(query, {
        requestedBy: interaction.user.id,
        searchEngine: QueryType.AUTO,
      });

      if (!result.hasTracks()) {
        await reply(interaction, errorEmbed("I could not find a playable result for that query."));
        return;
      }

      const track = result.tracks[0];
      queue.addTrack(track);

      if (!queue.node.isPlaying() && !queue.node.isPaused()) {
        await queue.node.play();
      }

      await reply(
        interaction,
        successEmbed(
          queue.node.isPlaying() ? "Added to the queue" : "Ready to play",
          `[${truncate(track.title)}](${track.url}) by **${truncate(track.author, 60)}**\nDuration: \`${formatDuration(track.durationMS / 1000)}\``,
        ).setThumbnail(track.thumbnail),
      );
      return;
    }

    const queue = player.nodes.get(interaction.guildId);
    if (!queue) {
      await reply(interaction, errorEmbed("There is no active player in this server."));
      return;
    }

    if (interaction.commandName === "skip") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      await queue.node.skip();
      await reply(interaction, successEmbed("Skipped", "Moving to the next song."));
      return;
    }

    if (interaction.commandName === "pause") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      queue.node.setPaused(true);
      await reply(interaction, successEmbed("Paused", "Playback is paused."));
      return;
    }

    if (interaction.commandName === "resume") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      queue.node.setPaused(false);
      await reply(interaction, successEmbed("Resumed", "Playback is moving again."));
      return;
    }

    if (interaction.commandName === "stop") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      queue.delete();
      await reply(interaction, successEmbed("Stopped", "Playback stopped and the queue was cleared."));
      return;
    }

    if (interaction.commandName === "leave") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      queue.delete();
      await reply(interaction, successEmbed("Disconnected", "I left the voice channel."));
      return;
    }

    if (interaction.commandName === "queue") {
      const current = queue.currentTrack;
      const tracks = queue.tracks.toArray();
      const upcoming =
        tracks.length > 0
          ? tracks
              .slice(0, 10)
              .map(
                (track, index) =>
                  `**${index + 1}.** ${truncate(track.title)} · \`${formatDuration(track.durationMS / 1000)}\``,
              )
              .join("\n")
          : "No more songs are queued.";

      await reply(
        interaction,
        embed("Current queue", current ? `Now playing: **${truncate(current.title)}**` : undefined)
          .addFields({ name: "Up next", value: upcoming })
          .setTimestamp(),
      );
      return;
    }

    if (interaction.commandName === "nowplaying") {
      const track = queue.currentTrack;
      if (!track) {
        await reply(interaction, errorEmbed("Nothing is playing right now."));
        return;
      }

      await reply(
        interaction,
        embed("Now playing", `[${track.title}](${track.url}) by **${track.author}**`)
          .addFields({
            name: "Duration",
            value: `\`${formatDuration(track.durationMS / 1000)}\``,
            inline: true,
          })
          .setThumbnail(track.thumbnail)
          .setTimestamp(),
      );
      return;
    }

    if (interaction.commandName === "volume") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      const level = interaction.options.getInteger("level", true);
      queue.node.setVolume(level);
      await reply(interaction, successEmbed("Volume updated", `Playback volume is now **${level}%**.`));
      return;
    }

    if (interaction.commandName === "loop") {
      if (!sameVoiceChannel(interaction, queue)) {
        await reply(interaction, errorEmbed("Join my voice channel to control playback."));
        return;
      }
      const mode = interaction.options.getString("mode", true);
      const repeatMode =
        mode === "track"
          ? QueueRepeatMode.TRACK
          : mode === "queue"
            ? QueueRepeatMode.QUEUE
            : QueueRepeatMode.OFF;
      queue.setRepeatMode(repeatMode);
      const label = mode === "track" ? "current song" : mode === "queue" ? "queue" : "off";
      await reply(interaction, successEmbed("Loop mode updated", `Looping is now **${label}**.`));
    }
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, error);
    const message = errorEmbed(
      "I could not complete that command. Check that I can connect to the voice channel and try again.",
    );

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [message] });
    } else {
      await interaction.reply({ embeds: [message] });
    }
  }
});

player.events.on("error", (queue, error) => {
  console.error(`Player error in guild ${queue.guild.id}:`, error);
});

player.events.on("playerError", (queue, error) => {
  console.error(`Track error in guild ${queue.guild.id}:`, error);
});

startHealthServer(config.port, () => isReady);

const shutdown = async (signal: string): Promise<void> => {
  console.info(`Received ${signal}; shutting down.`);
  await client.destroy();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void client.login(config.token).catch((error: unknown) => {
  console.error("Discord login failed:", error);
  process.exitCode = 1;
});