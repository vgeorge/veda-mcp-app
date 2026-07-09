#!/usr/bin/env node
/**
 * Registers veda-mcp-app with local Claude hosts using absolute paths.
 * Flags: --print (dry run), --remove, --desktop-only, --code-only.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "veda-mcp-app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distMain = path.join(projectRoot, "dist", "main.js");
const nodeBin = process.execPath; // the node running this script — guaranteed valid

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--print");
const remove = args.has("--remove");
const desktopOnly = args.has("--desktop-only");
const codeOnly = args.has("--code-only");

const serverEntry = { command: nodeBin, args: [distMain, "--stdio"] };

function log(msg) {
  console.log(msg);
}

function ensureBuilt() {
  if (!fs.existsSync(distMain)) {
    console.error(`Build output not found: ${distMain}`);
    console.error("Run `npm run build` (or `npm install`) first.");
    process.exit(1);
  }
}

function desktopConfigPath() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  return path.join(home, ".config", "Claude", "claude_desktop_config.json");
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw new Error(`Could not parse ${p}: ${e.message}`);
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

function configureDesktop() {
  const configPath = desktopConfigPath();
  const config = readJson(configPath);
  config.mcpServers = config.mcpServers || {};

  if (remove) {
    if (config.mcpServers[SERVER_NAME]) {
      delete config.mcpServers[SERVER_NAME];
      if (dryRun) {
        log(`[dry run] would remove "${SERVER_NAME}" from ${configPath}`);
      } else {
        writeJson(configPath, config);
        log(`Removed "${SERVER_NAME}" from ${configPath}`);
      }
    } else {
      log(`"${SERVER_NAME}" not present in ${configPath}; nothing to remove.`);
    }
    return;
  }

  config.mcpServers[SERVER_NAME] = serverEntry;
  if (dryRun) {
    log(`[dry run] would write to ${configPath}:`);
    log(JSON.stringify({ mcpServers: { [SERVER_NAME]: serverEntry } }, null, 2));
  } else {
    writeJson(configPath, config);
    log(`Configured Claude Desktop: ${configPath}`);
  }
}

function claudeAvailable() {
  const probe = spawnSync("claude", ["--version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

function configureCode() {
  if (!claudeAvailable()) {
    log("Claude Code CLI (`claude`) not found on PATH; skipping Claude Code.");
    return;
  }

  if (remove) {
    const cmd = ["mcp", "remove", SERVER_NAME, "-s", "user"];
    if (dryRun) {
      log(`[dry run] would run: claude ${cmd.join(" ")}`);
      return;
    }
    spawnSync("claude", cmd, { stdio: "inherit" });
    log(`Removed "${SERVER_NAME}" from Claude Code (user scope).`);
    return;
  }

  // Remove first so re-running is idempotent (add errors if it already exists).
  const addCmd = ["mcp", "add", SERVER_NAME, "-s", "user", "--", nodeBin, distMain, "--stdio"];
  if (dryRun) {
    log(`[dry run] would run: claude ${addCmd.join(" ")}`);
    return;
  }
  spawnSync("claude", ["mcp", "remove", SERVER_NAME, "-s", "user"], { stdio: "ignore" });
  const res = spawnSync("claude", addCmd, { stdio: "inherit" });
  if (res.status === 0) {
    log(`Configured Claude Code (user scope).`);
  } else {
    log(`Claude Code registration failed (exit ${res.status}). Run manually:`);
    log(`  claude ${addCmd.join(" ")}`);
  }
}

function main() {
  if (!remove) ensureBuilt();

  if (!codeOnly) configureDesktop();
  if (!desktopOnly) configureCode();

  if (!remove && !dryRun) {
    log("");
    log("Done. Restart Claude Desktop to pick up the change.");
    log("(Claude Code picks up the new server on next launch.)");
  }
}

main();
