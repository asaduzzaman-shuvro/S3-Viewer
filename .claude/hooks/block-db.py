import json
import re
import sys

# PreToolUse hook for the Read and Bash tools. Blocks any attempt to read the
# local SQLite database (prisma/dev.db and its -wal/-shm/-journal sidecars),
# which stores AES-256-GCM-encrypted S3 credentials.
data = json.load(sys.stdin)
tool_input = data.get("tool_input", {})

# Read tool: a path ending in dev.db (or a sidecar).
file_path = tool_input.get("file_path", "")
path_hit = re.search(r"(^|/)dev\.db(-(wal|shm|journal))?$", file_path)

# Bash tool: dev.db referenced as a standalone token in the command
# (e.g. `sqlite3 prisma/dev.db`, `cat ./dev.db`, `strings dev.db-wal`).
command = tool_input.get("command", "")
cmd_hit = re.search(r"(?:^|[\s/|>&;'\"])dev\.db(?:-(?:wal|shm|journal))?(?=\s|$|[|>&;'\"])", command)

if path_hit or cmd_hit:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "The SQLite DB (prisma/dev.db) is blocked from being read — it stores encrypted S3 credentials."
        }
    }))
