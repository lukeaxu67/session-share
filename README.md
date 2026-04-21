# Session Share - Claude Code Skill

A Claude Code skill for submitting conversation sessions to the [Session Share](https://eval.569169.xyz) platform for sharing and evaluation.

## Install

```bash
npx skills add lukeaxu67/session-share
```

## Usage

In any Claude Code session, trigger the skill with phrases like:

- "submit session" / "提交会话"
- "share this conversation" / "分享会话"
- "evaluate this session" / "评估一下这个对话"

Or run directly:

```bash
node .claude/skills/session-share/scripts/submit.mjs
```

### Options

```bash
node .claude/skills/session-share/scripts/submit.mjs --title "My Session" --description "Description"
node .claude/skills/session-share/scripts/submit.mjs --private    # Member-only access
node .claude/skills/session-share/scripts/submit.mjs --key se_xxx # Override API key
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SHARE_API_URL` | `https://eval.569169.xyz/api` | API base URL |
| `SESSION_SHARE_API_KEY` | (none) | API key for member uploads (180-day retention + evaluations) |

Legacy variables `SESSION_EVAL_API_URL` and `SESSION_EVAL_API_KEY` are also supported.

## What Gets Submitted

- **Conversation transcript**: Full message history including tool calls
- **Metadata**: Timestamps, duration, models used
- **Context**: Working directory, git status

## API

```
POST /api/sessions
Content-Type: application/json
x-session-eval-key: <API_KEY>  (optional)

{
  "rawJsonl": "<jsonl content or base64>",
  "title": "Optional title",
  "description": "Optional description",
  "isPublic": true,
  "encoding": "utf-8"  // or "base64" for large sessions
}
```

Response (201):

```json
{
  "shareToken": "abc123",
  "shareUrl": "https://eval.569169.xyz/s/abc123",
  "storageTier": "MEMBER",
  "expiresAt": "2026-10-10T00:00:00Z",
  "evaluationAllowed": true
}
```

## Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `scripts/submit.mjs` | All (Node.js) | Cross-platform submit script (recommended) |
| `scripts/submit.sh` | Linux/Mac | Bash submit script |

## License

MIT
