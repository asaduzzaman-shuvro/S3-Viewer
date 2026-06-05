import json
import re
import sys

data = json.load(sys.stdin)
cmd = data.get("tool_input", {}).get("command", "")

# Match .env, .env.local, .env.example, etc. as a standalone file reference
if re.search(r"(?:^|[\s/|>&;'\"])\.env(?:\.[^\s|>&;'\"]*)?(?=\s|$|[|>&;'\"])", cmd):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": ".env files are blocked from being accessed via shell commands"
        }
    }))
