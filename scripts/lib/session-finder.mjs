#!/usr/bin/env node
// session-finder.mjs - Find and validate Claude Code session JSONL files
//
// Exports:
//   findSessionFile() - Auto-discover current session's JSONL
//   resolveSessionPath(inputPath?) - Validate explicit path or fall back to auto-discovery

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { homedir } from 'node:os';

const claudeDir = join(homedir(), '.claude', 'projects');

/**
 * Find the most recently modified .jsonl file for the current working directory.
 * Scans ~/.claude/projects/ recursively, matching by CWD encoding.
 * @returns {string|null} Absolute path to the session file, or null if not found.
 */
export function findSessionFile() {
  const cwd = process.cwd();
  const candidates = [];

  function scanDir(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'subagents') continue;
          scanDir(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          try {
            const stat = statSync(fullPath);
            candidates.push({ path: fullPath, mtime: stat.mtimeMs, dir });
          } catch {
            // Skip inaccessible files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  scanDir(claudeDir);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.mtime - a.mtime);

  const cwdNormalized = cwd.replace(/[/\\]/g, '-').toLowerCase();
  const cwdMatch = candidates.find(c =>
    c.dir.toLowerCase().includes(cwdNormalized.slice(-50))
  );

  return (cwdMatch || candidates[0]).path;
}

/**
 * Resolve a session file path. If inputPath is provided, validate it directly.
 * Otherwise, auto-discover the current session.
 * @param {string} [inputPath] - Optional explicit file path from --file argument.
 * @returns {string} Absolute path to a valid JSONL file.
 * @throws {Error} If the path is invalid, file doesn't exist, or auto-discovery finds nothing.
 */
export function resolveSessionPath(inputPath) {
  if (inputPath) {
    const absPath = resolve(inputPath);

    if (!existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    const stat = statSync(absPath);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${absPath}`);
    }

    if (extname(absPath).toLowerCase() !== '.jsonl') {
      throw new Error(`Not a .jsonl file: ${absPath}`);
    }

    return absPath;
  }

  const discovered = findSessionFile();
  if (!discovered) {
    throw new Error(
      `No session file found.\n` +
      `Searched in: ${claudeDir}\n` +
      `Make sure Claude Code is running and has an active session.\n` +
      `Or use --file <path> to specify a session file directly.`
    );
  }
  return discovered;
}
