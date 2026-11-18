#!/usr/bin/env python3
"""Assert a Python expression against a JSON body read from stdin.

Usage: curl ... | python3 scripts/dogeos-verify/assert_json.py "<expression using d>"

Kept in its own file so the proof script never has to nest quotes inside `python3 -c`
(the expressions contain both single and double quotes and non-ASCII chain names).

Exit codes: 0 = assertion passed, 1 = assertion failed or the body was not JSON.
"""

import json
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: assert_json.py '<expression using d>'", file=sys.stderr)
        return 2
    expression = sys.argv[1]
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        print(f"body is not JSON: {error}", file=sys.stderr)
        return 1

    try:
        # Expressions come from this repository's proof script, not from user input.
        result = eval(expression, {"d": payload, "json": json})  # noqa: S307
    except Exception as error:  # noqa: BLE001 - report any evaluation failure
        print(f"could not evaluate: {expression} ({error})", file=sys.stderr)
        return 1

    if not result:
        print(f"assertion failed: {expression}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
