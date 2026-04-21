#!/usr/bin/env node
// submit.mjs - Submit Claude Code session to Session Share platform
//
// Usage:
//   node submit.mjs [--file <path>] [--title "Title"] [--description "Desc"] [--private] [--key API_KEY]
//
// Environment Variables:
//   SESSION_SHARE_API_URL - Base URL for API (default: https://eval.569169.xyz/api)
//   SESSION_SHARE_API_KEY - API key for member uploads
//   SESSION_EVAL_API_URL  - Legacy, maps to SESSION_SHARE_API_URL
//   SESSION_EVAL_API_KEY  - Legacy, maps to SESSION_SHARE_API_KEY

import { resolveSessionPath } from './lib/session-finder.mjs';
import { uploadSession } from './lib/uploader.mjs';

// Parse arguments
const args = process.argv.slice(2);
let filePath = '';
let title = '';
let description = '';
let isPublic = true;
let apiKey = '';

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--file':
    case '-f':
      filePath = args[++i];
      break;
    case '--title': title = args[++i]; break;
    case '--description': description = args[++i]; break;
    case '--private': isPublic = false; break;
    case '--key': apiKey = args[++i]; break;
  }
}

// API configuration
const apiUrl = process.env.SESSION_SHARE_API_URL
  || process.env.SESSION_EVAL_API_URL
  || 'https://eval.569169.xyz/api';
const resolvedApiKey = apiKey
  || process.env.SESSION_SHARE_API_KEY
  || process.env.SESSION_EVAL_API_KEY
  || '';

async function main() {
  console.log('Session Share - Submitting session...\n');

  // Resolve session file (explicit path or auto-detect)
  const sessionPath = resolveSessionPath(filePath || undefined);
  console.log(`Found session: ${sessionPath}`);

  // Upload
  const uploadOptions = {
    title: title || undefined,
    description: description || undefined,
    isPublic,
    apiKey: resolvedApiKey,
    apiUrl,
  };

  try {
    const result = await uploadSession(sessionPath, uploadOptions);

    console.log(`Session contains ${result.lineCount} messages`);
    console.log(`Encoding: ${result.encoding} (${result.contentSizeKB}KB)`);
    console.log(`Submitting to ${apiUrl.replace(/\/$/, '')}/sessions...`);

    if (resolvedApiKey) {
      console.log('Using API key for member upload');
    }

    // Success
    console.log('');
    console.log('='.repeat(50));
    console.log('Session submitted successfully!');
    console.log('='.repeat(50));
    console.log('');
    console.log(`Share link: ${result.shareUrl}`);
    console.log(`Storage tier: ${result.storageTier || 'N/A'}`);

    if (result.expiresAt) {
      const expires = new Date(result.expiresAt);
      const days = Math.round((expires - Date.now()) / (1000 * 60 * 60 * 24));
      console.log(`Expires: ${expires.toLocaleDateString()} (${days} days)`);
    }

    if (result.evaluationAllowed) {
      console.log('');
      console.log('Evaluation is running in the background (~30 seconds).');
      console.log('Open the share link and refresh to see scoring results.');
    }

    console.log('');
  } catch (err) {
    console.error(`Error: ${err.message}`);

    if (err.body) {
      console.error(`Response: ${JSON.stringify(err.body, null, 2)}`);
    }

    if (err.message.includes('connect')) {
      console.error(`URL: ${apiUrl.replace(/\/$/, '')}/sessions`);
      console.error('Check SESSION_SHARE_API_URL and network connectivity.');
    }

    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
