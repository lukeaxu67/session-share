#!/bin/bash
# submit.sh - Submit current Claude Code session to Session Eval platform
#
# Usage:
#   /session-submit [--title "Title"] [--description "Description"]
#
# Environment Variables:
#   SESSION_EVAL_API_URL - Base URL for API (default: http://localhost:3000/api)
#   SESSION_EVAL_API_KEY - Optional API key for authentication

set -e

# Configuration
API_URL="${SESSION_EVAL_API_URL:-http://localhost:3000/api}"
API_KEY="${SESSION_EVAL_API_KEY:-}"

# Parse command line arguments
TITLE=""
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --title)
      TITLE="$2"
      shift 2
      ;;
    --description)
      DESCRIPTION="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Find Claude Code projects directory
CLAUDE_DIR="$HOME/.claude/projects"

if [[ ! -d "$CLAUDE_DIR" ]]; then
  echo "Error: Claude Code projects directory not found at $CLAUDE_DIR"
  exit 1
fi

# Encode current working directory to find the session file
# Claude Code uses URL-safe base64 encoding
encode_cwd() {
  local cwd="$1"
  # Replace / with : and URL-encode special characters
  echo -n "$cwd" | sed 's|/|:|g' | while IFS= read -r char; do
    case "$char" in
      :) printf '%s' ':' ;;
      *) printf '%s' "$char" ;;
    esac
  done
}

# Try to find the session file
# First, try the simple encoding (replace / with :)
ENCODED_CWD=$(echo "$PWD" | sed 's|/|:|g')
SESSION_DIR="$CLAUDE_DIR/$ENCODED_CWD"

# If not found, try URL-safe base64 encoding
if [[ ! -d "$SESSION_DIR" ]]; then
  # Try base64 encoding
  ENCODED_CWD=$(echo -n "$PWD" | base64 | tr '/+' '_-' | tr -d '=')
  SESSION_DIR="$CLAUDE_DIR/$ENCODED_CWD"
fi

if [[ ! -d "$SESSION_DIR" ]]; then
  echo "Error: Could not find session directory for current working directory"
  echo "Expected: $SESSION_DIR"
  echo "Available projects:"
  ls -1 "$CLAUDE_DIR" 2>/dev/null | head -5
  exit 1
fi

# Find the most recent .jsonl file
SESSION_FILE=$(find "$SESSION_DIR" -maxdepth 1 -name "*.jsonl" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

if [[ -z "$SESSION_FILE" ]]; then
  echo "Error: No session file found in $SESSION_DIR"
  exit 1
fi

echo "Found session file: $SESSION_FILE"

# Read session content
SESSION_CONTENT=$(cat "$SESSION_FILE")

if [[ -z "$SESSION_CONTENT" ]]; then
  echo "Error: Session file is empty"
  exit 1
fi

# Count messages for info
MESSAGE_COUNT=$(wc -l < "$SESSION_FILE" | tr -d ' ')
echo "Session contains $MESSAGE_COUNT messages"

# Build JSON payload
if [[ -n "$TITLE" || -n "$DESCRIPTION" ]]; then
  # Escape special characters for JSON
  TITLE_ESCAPED=$(echo "$TITLE" | jq -Rs .)
  DESC_ESCAPED=$(echo "$DESCRIPTION" | jq -Rs .)
  PAYLOAD="{\"rawJsonl\":$(echo "$SESSION_CONTENT" | jq -Rs .),\"title\":$TITLE_ESCAPED,\"description\":$DESC_ESCAPED}"
else
  PAYLOAD="{\"rawJsonl\":$(echo "$SESSION_CONTENT" | jq -Rs .)}"
fi

# Submit to API
echo "Submitting to $API_URL/sessions..."

HEADERS=(-H "Content-Type: application/json")
if [[ -n "$API_KEY" ]]; then
  HEADERS+=(-H "Authorization: Bearer $API_KEY")
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/sessions" "${HEADERS[@]}" -d "$PAYLOAD")

# Split response and status code
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
  echo "Error: API returned status $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi

# Extract share token
SHARE_TOKEN=$(echo "$BODY" | jq -r '.shareToken // empty')
ERROR=$(echo "$BODY" | jq -r '.error // empty')

if [[ -n "$ERROR" ]]; then
  echo "Error: $ERROR"
  echo "Full response: $BODY"
  exit 1
fi

if [[ -z "$SHARE_TOKEN" ]]; then
  echo "Error: No share token in response"
  echo "Full response: $BODY"
  exit 1
fi

# Success!
echo ""
echo "============================================"
echo "Session submitted successfully!"
echo "============================================"
echo ""
echo "Share link: ${API_URL%/api}/s/${SHARE_TOKEN}"
echo ""

# Check for evaluation status
EVAL_STATUS=$(echo "$BODY" | jq -r '.evaluationStatus // empty')
if [[ -n "$EVAL_STATUS" ]]; then
  echo "Evaluation status: $EVAL_STATUS"
  echo "Evaluation will run in the background (~30 seconds)"
fi

# Check for subagent links
SUBAGENTS=$(echo "$BODY" | jq -r '.subagentLinks // empty')
if [[ -n "$SUBAGENTS" && "$SUBAGENTS" != "null" && "$SUBAGENTS" != "[]" ]]; then
  echo ""
  echo "Related subagent sessions:"
  echo "$SUBAGENTS" | jq -r '.[] | "  - \(.name // "Subagent"): '"${API_URL%/api}"'/s/\(.shareToken)"' 2>/dev/null || true
fi

echo ""