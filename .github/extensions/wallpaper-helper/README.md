# 🎨 Wallpaper Helper — Copilot CLI Extension

A demo-ready [Copilot CLI extension](https://docs.github.com/en/copilot) that showcases custom tools, lifecycle hooks, and session events for the Visual Studio Wallpapers site.

## Features

| Feature | SDK Pattern | What It Does |
|---------|-------------|--------------|
| **`wallpaper_stats` tool** | Custom tool registration | Counts wallpaper images by device category (desktop, phone, watch, archive) |
| **Context injection** | `onUserPromptSubmitted` hook | Auto-injects repo conventions so the agent always knows the project structure |
| **Safety guard** | `onPreToolUse` hook | Blocks destructive shell commands (e.g., `rm -rf /`, bulk-delete wallpapers) |
| **Auto-open in VS Code** | `onPostToolUse` hook | Opens newly created/edited files in the editor automatically |
| **Welcome message** | `onSessionStart` hook | Logs a greeting and injects site context when the session starts |
| **Failure logging** | `session.on()` event | Logs a warning whenever a tool execution fails |

## File Structure

```
.github/extensions/wallpaper-helper/
├── extension.mjs      # Extension entry point (required name)
├── package.json       # Extension metadata
└── README.md          # This file
```

## How It Works

The extension uses the `@github/copilot-sdk` to join the active Copilot CLI session and register tools + hooks. It runs as a separate Node.js child process, communicating with the CLI over JSON-RPC via stdio.

```
Copilot CLI  ◄── JSON-RPC / stdio ──►  wallpaper-helper (extension process)
```

## Testing the Extension

### Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot) installed and authenticated
- This repository cloned locally

### Step 1 — Verify the extension loads

Open a terminal in the repo root and start Copilot CLI:

```bash
copilot
```

You should see `🎨 Wallpaper Helper extension loaded!` in the timeline.

### Step 2 — Test the custom tool

Ask the agent about wallpaper counts:

```
How many wallpapers are in each category?
```

The agent will call the `wallpaper_stats` tool and return a breakdown like:

```
desktop: 25 wallpapers
phone: 25 wallpapers
watch: 24 wallpapers
archive: 138 wallpapers
```

### Step 3 — Test the safety guard

Try asking the agent to do something destructive:

```
Delete all files in the wallpapers directory recursively
```

The extension will block the command with:
> 🛑 Blocked: destructive command targeting wallpapers or root.

### Step 4 — Test context injection

Ask a generic question about the project:

```
What naming convention should I use for new wallpapers?
```

The agent will know about zero-padded filenames, `{{ site.baseurl }}` conventions, and the folder structure — without you having to explain it — because the hook injects this context automatically.

### Step 5 — Test auto-open

Ask the agent to create or edit a file:

```
Add a comment to the top of index.html
```

The edited file should automatically open in VS Code.

### Step 6 — Reload after changes

If you modify `extension.mjs`, reload it without restarting the CLI:

```
/clear
```

Or use the extensions reload tool within the session.

## Key Implementation Notes

- **Entry file must be `extension.mjs`** — the CLI only discovers files with this exact name
- **`@github/copilot-sdk` is auto-resolved** — no `npm install` required; the CLI provides the SDK at runtime
- **Cross-platform** — uses `process.platform` to handle Windows (PowerShell) and macOS/Linux (Bash) differences
- **Read-only tool** — `wallpaper_stats` only counts files; it never modifies anything
- **ESM only** — extensions must use ES module syntax (`.mjs`)

## Customization Ideas

- Add a `wallpaper_search` tool that finds wallpapers by filename pattern
- Extend the safety guard to require confirmation for any `git push --force`
- Add an `onPostToolUse` hook that runs `bundle exec jekyll build` after HTML edits
- Track which wallpapers the agent has referenced in a session via events
