---
name: session-share
description: |
  Use when the user wants to submit, share, or upload a Claude Code session
  for evaluation and analysis. Supports both auto-detecting the current session
  and uploading a specific JSONL file path provided by the user. Triggers on
  phrases like "submit session", "share this conversation", "upload session",
  "evaluate this session", or when user mentions scoring/reviewing their
  current conversation. Also triggers when the user provides a specific .jsonl
  file path to upload.
---

# Session Share Skill

Submit a Claude Code session to the Session Share platform for sharing and evaluation.

## Trigger Conditions

- User says "submit session", "share session", "upload session", "提交会话", "分享会话"
- User says "help me evaluate this conversation", "评估一下这个对话"
- User wants to score the current conversation
- User mentions phrases like "evaluate this", "review this session", "share this chat"
- User provides a file path ending in `.jsonl` along with upload intent
- User says "upload this session file", "提交这个会话文件", "上传这个文件"

## Modes

### Auto-Detect Mode (default)

When the user does NOT provide a specific file path:

1. Find the current session's JSONL file in `~/.claude/projects/<encoded-cwd>/`
2. The most recently modified `.jsonl` file is the current active session
3. Upload using the Node.js script without `--file`

### Direct Path Mode

**When the user provides an explicit file path, use Direct Path Mode. Do NOT attempt auto-discovery.**

1. Extract the file path from the user's message
2. Pass the path via `--file` argument to the script
3. The script validates the file exists and is `.jsonl`

Examples of user messages that should trigger Direct Path Mode:
- "上传这个文件 C:/Users/name/sessions/abc.jsonl"
- "提交 /path/to/session.jsonl"
- "上传这个会话文件" (when a file path is in context)

## Submission Methods

### Method A: Node.js Script (Recommended, Cross-Platform)

```bash
# Auto-detect current session
node .claude/skills/session-share/scripts/submit.mjs --title "My Session"

# Direct file path
node .claude/skills/session-share/scripts/submit.mjs --file /path/to/session.jsonl --title "My Session"
```

Options:
```bash
--file, -f <path>    Specify JSONL file path (skips auto-detection)
--title "Title"      Optional title for the session
--description "Desc" Optional description
--private            Makes the session private (member-only access)
--key API_KEY        Override API key for member uploads
```

### Method B: Bash Script (Linux/Mac only)

```bash
# Auto-detect
bash .claude/skills/session-share/scripts/submit.sh --title "My Session"

# Direct file path
bash .claude/skills/session-share/scripts/submit.sh --file /path/to/session.jsonl
```

### Method C: Claude Reads and POSTs Directly

Use Bash tool to run a Node.js one-liner that reads the JSONL and POSTs to the API.

## API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SHARE_API_URL` | Base URL for API | `https://eval.569169.xyz/api` |
| `SESSION_SHARE_API_KEY` | API key for member uploads (longer retention, evaluations) | (none) |

Legacy variables (still supported):
- `SESSION_EVAL_API_URL` — maps to `SESSION_SHARE_API_URL`
- `SESSION_EVAL_API_KEY` — maps to `SESSION_SHARE_API_KEY`

## API Request Format

POST to `{API_URL}/sessions` with header `Content-Type: application/json`:

```json
{
  "rawJsonl": "<complete jsonl content>",
  "title": "Optional title",
  "description": "Optional description",
  "isPublic": true,
  "encoding": "utf-8"
}
```

For large sessions (>500KB), the script auto-switches to base64 encoding:

```json
{
  "rawJsonl": "<base64-encoded content>",
  "encoding": "base64"
}
```

## Size Limits

- **Raw JSONL**: Up to ~4MB (platform limit, including base64 overhead)
- Sessions exceeding this limit will receive a `413 Session too large` error
- The script auto-encodes as base64 when raw content exceeds 500KB, but the final payload must still fit within ~4MB
- For very long sessions, consider uploading only the relevant portion using `--file` with a trimmed JSONL

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| File not found | `--file` path doesn't exist | Check the file path |
| No session found | No JSONL in `~/.claude/projects/` | Ensure Claude Code has an active session, or use `--file` |
| Session too large (413) | Payload exceeds platform limit (~4MB) | Use a shorter session or trim the JSONL |
| API unreachable | Server down or wrong URL | Check `SESSION_SHARE_API_URL` and network |
| 401 Unauthorized | Invalid or missing API key | Set `SESSION_SHARE_API_KEY` |
| 400 Validation failed | Malformed JSONL content | Check that the JSONL file is valid |
| 500 Server error | Platform issue | Retry later or check server logs |
