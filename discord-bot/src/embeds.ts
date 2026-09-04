import { EmbedBuilder } from "discord.js";

export const BLACK = 0x000000;
export const BRAND = "N7 Music";

export const embed = (title: string, description?: string): EmbedBuilder => {
  const message = new EmbedBuilder().setColor(BLACK).setTitle(title);

  if (description) {
    message.setDescription(description);
  }

  return message.setFooter({ text: BRAND });
};

export const errorEmbed = (message: string): EmbedBuilder =>
  embed("Something went wrong", message);

export const successEmbed = (title: string, message: string): EmbedBuilder =>
  embed(title, message);

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "LIVE";
  }

  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const truncate = (value: string, length = 80): string =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;