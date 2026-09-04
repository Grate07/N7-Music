import "dotenv/config";

const required = (key: string): string => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const config = {
  token: required("DISCORD_TOKEN"),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || undefined,
  port: Number.parseInt(process.env.PORT ?? "10000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
};