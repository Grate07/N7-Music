import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { Player, QueryType, QueueRepeatMode } from "discord-player";
import { DefaultExtractors, SpotifyExtractor } from "@discord-player/extractor";
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
  components: ActionRowBuilder<ButtonBuilder>[] = [],
): Promise<void> => {
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [message], components });
  } else {
    await interaction.reply({ embeds: [message], components });
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

type MusicQueue = ReturnType<typeof player.nodes.create>;

const controlPanel = (queue: MusicQueue): ActionRowBuilder<ButtonBuilder>[] => {
  const loopLabel =
    queue.repeatMode === QueueRepeatMode.TRACK
      ? "Loop song"
      : queue.repeatMode === QueueRepeatMode.QUEUE
        ? "Loop queue"
        : "Loop";

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("n7:previous")
        .setEmoji("⏮️")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("n7:pause")
        .setEmoji(queue.node.isPaused() ? "▶️" : "⏸️")
        .setLabel(queue.node.isPaused() ? "Resume" : "Pause")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("n7:skip")
        .setEmoji("⏭️")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("n7:queue")
        .setEmoji("🎼")
        .setLabel("Queue")
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("n7:stop")
        .setEmoji("⏹️")
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("n7:loop")
        .setEmoji("🔁")
        .setLabel(loopLabel)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("n7:shuffle")
        .setEmoji("🔀")
        .setLabel(queue.isShuffling ? "Shuffle on" : "Shuffle")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("n7:autoplay")
        .setEmoji("♻️")
        .setLabel(queue.repeatMode === QueueRepeatMode.AUTOPLAY ? "Autoplay on" : "Autoplay")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
};

const nowPlayingEmbed = (queue: MusicQueue) => {
  const track = queue.currentTrack;
  if (!track) {
    return errorEmbed("Nothing is playing right now.");
  }

  const requester = track.requestedBy
    ? `<@${track.requestedBy.id}> (${track.requestedBy.username})`
    : "N7 Music";
  const status = queue.node.isPaused() ? "Paused" : "Playing";

  return embed(
    `Now Playing · ${status}`,
    `🟢 [${truncate(track.title)}](${track.url}) — **${truncate(track.author, 60)}**`,
  )
    .addFields(
      {
        name: "Duration",
        value: `\`${formatDuration(track.durationMS / 1000)}\``,
        inline: true,
      },
      {
        name: "Requested by",
        value: requester,
        inline: false,
      },
    )
    .setThumbnail(track.thumbnail)
    .setTimestamp();
};

const searchEngineForSource = (source: string, query: string) => {
  if (/^https?:\/\//i.test(query)) {
    return QueryType.AUTO;
  }

  switch (source) {
    case "spotify":
      return QueryType.SPOTIFY_SEARCH;
    case "youtube":
      return QueryType.YOUTUBE_SEARCH;
    case "soundcloud":
      return QueryType.SOUNDCLOUD_SEARCH;
    default:
      return QueryType.AUTO_SEARCH;
  }
};

const queueSummary = (queue: MusicQueue) => {
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

  return embed("Current queue", current ? `Now playing: **${truncate(current.title)}**` : undefined)
    .addFields({ name: "Up next", value: upcoming })
    .setTimestamp();
};

const updatePresence = (queue: MusicQueue): void => {
  const track = queue.currentTrack;
  client.user?.setActivity(track ? track.title : "your music", {
    type: track ? ActivityType.Listening : ActivityType.Watching,
  });
};

const memberControlsQueue = (
  interaction: ButtonInteraction,
  queue: MusicQueue,
): boolean => {
  const member = interaction.member as GuildMember | null;
  const memberChannelId = member?.voice.channelId;
  const botChannelId = queue.connection?.joinConfig.channelId;

  return Boolean(memberChannelId && botChannelId && memberChannelId === botChannelId);
};

const handleControlButton = async (interaction: ButtonInteraction): Promise<void> => {
  if (!interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("These controls only work inside a server.")], ephemeral: true });
    return;
  }

  const queue = player.nodes.get(interaction.guildId);
  if (!queue) {
    await interaction.reply({ embeds: [errorEmbed("There is no active player in this server.")], ephemeral: true });
    return;
  }

  if (interaction.customId === "n7:queue") {
    await interaction.reply({ embeds: [queueSummary(queue)], ephemeral: true });
    return;
  }

  if (!memberControlsQueue(interaction, queue)) {
    await interaction.reply({
      embeds: [errorEmbed("Join my voice channel to use these controls.")],
      ephemeral: true,
    });
    return;
  }

  switch (interaction.customId) {
    case "n7:previous":
      if (!queue.history.previousTrack) {
        await interaction.reply({
          embeds: [errorEmbed("There is no previous track in the history.")],
          ephemeral: true,
        });
        return;
      }
      await interaction.deferUpdate();
      await queue.history.previous();
      return;
    case "n7:pause":
      queue.node.setPaused(!queue.node.isPaused());
      await interaction.update({
        embeds: [nowPlayingEmbed(queue)],
        components: controlPanel(queue),
      });
      return;
    case "n7:skip":
      await interaction.deferUpdate();
      await queue.node.skip();
      return;
    case "n7:stop":
      queue.delete();
      client.user?.setActivity("your music", { type: ActivityType.Watching });
      await interaction.update({
        embeds: [successEmbed("Stopped", "Playback stopped and the queue was cleared.")],
        components: [],
      });
      return;
    case "n7:loop": {
      const nextMode =
        queue.repeatMode === QueueRepeatMode.OFF
          ? QueueRepeatMode.TRACK
          : queue.repeatMode === QueueRepeatMode.TRACK
            ? QueueRepeatMode.QUEUE
            : QueueRepeatMode.OFF;
      queue.setRepeatMode(nextMode);
      await interaction.update({
        embeds: [nowPlayingEmbed(queue)],
        components: controlPanel(queue),
      });
      return;
    }
    case "n7:shuffle":
      queue.toggleShuffle(true);
      await interaction.update({
        embeds: [nowPlayingEmbed(queue)],
        components: controlPanel(queue),
      });
      return;
    case "n7:autoplay":
      queue.setRepeatMode(
        queue.repeatMode === QueueRepeatMode.AUTOPLAY
          ? QueueRepeatMode.OFF
          : QueueRepeatMode.AUTOPLAY,
      );
      await interaction.update({
        embeds: [nowPlayingEmbed(queue)],
        components: controlPanel(queue),
      });
      return;
    default:
      await interaction.reply({ embeds: [errorEmbed("That control is no longer available.")], ephemeral: true });
  }
};

const featuresMessage = embed(
  "N7 Music",
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
      name: "Spotify support",
      value:
        "Paste a public Spotify track, album, or playlist link into `/play`; N7 Music will resolve it and queue the matching tracks.",
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
    await player.extractors.loadMulti(DefaultExtractors, {
      "com.discord-player.applemusicextractor": undefined,
      "com.discord-player.attachmentextractor": undefined,
      "com.discord-player.reverbnationextractor": undefined,
      "com.discord-player.soundcloudextractor": undefined,
      [SpotifyExtractor.identifier]: {
        clientId: config.spotifyClientId,
        clientSecret: config.spotifyClientSecret,
      },
      "com.discord-player.vimeoextractor": undefined,
    });
    await registerCommands(readyClient.user.id);
    isReady = true;
    console.info(`Logged in as ${readyClient.user.tag}.`);
  } catch (error) {
    console.error("Bot startup failed:", error);
    process.exitCode = 1;
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      await handleControlButton(interaction);
    } catch (error) {
      console.error(`Control ${interaction.customId} failed:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed("I could not complete that control.")],
          ephemeral: true,
        });
      }
    }
    return;
  }

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
      const source = interaction.options.getString("source") ?? "auto";
      const queue = player.nodes.create(interaction.guildId, {
        metadata: { channel: interaction.channel },
        // Keep the source at full volume; the channel bitrate is applied when
        // the Discord voice dispatcher is created.
        volume: 100,
        leaveOnEnd: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30_000,
        bufferingTimeout: 30_000,
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
        searchEngine: searchEngineForSource(source, query),
      });

      if (!result.hasTracks()) {
        await reply(interaction, errorEmbed("I could not find a playable result for that query."));
        return;
      }

      const firstTrack = result.tracks[0];
      const tracksToQueue = result.playlist ? result.tracks : [firstTrack];
      queue.addTrack(tracksToQueue);

      if (!queue.node.isPlaying() && !queue.node.isPaused()) {
        await queue.node.play();
      }

      const playlistLabel = result.playlist
        ? `\n\n**${tracksToQueue.length} tracks** from **${truncate(result.playlist.title, 100)}** added to the queue.`
        : "";
      const requestedBy = `<@${interaction.user.id}> (${interaction.user.username})`;

      await reply(
        interaction,
        successEmbed(
          "Added to Queue",
          `🟢 [${truncate(firstTrack.title)}](${firstTrack.url}) — **${truncate(firstTrack.author, 60)}**${playlistLabel}`,
        )
          .addFields(
            {
              name: "Duration",
              value: `\`${formatDuration(firstTrack.durationMS / 1000)}\``,
              inline: true,
            },
            {
              name: "Requested by",
              value: requestedBy,
              inline: false,
            },
          )
          .setThumbnail(firstTrack.thumbnail)
          .setTimestamp(),
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
      await reply(interaction, queueSummary(queue));
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
        nowPlayingEmbed(queue),
        controlPanel(queue),
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

player.events.on("playerStart", async (queue) => {
  // "auto" uses the voice channel's negotiated bitrate instead of the
  // library's conservative 64 kbps fallback.
  queue.node.setBitrate("auto");
  updatePresence(queue);

  const channel = queue.metadata?.channel;
  if (channel && "send" in channel && typeof channel.send === "function") {
    await channel.send({
      embeds: [nowPlayingEmbed(queue)],
      components: controlPanel(queue),
    });
  }
});

player.events.on("queueDelete", () => {
  client.user?.setActivity("your music", { type: ActivityType.Watching });
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