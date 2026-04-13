---
name: session-share
description: |
  Use when the user wants to submit, share, or upload a Claude Code session
  for evaluation and analysis. Triggers on phrases like "submit session",
  "share this conversation", "upload session", "evaluate this session",
  or when user mentions scoring/reviewing their current conversation.
---

# Session Share Skill

Submit the current Claude Code session to the Session Eval platform for evaluation.

## Trigger Conditions

- User says "submit session", "share session", "upload session"
- User says "help me evaluate this conversation"
- User wants to score the current conversation
- User mentions phrases like "evaluate this", "review this session", "share this chat"

## Workflow

### 1. Detect Current Session

Read `~/.claude/projects/<encoded-cwd>/` directory to find:
- The most recently modified `.jsonl` file (current active session)
- Or locate by user-specified session ID

The encoded-cwd is the base64-encoded URL-safe version of the current working directory path.

### 2. Read Session Data

- Read the complete JSONL file content
- Parse to identify subagent sessions (in `subagents/` subdirectory)
- Calculate metadata (message count, tool calls, duration, models used)

### 3. Submit to Platform

POST to `/api/sessions` with:

```json
{
  "rawJsonl": "<complete jsonl content>",
  "title": "Optional title",
  "description": "Optional description"
}
```

The API will:
1. Parse the JSONL content
2. Generate a unique share token
3. Create the session record
4. Trigger an async evaluation (MODEL_FEEDBACK type)

### 4. Return Results

Display to the user:
- Share link: `https://your-domain.com/s/{shareToken}`
- Inform user evaluation is running in background (expected ~30 seconds)
- If subagents exist, show related links

## API Configuration

The skill uses these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_EVAL_API_URL` | Base URL for API | `http://localhost:3000/api` |
| `SESSION_EVAL_API_KEY` | Optional API key for authentication | (none) |

## Example Interaction

**User:** Help me submit this session

**Claude:**
```
Submitting current session...
[Reading ~/.claude/projects/...]
[POST to /api/sessions]

Session submitted successfully!

Share link: https://session-eval.com/s/abc123

Evaluation is running in the background. Please refresh the page in ~30 seconds to see the scoring results.

Related subagent sessions:
- researcher: https://session-eval.com/s/def456
```

## Error Handling

1. **No session found**: Prompt user to ensure they have an active Claude Code session
2. **API unreachable**: Suggest checking if the server is running and SESSION_EVAL_API_URL is correct
3. **Authentication failed**: Remind user to set SESSION_EVAL_API_KEY if required
4. **Parse error**: Report the malformed JSONL line and suggest manual review

## Technical Notes

- The session JSONL format follows Claude Code's internal message format
- Each line is a JSON object with fields: type, uuid, parentUuid, message, timestamp, etc.
- Subagent sessions are stored in `~/.claude/projects/<encoded-cwd>/subagents/<agent-name>/`
- The evaluation uses LLM-as-a-Judge pattern with configurable providers
