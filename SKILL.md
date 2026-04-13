---
name: session-share
description: |
  Use when the user wants to submit, share, or upload a Claude Code session
  for evaluation and analysis. Triggers on phrases like "submit session",
  "share this conversation", "upload session", "evaluate this session",
  or when user mentions scoring/reviewing their current conversation.
---

# Session Share Skill

Submit the current Claude Code session to the Session Share platform for sharing and evaluation.

## Trigger Conditions

- User says "submit session", "share session", "upload session", "提交会话", "分享会话"
- User says "help me evaluate this conversation", "评估一下这个对话"
- User wants to score the current conversation
- User mentions phrases like "evaluate this", "review this session", "share this chat"

## Workflow

### 1. Detect Current Session

Claude Code stores session data in `~/.claude/projects/<encoded-cwd>/` where `<encoded-cwd>` is the path with `/` replaced by `-` and other special characters URL-encoded.

Within that directory:
- The most recently modified `.jsonl` file is the current active session
- Subagent sessions are in `subagents/<agent-name>/` subdirectories

**Important:** On Windows, paths use `-` as separator instead of `/`. For example:
- Linux: `~/.claude/projects/home-user-project-myapp/`
- Windows: `~/.claude/projects/C-users-name-project-myapp/`

The simplest way to find the session file is to list all `*.jsonl` files in `~/.claude/projects/` recursively and pick the most recently modified one that matches the current working directory.

### 2. Read Session Data

- Read the complete JSONL file content
- Each line is a JSON object with fields: type, uuid, parentUuid, message, timestamp, etc.
- The content can be large (1MB+); use base64 encoding for submission

### 3. Submit to Platform

POST to the Session Share API:

```
POST {API_URL}/sessions
Content-Type: application/json
x-session-eval-key: {API_KEY}  (optional, for member uploads)
```

Request body:

```json
{
  "rawJsonl": "<complete jsonl content>",
  "title": "Optional title",
  "description": "Optional description",
  "isPublic": true,
  "encoding": "utf-8"
}
```

For large sessions (>500KB), use base64 encoding:

```json
{
  "rawJsonl": "<base64-encoded content>",
  "encoding": "base64"
}
```

**API Response (201 Created):**

```json
{
  "shareToken": "abc123def456",
  "shareUrl": "https://eval.569169.xyz/s/abc123def456",
  "storageTier": "GUEST",
  "expiresAt": "2026-04-20T12:00:00Z",
  "evaluationAllowed": true
}
```

### 4. Return Results

Display to the user:
- **Share link**: The `shareUrl` from the API response
- **Storage tier**: GUEST (7-day expiry) or MEMBER (180-day expiry with API key)
- **Evaluation**: Running in background (~30 seconds), refresh the share page to see results

## API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SHARE_API_URL` | Base URL for API | `https://eval.569169.xyz/api` |
| `SESSION_SHARE_API_KEY` | API key for member uploads (longer retention, evaluations) | (none) |

Legacy variables (still supported):
- `SESSION_EVAL_API_URL` — maps to `SESSION_SHARE_API_URL`
- `SESSION_EVAL_API_KEY` — maps to `SESSION_SHARE_API_KEY`

## Submission Methods

### Method A: Node.js Script (Recommended, Cross-Platform)

```bash
node .claude/skills/session-share/scripts/submit.mjs
```

Options:
```bash
node .claude/skills/session-share/scripts/submit.mjs --title "My Session" --description "Description"
node .claude/skills/session-share/scripts/submit.mjs --private
```

### Method B: Claude Reads and POSTs Directly

Use Bash tool to run a Node.js one-liner that reads the JSONL and POSTs to the API. See `scripts/submit.mjs` for the implementation pattern.

### Method C: Bash Script (Linux/Mac only)

```bash
bash .claude/skills/session-share/scripts/submit.sh
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| No session found | No JSONL file in expected directory | Ensure Claude Code is running and has an active session |
| API unreachable | Server down or wrong URL | Check `SESSION_SHARE_API_URL` and network connectivity |
| 401 Unauthorized | Invalid or missing API key | Set `SESSION_SHARE_API_KEY` environment variable |
| 400 Validation failed | Malformed JSONL content | Check that the JSONL file is valid |
| 500 Server error | Platform issue | Retry later or check server logs |

## Technical Notes

- The session JSONL format follows Claude Code's internal message format
- Each line is a JSON object with fields: type, uuid, parentUuid, message, timestamp, etc.
- Subagent sessions are stored in `~/.claude/projects/<encoded-cwd>/subagents/<agent-name>/`
- The evaluation uses LLM-as-a-Judge pattern with configurable providers
- Member uploads (with API key) get 180-day retention vs 7-day for guest uploads
