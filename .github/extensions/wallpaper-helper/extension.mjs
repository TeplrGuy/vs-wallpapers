/**
 * Wallpaper Helper — Copilot CLI Extension
 *
 * A demo extension showcasing four key SDK capabilities:
 *   1. Custom Tool  — `wallpaper_stats` (read-only asset summary)
 *   2. Hook         — Context injection (auto-inject project conventions)
 *   3. Hook         — Safety guard (block destructive commands)
 *   4. Hook         — Auto-open edited files in VS Code
 *   5. Session event — Welcome log on session start
 *
 * This is a multi-feature example intended for customer demos.
 */

import { execFile, exec } from "node:child_process";
import { joinSession } from "@github/copilot-sdk/extension";

const isWindows = process.platform === "win32";

// ─── Helper: run a shell command and return its stdout ───────────────────────
function run(command) {
  return new Promise((resolve) => {
    const shell = isWindows ? "powershell" : "bash";
    const args = isWindows
      ? ["-NoProfile", "-Command", command]
      : ["-c", command];
    execFile(shell, args, (err, stdout, stderr) => {
      if (err) resolve(`Error: ${stderr || err.message}`);
      else resolve(stdout.trim());
    });
  });
}

// ─── Helper: open a file in VS Code ─────────────────────────────────────────
function openInEditor(filePath) {
  if (isWindows) {
    exec(`code "${filePath}"`, () => {});
  } else {
    execFile("code", [filePath], () => {});
  }
}

// ─── Join the Copilot session with our hooks and tools ──────────────────────
const session = await joinSession({
  hooks: {
    // ── 5. Welcome message on session start ──────────────────────────────
    // Fires when the session starts or resumes. We use it to greet the
    // user and silently inject project-specific context.
    onSessionStart: async () => {
      await session.log("🎨 Wallpaper Helper extension loaded!");
      return {
        additionalContext:
          "This repo is a Jekyll site for Visual Studio wallpapers, " +
          "hosted on GitHub Pages at /visualstudio-wallpapers.",
      };
    },

    // ── 2. Context Injection ─────────────────────────────────────────────
    // Runs before every user message reaches the agent. We append project
    // conventions so the agent always knows how this repo is structured.
    onUserPromptSubmitted: async () => {
      return {
        additionalContext: [
          "Asset convention: wallpapers are stored under wallpapers/<device>/<size>/.",
          "Thumbnails live in wallpapers/<device>/thumbnails/.",
          "Filenames are zero-padded numbers (e.g., 024.jpg).",
          "Always use {{ site.baseurl }} for links in Jekyll templates.",
        ].join(" "),
      };
    },

    // ── 3. Safety Guard ──────────────────────────────────────────────────
    // Inspects every tool call before it runs. If it's a shell command
    // that looks destructive, we deny it with a clear reason.
    onPreToolUse: async (input) => {
      if (input.toolName === "bash" || input.toolName === "powershell") {
        const cmd = String(input.toolArgs?.command || "");

        // Block recursive deletes aimed at root or the wallpapers directory
        const dangerous =
          /rm\s+-rf\s+\//i.test(cmd) ||
          /Remove-Item\s+.*wallpapers.*-Recurse/i.test(cmd) ||
          /del\s+\/s\s+\/q\s+wallpapers/i.test(cmd);

        if (dangerous) {
          return {
            permissionDecision: "deny",
            permissionDecisionReason:
              "🛑 Blocked: destructive command targeting wallpapers or root.",
          };
        }
      }
      // Allow everything else
      return { permissionDecision: "allow" };
    },

    // ── 4. Auto-open edited files ────────────────────────────────────────
    // After the agent creates or edits a file, open it in VS Code so the
    // user can immediately see the changes.
    onPostToolUse: async (input) => {
      if (input.toolName === "create" || input.toolName === "edit") {
        const filePath = input.toolArgs?.path;
        if (filePath) {
          openInEditor(filePath);
        }
      }
    },
  },

  // ── 1. Custom Tool: wallpaper_stats ──────────────────────────────────────
  // A read-only tool that counts wallpaper assets by device category.
  // The agent can call this when the user asks about what's in the repo.
  tools: [
    {
      name: "wallpaper_stats",
      description:
        "Returns a summary of wallpaper image counts by device category " +
        "(desktop, phone, watch, archive) in this repository.",
      parameters: {
        type: "object",
        properties: {
          device: {
            type: "string",
            enum: ["all", "desktop", "phone", "watch", "archive"],
            description:
              'Which device category to count, or "all" for a full summary.',
          },
        },
        required: ["device"],
      },
      handler: async (args) => {
        const categories = {
          desktop: "wallpapers/desktop/thumbnails",
          phone: "wallpapers/phone/320x568",
          watch: "wallpapers/watch/368x448",
          archive: "wallpapers/archive/thumbnail",
        };

        const toCount =
          args.device === "all"
            ? Object.entries(categories)
            : [[args.device, categories[args.device]]];

        const results = [];

        for (const [name, dir] of toCount) {
          // Count .jpg files in the directory (cross-platform)
          const cmd = isWindows
            ? `(Get-ChildItem "${dir}" -Filter *.jpg -ErrorAction SilentlyContinue).Count`
            : `find "${dir}" -maxdepth 1 -name "*.jpg" 2>/dev/null | wc -l`;

          const count = await run(cmd);
          results.push(`${name}: ${count} wallpapers`);
        }

        return results.join("\n");
      },
    },
  ],
});

// ── Session Events ───────────────────────────────────────────────────────────
// Listen for completed tool executions and log failures as warnings.
session.on("tool.execution_complete", (event) => {
  if (!event.data.success) {
    session.log(`⚠️ Tool "${event.data.toolName}" failed: ${event.data.error}`, {
      level: "warning",
    });
  }
});
