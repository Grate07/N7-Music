<div align="center">
  <img src="discord-bot/docs/banner.gif" alt="N7 Music banner" width="220" />
  <h1>N7 Music Discord Bot</h1>
  <p>Clean voice-channel playback • Spotify playlist URLs • Render-ready hosting</p>
  <p>
    <img src="https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white" alt="discord.js v14" />
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18 or newer" />
    <img src="https://img.shields.io/badge/hosting-Render-46E3B7?logo=render&logoColor=111111" alt="Render hosting" />
    <img src="https://img.shields.io/badge/license-configure%20before%20publishing-6d28d9" alt="License needs to be configured" />
  </p>
</div>

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Commands](#commands)
- [Spotify playlist URLs](#spotify-playlist-urls)
- [Discord setup](#discord-setup)
- [Configuration](#configuration)
- [Run locally](#run-locally)
- [Deploy on Render](#deploy-on-render)
- [Keep the free Render service warm](#keep-the-free-render-service-warm)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)
- [Security and usage notes](#security-and-usage-notes)

## Overview

N7 Music is a Discord music bot for servers that want simple, fast playback controls. It uses slash commands, keeps a separate queue for each server, and replies with black embeds styled around the N7 brand.

The project is a pnpm workspace containing a standalone TypeScript bot package. It includes an Express health endpoint so Render can monitor the process while the Discord gateway connection stays active.

## Features

- Search for a song by title or artist with `/play`.
- Play supported music URLs.
- Paste a public Spotify track, album, or playlist URL and queue its matching tracks.
- Keep an independent playback queue for every Discord server.
- Use the interactive Now Playing control panel shown in Discord after playback starts.
- Pause, resume, skip, stop, leave, change volume, and repeat tracks.
- Control previous, next, queue, loop, shuffle, and autoplay directly from the panel.
- Show the current queue and now-playing information.
- Use black Discord embeds with track artwork and requester information.
- Discover the complete feature list with `/features`.
- Run with bundled FFmpeg through `ffmpeg-static`.
- Target a 128 kbps voice encoder bitrate for cleaner music playback; Discord still applies the server and channel limits.
- Monitor startup with `/health` on Render.

## Commands

| Command | What it does |
| --- | --- |
| `/play query:<song or URL> source:<auto/spotify/youtube/soundcloud>` | Joins your voice channel and plays or queues a song or playlist |
| `/skip` | Skips to the next queued track |
| `/pause` | Pauses the current track |
| `/resume` | Resumes paused playback |
| `/queue` | Shows the current track and up to the next 10 queued tracks |
| `/nowplaying` | Shows the current track, artist, link, and duration |
| `/volume level:<1-100>` | Changes playback volume |
| `/loop mode:<off/current song/queue>` | Changes the repeat mode |
| `/stop` | Stops playback and clears the queue |
| `/leave` | Clears the queue and explicitly disconnects the bot from the voice channel |
| `/features` | Explains what N7 Music can do |

### Interactive Now Playing panel

When a track begins, N7 Music posts a black **Now Playing** panel with the track artwork, duration, requester, and buttons:

| Button | Action |
| --- | --- |
| Previous | Returns to the previous track when playback history is available |
| Pause / Resume | Pauses or resumes the current track |
| Next | Skips to the next queued track |
| Queue | Shows the upcoming queue privately to the person who clicked |
| Stop | Stops playback, clears the queue, and leaves the voice channel |
| Loop | Cycles through off, current-song, and full-queue repeat |
| Shuffle | Toggles dynamic queue shuffle |
| Autoplay | Enables or disables similar-track autoplay when the queue ends |

Only members in the bot's current voice channel can use playback controls. The bot also updates its Discord activity to show the current track while music is playing.

## Spotify playlist URLs

To play a playlist, join the voice channel first and use the playlist URL as the `/play` query:

```text
/play query:https://open.spotify.com/playlist/PLAYLIST_ID
```

For a text search, choose a source from the optional `source` menu:

```text
/play query:Trapped in My Mind source:Spotify
/play query:lofi hip hop source:YouTube
```

When the query is a URL, leave the source on **Auto detect** so N7 Music can identify the URL type automatically.

N7 Music will:

1. Resolve the public Spotify playlist.
2. Add the available tracks to the server queue.
3. Start the first track if nothing is already playing.
4. Reply with the playlist name, track count, thumbnail, duration, and requester.

Spotify links provide track metadata. The bot resolves each song to a playable source through its installed extractors; it does not stream protected Spotify audio directly. Public playlists are supported. Private, account-only playlists require a separate user authorization flow.

## Discord setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application and name it **N7 Music**.
3. On **General Information**, upload `discord-bot/docs/banner.gif` or `discord-bot/docs/logo.gif` as the application icon.
4. Open **Bot**, create the bot user, and upload the same N7 image as its avatar.
5. Copy the bot token into a secure secret store. Never commit it.
6. Under **Bot**, enable the intents used by this project:
   - `Guilds`
   - `Guild Voice States`
7. Open **OAuth2 → URL Generator**.
8. Select the `bot` and `applications.commands` scopes.
9. Grant these bot permissions:
   - View Channel
   - Send Messages
   - Embed Links
   - Connect
   - Speak
   - Use Voice Activity
10. Use the generated URL to invite the bot to your server.

The bot does not need the privileged Message Content intent because it uses slash commands instead of reading ordinary messages.

## Configuration

Copy the safe template for local development:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `DISCORD_GUILD_ID` | No | Test server ID for near-instant command registration |
| `SPOTIFY_CLIENT_ID` | Recommended | Spotify Web API client ID for reliable public playlist resolution |
| `SPOTIFY_CLIENT_SECRET` | Recommended | Spotify Web API client secret paired with the client ID |
| `PORT` | No | HTTP health server port; Render supplies this automatically |
| `NODE_ENV` | No | Use `production` on Render |

Never commit `.env`, a Discord token, or Spotify credentials. Use Replit Secrets locally and Render's secret environment variables in production.

### Spotify API credentials

For reliable playlist resolution, create an application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), then add its client ID and client secret as secure environment variables. These are app credentials, not a user's Spotify password.

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

The health server responds at `http://localhost:10000/health` when `PORT=10000`:

- `200` with `"status":"ok"` means Discord login and slash-command registration completed.
- `503` with `"status":"starting"` means the process is still starting.

### Fast command registration during development

Set `DISCORD_GUILD_ID` to the ID of a server where you installed the bot. Guild commands appear almost immediately. If it is omitted, commands are registered globally, which can take Discord longer to propagate.

## Deploy on Render

The included `render.yaml` defines a Node Web Service with the build command, start command, and `/health` check already configured.

### Important free-plan limitation

Render's free web services are not truly always-on. Render spins a free service down after 15 minutes without inbound traffic, and it can take about a minute to wake up. Render also grants 750 free instance hours per month, which is enough for roughly one month of continuous runtime but does not guarantee uptime.

For reliable Discord gateway connectivity, a paid always-on Render instance is the proper option. If you need a no-cost setup, use the best-effort keep-warm method below.

### Blueprint deployment

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint**.
3. Select the repository and let Render read `render.yaml`.
4. Add `DISCORD_TOKEN` as a Render secret.
5. Optionally add `DISCORD_GUILD_ID` for fast command registration during testing.
6. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as secrets if Spotify playlist resolution needs the authenticated API path.
7. Choose the **Free** instance plan if Render asks you to select a plan.
8. Deploy the service.

### Manual Web Service deployment

If you do not use the Blueprint, use:

- **Runtime:** Node
- **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @workspace/discord-bot run build`
- **Start command:** `pnpm --filter @workspace/discord-bot run start`
- **Health check path:** `/health`
- **Required secret:** `DISCORD_TOKEN`
- **Optional secrets:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

Render supplies `PORT` automatically. The app listens on `0.0.0.0`, allowing Render to reach the health endpoint while the Discord gateway remains connected.

## Keep the free Render service warm

UptimeRobot can send a health request every 5 minutes so the free Render service receives inbound traffic before the 15-minute idle window expires.

1. Deploy the service using the Render steps above.
2. Open the Render service page and copy its public URL. It will look similar to `https://n7-music-bot.onrender.com`.
3. Confirm the health endpoint in a browser:

   ```text
   https://YOUR-RENDER-SERVICE.onrender.com/health
   ```

   Wait until it returns `"status":"ok"`.
4. Create a free account at [UptimeRobot](https://uptimerobot.com/).
5. Choose **Add New Monitor**.
6. Select **HTTP(s)**.
7. Use a name such as `N7 Music Render`.
8. Set the URL to:

   ```text
   https://YOUR-RENDER-SERVICE.onrender.com/health
   ```

9. Set the monitoring interval to **5 minutes**, then save the monitor.
10. Enable email or push alerts so you know if the service returns an error.

UptimeRobot helps prevent idle sleep, but it cannot prevent Render restarts, monthly free-hour suspension, provider outages, or Discord gateway disconnects. A free Render service should therefore be treated as best-effort rather than guaranteed 24/7 hosting.

## Project layout

```text
discord-bot/
├── docs/banner.gif     # README and N7 brand banner
├── docs/logo.gif       # N7 bot logo/avatar
├── src/commands.ts     # slash-command definitions
├── src/config.ts       # environment configuration
├── src/embeds.ts       # black embed helpers
├── src/health.ts       # Render health server
└── src/index.ts        # Discord client, player, and command handlers
render.yaml             # Render service definition
.env.example            # safe configuration template
n7-music-bot.zip        # latest project archive
```

## Troubleshooting

### Slash commands do not appear

Set `DISCORD_GUILD_ID` to your server ID and restart the service. Make sure the invite included the `applications.commands` scope. Global commands can take longer to propagate.

### The bot cannot join or play

Check that the bot has `Connect`, `Speak`, and `Use Voice Activity` permissions in the voice channel. The person using `/play` must also be in a voice channel.

### A Spotify playlist cannot be resolved

Confirm that the link is a public Spotify track, album, or playlist URL. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as secure variables, then restart the bot. Private playlists need user authorization and are not supported by app credentials alone.

### Render reports an unhealthy service

Open the service logs and confirm that `DISCORD_TOKEN` is present as a Render secret. The health endpoint intentionally returns `503` until Discord login and slash-command registration finish.

### Audio source changes

Audio platforms can change their access behavior. Use sources supported by the installed extractors and follow each platform's terms and applicable copyright rules. This project does not bypass paywalls, private content, or access controls.

## Security and usage notes

- Never share or commit Discord tokens or Spotify secrets.
- Reset a Discord token immediately if it is exposed.
- Keep bot permissions limited to the channels where music is needed.
- Respect the terms of each audio platform and applicable copyright rules.

## License

Add the license that matches how you plan to distribute this bot before publishing it publicly.