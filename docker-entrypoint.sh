#!/bin/sh
set -e

# Apply committed migrations (creates/updates the SQLite DB). Invoke the CLI
# entry directly so it runs offline without an npx network lookup.
echo "Running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

# Start the Next.js standalone server (listens on $PORT / $HOSTNAME).
echo "Starting server..."
exec node server.js
