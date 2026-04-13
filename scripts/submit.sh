#!/bin/bash
# submit.sh - Submit current Claude Code session to Session Share platform
# Linux/Mac only. For Windows, use submit.mjs (Node.js) instead.
#
# Usage:
#   bash submit.sh [--title "Title"] [--description "Description"] [--private] [--key API_KEY]
#
# Environment Variables:
#   SESSION_SHARE_API_URL - Base URL for API (default: https://eval.569169.xyz/api)
#   SESSION_SHARE_API_KEY - API key for member uploads

set -e

# Configuration
API_URL="${SESSION_SHARE_API_URL:-${SESSION_EVAL_API_URL:-https://eval.569169.xyz/api}}"
API_KEY="${SESSION_SHARE_API_KEY:-${SESSION_EVAL_API_KEY:-}}"

# Parse arguments
TITLE=""
DESCRIPTION=""
IS_PUBLIC="true"
EXTRA_KEY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --title) TITLE="$2"; shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --private) IS_PUBLIC="false"; shift ;;
    --key) EXTRA_KEY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Use CLI key if provided
if [[ -n "$EXTRA_KEY" ]]; then
  API_KEY="$EXTRA_KEY"
fi

# Find Claude Code projects directory
CLAUDE_DIR="$HOME/.claude/projects"

if [[ ! -d "$CLAUDE_DIR" ]]; then
  echo "Error: Claude Code projects directory not found at $CLAUDE_DIR"
  exit 1
fi

# Encode current working directory to find the session file
ENCODED_CWD=$(echo "$PWD" | sed 's|/|-|g')
SESSION_DIR="$CLAUDE_DIR/$ENCODED_CWD"

# Fallback: try with colon encoding (older Claude Code versions)
if [[ ! -d "$SESSION_DIR" ]]; then
  ENCODED_CWD=$(echo "$PWD" | sed 's|/|:|g')
  SESSION_DIR="$CLAUDE_DIR/$ENCODED_CWD"
fi

if [[ ! -d "$SESSION_DIR" ]]; then
  echo "Error: Could not find session directory for current working directory"
  echo "Searched for: $PWD"
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

# Count messages
MESSAGE_COUNT=$(wc -l < "$SESSION_FILE" | tr -d ' ')
echo "Session contains $MESSAGE_COUNT messages"

# Check if base64 encoding is needed (>500KB)
CONTENT_SIZE=$(wc -c < "$SESSION_FILE" | tr -d ' ')
USE_BASE64="false"

if [[ "$CONTENT_SIZE" -gt 512000 ]]; then
  USE_BASE64="true"
  echo "Large session ($(($CONTENT_SIZE / 1024))KB), using base64 encoding"
fi

# Build JSON payload using jq
if [[ "$USE_BASE64" == "true" ]]; then
  B64_CONTENT=$(base64 -w 0 "$SESSION_FILE")
  BASE_PAYLOAD="{\"rawJsonl\":$(echo "$B64_CONTENT" | jq -Rs .),\"encoding\":\"base64\",\"isPublic\":$IS_PUBLIC}"
else
  BASE_PAYLOAD="{\"rawJsonl\":$(echo "$SESSION_CONTENT" | jq -Rs .),\"isPublic\":$IS_PUBLIC}"
fi

# Add optional fields
PAYLOAD="$BASE_PAYLOAD"
if [[ -n "$TITLE" ]]; then
  PAYLOAD=$(echo "$PAYLOAD" | jq --arg t "$TITLE" '. + {title: $t}')
fi
if [[ -n "$DESCRIPTION" ]]; then
  PAYLOAD=$(echo "$PAYLOAD" | jq --arg d "$DESCRIPTION" '. + {description: $d}')
fi

# Submit to API
API_ENDPOINT="${API_URL%/}/sessions"
echo "Submitting to $API_ENDPOINT..."

HEADERS=(-H "Content-Type: application/json")
if [[ -n "$API_KEY" ]]; then
  HEADERS+=(-H "x-session-eval-key: $API_KEY")
  echo "Using API key for member upload"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT" "${HEADERS[@]}" -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
  echo "Error: API returned status $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi

# Parse response
SHARE_TOKEN=$(echo "$BODY" | jq -r '.shareToken // empty')
SHARE_URL=$(echo "$BODY" | jq -r '.shareUrl // empty')
STORAGE_TIER=$(echo "$BODY" | jq -r '.storageTier // empty')
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

# Success
echo ""
echo "=================================================="
echo "Session submitted successfully!"
echo "=================================================="
echo ""

if [[ -n "$SHARE_URL" ]]; then
  echo "Share link: $SHARE_URL"
else
  echo "Share link: ${API_URL%/api}/s/${SHARE_TOKEN}"
fi

if [[ -n "$STORAGE_TIER" ]]; then
  echo "Storage tier: $STORAGE_TIER"
fi

EVAL_ALLOWED=$(echo "$BODY" | jq -r '.evaluationAllowed // false')
if [[ "$EVAL_ALLOWED" == "true" ]]; then
  echo ""
  echo "Evaluation is running in the background (~30 seconds)."
  echo "Open the share link and refresh to see scoring results."
fi

echo ""
