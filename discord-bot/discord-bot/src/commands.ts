import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or add it to the queue")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("A song title, artist, or supported URL")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),
  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause the current song"),
  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume the current song"),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback and clear the queue"),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Disconnect the bot from the voice channel"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue"),
  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the song currently playing"),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the playback volume from 1 to 100")
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("Volume percentage")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Change the loop mode")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("Repeat one song, the full queue, or turn looping off")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Current song", value: "track" },
          { name: "Queue", value: "queue" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("features")
    .setDescription("Learn what N7 Music can do"),
].map((command) => command.toJSON());