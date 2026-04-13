#!/usr/bin/env node
// submit.mjs - Submit current Claude Code session to Session Share platform
//
// Usage:
//   node submit.mjs [--title "Title"] [--description "Desc"] [--private] [--key API_KEY]
//
// Environment Variables:
//   SESSION_SHARE_API_URL - Base URL for API (default: https://eval.569169.xyz/api)
//   SESSION_SHARE_API_KEY - API key for member uploads
//   SESSION_EVAL_API_URL  - Legacy, maps to SESSION_SHARE_API_URL
//   SESSION_EVAL_API_KEY  - Legacy, maps to SESSION_SHARE_API_KEY

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

// Parse arguments
const args = process.argv.slice(2);
let title = '';
let description = '';
let isPublic = true;
let apiKey = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--title': title = args[++i]; break;
    case '--description': description = args[++i]; break;
    case '--private': isPublic = false; break;
    case '--key': apiKey = args[++i]; break;
  }
}

// API configuration
const API_URL = process.env.SESSION_SHARE_API_URL
  || process.env.SESSION_EVAL_API_URL
  || 'https://eval.569169.xyz/api';
const key = apiKey
  || process.env.SESSION_SHARE_API_KEY
  || process.env.SESSION_EVAL_API_KEY
  || '';

// Find Claude Code projects directory
const claudeDir = join(homedir(), '.claude', 'projects');

/**
 * Find the most recently modified .jsonl file for the current working directory.
 * Claude Code encodes the CWD path into the project directory name.
 */
function findSessionFile() {
  const cwd = process.cwd();
  const candidates = [];

  function scanDir(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip subagents directory
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

  // Sort by modification time (most recent first)
  candidates.sort((a, b) => b.mtime - a.mtime);

  // Try to find one that matches the current working directory
  const cwdNormalized = cwd.replace(/[/\\]/g, '-').toLowerCase();
  const cwdMatch = candidates.find(c =>
    c.dir.toLowerCase().includes(cwdNormalized.slice(-50))
  );

  // Return the best match or the most recent file
  return cwdMatch || candidates[0];
}

async function submit() {
  console.log('Session Share - Submitting current session...\n');

  // Find session file
  const session = findSessionFile();
  if (!session) {
    console.error('Error: No session file found.');
    console.error(`Searched in: ${claudeDir}`);
    console.error('Make sure Claude Code is running and has an active session.');
    process.exit(1);
  }

  console.log(`Found session: ${session.path}`);

  // Read session content
  let content;
  try {
    content = readFileSync(session.path, 'utf-8');
  } catch (err) {
    console.error(`Error reading session file: ${err.message}`);
    process.exit(1);
  }

  if (!content.trim()) {
    console.error('Error: Session file is empty.');
    process.exit(1);
  }

  // Count lines for info
  const lineCount = content.split('\n').filter(l => l.trim()).length;
  console.log(`Session contains ${lineCount} messages`);

  // Build payload
  const useBase64 = Buffer.byteLength(content) > 500 * 1024; // > 500KB
  const payload = {
    rawJsonl: useBase64 ? Buffer.from(content, 'utf-8').toString('base64') : content,
    encoding: useBase64 ? 'base64' : 'utf-8',
    isPublic,
  };
  if (title) payload.title = title;
  if (description) payload.description = description;

  console.log(`Encoding: ${useBase64 ? 'base64' : 'utf-8'} (${(Buffer.byteLength(content) / 1024).toFixed(0)}KB)`);

  // Submit to API
  const url = `${API_URL.replace(/\/$/, '')}/sessions`;
  console.log(`Submitting to ${url}...`);

  const headers = { 'Content-Type': 'application/json' };
  if (key) {
    headers['x-session-eval-key'] = key;
    console.log('Using API key for member upload');
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Error: Failed to connect to API: ${err.message}`);
    console.error(`URL: ${url}`);
    console.error('Check SESSION_SHARE_API_URL and network connectivity.');
    process.exit(1);
  }

  const body = await response.json();

  if (!response.ok) {
    console.error(`Error: API returned status ${response.status}`);
    console.error(`Response: ${JSON.stringify(body, null, 2)}`);
    process.exit(1);
  }

  // Success
  console.log('');
  console.log('='.repeat(50));
  console.log('Session submitted successfully!');
  console.log('='.repeat(50));
  console.log('');
  console.log(`Share link: ${body.shareUrl || `${API_URL.replace('/api', '')}/s/${body.shareToken}`}`);
  console.log(`Storage tier: ${body.storageTier || 'N/A'}`);

  if (body.expiresAt) {
    const expires = new Date(body.expiresAt);
    const days = Math.round((expires - Date.now()) / (1000 * 60 * 60 * 24));
    console.log(`Expires: ${expires.toLocaleDateString()} (${days} days)`);
  }

  if (body.evaluationAllowed) {
    console.log('');
    console.log('Evaluation is running in the background (~30 seconds).');
    console.log('Open the share link and refresh to see scoring results.');
  }

  console.log('');
}

submit().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
