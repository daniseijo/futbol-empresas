#!/bin/sh
# Vercel's Ignored Build Step (`ignoreCommand` in vercel.json): exit 0 skips the
# deployment, exit 1 builds it. Skips pushes that only touch docs, Markdown,
# GitHub workflows or agent config, none of which the site uses.
#
# Compares against the last successful deployment of the branch, so a push of
# several commits is judged as a whole. Builds when that commit is unknown (a
# branch's first deployment, or older than Vercel's shallow clone).
base=${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}
git cat-file -e "$base^{commit}" 2>/dev/null || exit 1
# The same commit as the last deployment: a redeploy someone asked for (after
# changing environment variables, say), which must build.
[ "$(git rev-parse "$base")" = "$(git rev-parse HEAD)" ] && exit 1

git diff --quiet "$base" HEAD -- . \
  ':(exclude)docs' \
  ':(exclude)*.md' \
  ':(exclude).github' \
  ':(exclude).agents' \
  ':(exclude).claude'
