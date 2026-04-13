# session-submit Skill

Submit conversation sessions for evaluation and analysis.

## Overview

The `session-submit` skill allows you to package and submit Claude Code conversation sessions to the session evaluation system. This enables systematic review, scoring, and analysis of conversation quality and effectiveness.

## Installation

This skill is automatically available when cloned into the `.claude/skills/session-submit/` directory.

## Usage

### Basic Usage

```
/session-submit
```

Submits the current session with default settings (medium priority, no tags).

### With Options

```
/session-submit --priority high --tags coding,debugging
```

```
/session-submit --notes "Complex refactoring session with multiple iterations"
```

```
/session-submit --session-id abc123 --evaluator reviewer@example.com
```

## Arguments

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `session_id` | string | No | Current session | Unique identifier of the session to submit |
| `evaluator` | string | No | null | Assign a specific evaluator for review |
| `tags` | array | No | [] | Tags for categorization (e.g., `coding`, `debugging`, `feature`) |
| `notes` | string | No | "" | Additional notes or comments |
| `priority` | enum | No | "medium" | Priority level: `low`, `medium`, or `high` |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_EVAL_API_URL` | No | Base URL for the evaluation API (default: `http://localhost:3000/api`) |
| `SESSION_EVAL_API_KEY` | Yes | API key for authentication |

## Examples

### Submit Current Session

Simply run the skill to submit the current conversation:

```
/session-submit
```

### Tag and Prioritize

Mark a session as high-priority coding work:

```
/session-submit --priority high --tags coding,feature,frontend
```

### Submit with Context

Add notes explaining the session context:

```
/session-submit --notes "Initial implementation of user authentication feature with OAuth2 integration"
```

### Assign to Reviewer

Direct a session to a specific evaluator:

```
/session-submit --evaluator senior-reviewer@company.com
```

## What Gets Submitted

When you submit a session, the following data is packaged:

- **Conversation transcript**: Full message history
- **Tool calls**: All tool invocations and responses
- **Metadata**: Timestamps, session duration, model version
- **Context**: Working directory, git status, project info
- **Custom data**: Any tags, notes, or priority settings provided

## Response

After submission, you'll receive:

- **Session ID**: Unique identifier for tracking
- **Status**: Confirmation of successful submission
- **Queue Position**: Estimated position in evaluation queue
- **URL**: Link to view session details (if applicable)

## Troubleshooting

### Authentication Error

Ensure `SESSION_EVAL_API_KEY` is set in your environment:

```bash
export SESSION_EVAL_API_KEY="your-api-key-here"
```

### Connection Refused

Check that the evaluation service is running and `SESSION_EVAL_API_URL` is correct:

```bash
export SESSION_EVAL_API_URL="http://your-server:port/api"
```

### Invalid Session ID

If specifying a `session_id`, ensure it exists and is accessible.

## Related Skills

- `session-view`: View submitted session details
- `session-list`: List all submitted sessions
- `session-export`: Export session data in various formats

## License

MIT