#!/usr/bin/env node
// uploader.mjs - Encode and upload session JSONL to Session Share API
//
// Exports:
//   buildPayload(content, options) - Build JSON payload with optional base64 encoding
//   uploadSession(filePath, options) - Read file, encode, POST to API, return result

import { readFileSync } from 'node:fs';

/** @typedef {{ title?: string, description?: string, isPublic?: boolean, apiKey?: string, apiUrl?: string }} UploadOptions */
/** @typedef {{ shareToken: string, shareUrl: string, storageTier: string, expiresAt?: string, evaluationAllowed?: boolean, lineCount: number, encoding: string, contentSizeKB: number }} UploadResult */

const BASE64_THRESHOLD = 500 * 1024; // 500KB

/**
 * Build the JSON payload for the upload API.
 * Automatically uses base64 encoding for content >500KB.
 * @param {string} content - Raw JSONL content.
 * @param {Pick<UploadOptions, 'title' | 'description' | 'isPublic'>} options
 * @returns {{ payload: object, encoding: string, contentSizeKB: number }}
 */
export function buildPayload(content, options = {}) {
  const useBase64 = Buffer.byteLength(content) > BASE64_THRESHOLD;
  const encoding = useBase64 ? 'base64' : 'utf-8';
  const contentSizeKB = Math.round(Buffer.byteLength(content) / 1024);

  const payload = {
    rawJsonl: useBase64 ? Buffer.from(content, 'utf-8').toString('base64') : content,
    encoding,
    isPublic: options.isPublic !== false,
  };

  if (options.title) payload.title = options.title;
  if (options.description) payload.description = options.description;

  return { payload, encoding, contentSizeKB };
}

/**
 * Upload a session JSONL file to the Session Share API.
 * @param {string} filePath - Absolute path to the .jsonl file.
 * @param {UploadOptions} options
 * @returns {Promise<UploadResult>}
 * @throws {Error} On read failure, network error, or API error response.
 */
export async function uploadSession(filePath, options = {}) {
  const content = readFileSync(filePath, 'utf-8');

  if (!content.trim()) {
    throw new Error('Session file is empty.');
  }

  const lineCount = content.split('\n').filter(l => l.trim()).length;
  const { payload, encoding, contentSizeKB } = buildPayload(content, options);

  const apiUrl = (options.apiUrl || 'https://eval.569169.xyz/api').replace(/\/$/, '');
  const url = `${apiUrl}/sessions`;

  const headers = { 'Content-Type': 'application/json' };
  const apiKey = options.apiKey || '';
  if (apiKey) {
    headers['x-session-eval-key'] = apiKey;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  if (!response.ok) {
    const err = new Error(`API returned status ${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return {
    shareToken: body.shareToken,
    shareUrl: body.shareUrl || `${apiUrl.replace('/api', '')}/s/${body.shareToken}`,
    storageTier: body.storageTier,
    expiresAt: body.expiresAt,
    evaluationAllowed: body.evaluationAllowed,
    lineCount,
    encoding,
    contentSizeKB,
  };
}
