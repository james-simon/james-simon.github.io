#!/bin/zsh
# Monthly refresh of the blog post embeddings behind /t-sne/.
#
# Re-embeds any new or edited posts, then commits the updated JSON.
# It deliberately does NOT push -- that stays a manual step.
#
# Scheduled by ~/Library/LaunchAgents/com.jamie.blog-embeddings.plist
# Log: blogpost_embs/refresh.log

set -u

REPO="/Users/jamie/Projects/james-simon.github.io"
LOG="$REPO/blogpost_embs/refresh.log"

exec >> "$LOG" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') starting refresh ==="

# OPENAI_API_KEY lives in .zshrc, which launchd does not source.
if [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc" > /dev/null 2>&1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: OPENAI_API_KEY not set; aborting without changes."
  exit 1
fi

cd "$REPO" || { echo "ERROR: cannot cd to $REPO"; exit 1; }

# Only touch the embeddings file; never disturb other work in progress.
if ! git diff --quiet -- blogpost_embs/blog_embeddings.json; then
  echo "NOTE: blog_embeddings.json already has uncommitted changes; aborting."
  exit 1
fi

python3 blogpost_embs/generate_embeddings.py || { echo "ERROR: generation failed"; exit 1; }

if git diff --quiet -- blogpost_embs/blog_embeddings.json; then
  echo "No embedding changes; nothing to commit."
else
  git add blogpost_embs/blog_embeddings.json
  git commit -q -m "Refresh blog post embeddings

Monthly regeneration of the embeddings behind the t-SNE page.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  echo "Committed: $(git log --oneline -1)"
  echo "Not pushed -- run 'git push origin master' when ready."
fi

echo "=== done ==="
