import { EmbedBuilder } from "discord.js";

export const BRAND_COLOR = 0x5865f2;
export const SUCCESS_COLOR = 0x22c55e;
export const ERROR_COLOR = 0xef4444;
export const NOW_PLAYING_COLOR = 0x8b5cf6;
export const COMPACT_EMBED_COLOR = 0x2b2d31;
export const BRAND = "N7 Music";
const FOOTER = "N7 Music • high-fidelity playback";

export const embed = (title: string, description?: string): EmbedBuilder => {
  const message = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: BRAND })
    .setTitle(title)
    .setFooter({ text: FOOTER });

  if (description) {
    message.setDescription(description);
  }

  return message;
};

export const errorEmbed = (message: string): EmbedBuilder =>
  embed("Something went wrong", message).setColor(ERROR_COLOR);

export const successEmbed = (title: string, message: string): EmbedBuilder =>
  embed(title, message).setColor(SUCCESS_COLOR);

export const compactEmbed = (title: string): EmbedBuilder =>
  new EmbedBuilder().setColor(COMPACT_EMBED_COLOR).setTitle(title);

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "LIVE";
  }

  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const formatLongDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "LIVE";
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
};

export const truncate = (value: string, length = 80): string =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;