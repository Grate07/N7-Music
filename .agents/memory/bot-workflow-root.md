---
name: Bot workflow root
description: Workflow path behavior for the hosted N7 Music bot.
---

After artifact cleanup or workspace reconciliation, the active N7 Music package may be flattened to the workspace-root `discord-bot` package while a nested clone remains only as a Git checkout. The workflow should run from the workspace pnpm root and use the workspace filter.

**Why:** Running from the stale nested path can make pnpm resolve the root package without the correct installed dependencies, producing `tsx: not found` even though the source is present.

**How to apply:** Check the workflow log’s working directory before changing code. Install from the active root lockfile and use the root `pnpm --filter @workspace/discord-bot run start` command when the package is rooted at `discord-bot/`.