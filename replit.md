# Midnight Music

A Render-ready Discord music bot with slash-command playback, queues, looping, volume controls, and black embedded responses.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/discord-bot run dev` — run the Discord bot locally
- `pnpm --filter @workspace/discord-bot run typecheck` — typecheck the Discord bot
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Bot: Discord.js, Discord Player, FFmpeg Static, Express health endpoint

## Where things live

- `discord-bot/src/index.ts` — Discord client, slash commands, queue handling, and player events
- `discord-bot/src/commands.ts` — slash-command definitions
- `discord-bot/src/embeds.ts` — shared black embed styling and formatting helpers
- `discord-bot/src/health.ts` — Render health endpoint
- `README.md` — setup, Discord permissions, local development, and Render deployment guide
- `render.yaml` — Render Web Service configuration

## Architecture decisions

- The bot runs as a long-lived Node service with a small HTTP health server so Render can monitor it.
- `DISCORD_GUILD_ID` is optional: use it for instant command registration during development, then omit it for global commands.
- FFmpeg is provided by the `ffmpeg-static` package so the Render service does not depend on a manually installed system binary.
- All bot responses use a shared black embed helper for consistent visual identity.

## Product

Midnight Music plays searchable songs in Discord voice channels, maintains a per-server queue, and provides pause, resume, skip, volume, loop, now-playing, stop, leave, and feature-discovery commands.

## User preferences

- The user requested black embedded command messages, clear documentation, the attached logo in the README, and Render hosting guidance.

## Gotchas

- The Discord bot token must be stored as a secret and must never be committed.
- The bot needs the `Connect`, `Speak`, and `Use Voice Activity` permissions in voice channels.
- Global slash-command updates can take time to appear; set `DISCORD_GUILD_ID` for a development server.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
