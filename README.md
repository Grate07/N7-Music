# N7 Music

![N7 Music logo](discord-bot/docs/logo.gif)

N7 Music is a Discord music bot built for clean, reliable voice-channel playback. Every command response uses a black Discord embed, and the bot is designed to run as a long-lived Render Web Service with a health endpoint.

## Features

- Search for a song by title, artist, or supported URL with `/play`
- Per-server playback queues
- Pause and resume playback
- Skip the current track
- View the current queue or the now-playing track
- Set volume from 1% to 100%
- Repeat the current track, repeat the full queue, or turn looping off
- Stop playback, clear the queue, or disconnect with `/stop` and `/leave`
- Discover the full feature list inside Discord with `/features`
- Consistent black embeds with helpful error messages
- Built-in `/health` endpoint for Render monitoring
- FFmpeg bundled through `ffmpeg-static`, so no manual server package install is needed

## Slash commands

| Command | What it does |
| --- | --- |
| `/play query:<song or URL>` | Joins your voice channel and plays or queues the first playable result |
| `/skip` | Skips to the next queued track |
| `/pause` | Pauses the current track |
| `/resume` | Resumes paused playback |
| `/queue` | Shows the current track and up to the next 10 queued tracks |
| `/nowplaying` | Shows the current track, artist, link, and duration |
| `/volume level:<1-100>` | Changes playback volume |
| `/loop mode:<off/current song/queue>` | Changes the repeat mode |
| `/stop` | Stops playback and clears the queue |
| `/leave` | Clears the queue and disconnects the bot |
| `/features` | Explains what N7 Music can do |

## Discord application setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. On **General Information**, upload `discord-bot/docs/logo.gif` as the application icon.
3. Open **Bot**, create the bot user, upload the same file as the bot avatar, and copy its token. Keep it private.
4. Under **Bot**, enable only the intents this project uses:
   - `Guilds`
   - `Guild Voice States`
5. Open **OAuth2 → URL Generator**.
6. Select the `bot` and `applications.commands` scopes.
7. Grant these bot permissions:
   - View Channel
   - Send Messages
   - Embed Links
   - Connect
   - Speak
   - Use Voice Activity
8. Use the generated URL to invite the bot to your server.

The bot does not need the privileged Message Content intent because it uses slash commands instead of reading ordinary messages.

## Configuration

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Set these values:

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | The bot token from the Discord Developer Portal |
| `DISCORD_GUILD_ID` | No | A test server ID for instant command registration |
| `PORT` | No | HTTP health server port; Render supplies this automatically |
| `NODE_ENV` | No | Use `production` on Render |

Never commit `.env` or a bot token. Use Replit Secrets locally in this workspace and Render's secret environment variable field in production.

## Run locally

This repository uses pnpm workspaces:

```bash
pnpm install
pnpm --filter @workspace/discord-bot run dev
```

Check the bot package without logging in:

```bash
pnpm --filter @workspace/discord-bot run typecheck
```

The health server responds at `http://localhost:10000/health` when `PORT=10000`. A `200` response means Discord login and slash-command registration completed; a `503` response means the process is still starting.

### Fast command registration during development

Set `DISCORD_GUILD_ID` to the ID of a server where you installed the bot. Guild commands appear almost immediately. If it is omitted, commands are registered globally, which can take Discord longer to propagate.

## Deploy on Render

This repository includes `render.yaml`, which defines an always-on Node Web Service with the correct build command, start command, and health check.

Use an always-on Render instance for the bot. Free web services can spin down after inactivity, which disconnects a Discord bot from the gateway and makes playback unreliable.

### Blueprint deployment

1. Push the repository to GitHub or another Git provider supported by Render.
2. In Render, choose **New → Blueprint**.
3. Select the repository and let Render read `render.yaml`.
4. When Render asks for `DISCORD_TOKEN`, paste the bot token into the secret field. Do not add it to the YAML file or commit it.
5. Optionally add `DISCORD_GUILD_ID` while testing. Remove it later if you want global slash commands.
6. Deploy the service.

### Manual Web Service deployment

If you do not use the Blueprint:

- **Runtime:** Node
- **Build command:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/discord-bot run build`
- **Start command:** `pnpm --filter @workspace/discord-bot run start`
- **Health check path:** `/health`
- **Environment:** `DISCORD_TOKEN` as a secret, plus optional `DISCORD_GUILD_ID`

Render Web Services provide the `PORT` variable automatically. The app listens on `0.0.0.0`, so Render can reach the health endpoint while the Discord gateway connection stays active.

## Project layout

```text
discord-bot/
├── docs/logo.gif       # supplied N7 Music logo
├── src/commands.ts     # slash-command definitions
├── src/config.ts       # environment configuration
├── src/embeds.ts       # black embed helpers
├── src/health.ts       # Render health server
└── src/index.ts        # Discord client, player, and command handlers
render.yaml             # Render service definition
.env.example            # safe configuration template
```

## Troubleshooting

### Slash commands do not appear

Set `DISCORD_GUILD_ID` to your server ID and restart the service. Make sure the invite included the `applications.commands` scope. When using global commands, allow extra time for Discord to distribute them.

### The bot cannot join or play

Check that the bot has `Connect`, `Speak`, and `Use Voice Activity` permissions in the voice channel. The person using `/play` must also be in a voice channel.

### Render reports an unhealthy service

Open the service logs and confirm the bot token is present as a Render secret. The health endpoint intentionally returns `503` until Discord login and slash-command registration finish.

### Audio source changes

Audio platforms can change their access behavior. Use sources supported by the installed extractors and follow each platform's terms and applicable copyright rules. This project does not bypass paywalls, private content, or access controls.

## License

Add the license that matches how you plan to distribute this bot before publishing it publicly.