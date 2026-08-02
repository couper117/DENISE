#!/usr/bin/env bash
#
# Monorepo entrypoint for hosts that run from the repository root.
#
# You usually DON'T need this file: if you can set your host's "Root Directory"
# to `backend`, then railway.json / render.yaml already define the build and
# start commands. Use this only when the host builds/starts from the repo root.
#
set -euo pipefail

# Always operate on backend/, regardless of the caller's working directory.
cd "$(dirname "$0")/backend"

npm install                 # installs deps (also generates the Prisma client)
npm run build               # prisma generate && tsc  ->  dist/
npx prisma migrate deploy   # apply migrations to the database (e.g. Aiven)
npm run start               # node dist/index.js
