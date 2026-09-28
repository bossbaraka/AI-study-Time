"""Codemod: make engine call sites in tests await the now-async engines.

Order matters:
  1. add_awaits  — inserts `await`, skipping calls inside `expect(() => …)`
  2. to_rejects  — rewrites those skipped ones to `.rejects.toThrow`
"""

import re
import sys
import pathlib

ENGINES = ("mockAssessmentEngine", "mockGoalEngine", "mockRoadmapEngine", "mockExecutionEngine")
ARROW = re.compile(r"expect\(\(\)\s*=>\s*")


def match_paren(s: str, open_index: int) -> int:
    depth = 0
    i = open_index
    while i < len(s):
        c = s[i]
        if c in "\"'`":
            quote = c
            i += 1
            while i < len(s) and s[i] != quote:
                if s[i] == "\\":
                    i += 1
                i += 1
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unbalanced parens")


def arrow_spans(s: str):
    """(body_start, body_end) for every `expect(() => …)` arrow body."""
    for m in ARROW.finditer(s):
        yield m.end(), match_paren(s, m.start() + len("expect"))


def engine_call_spans(s: str):
    for engine in ENGINES:
        for m in re.finditer(rf"\b{engine}\.[a-zA-Z_]+\(", s):
            yield m.start(), match_paren(s, m.end() - 1) + 1


def add_awaits(s: str) -> str:
    protected = list(arrow_spans(s))
    out = []
    last = 0
    for start, end in sorted(engine_call_spans(s)):
        if re.search(r"(await\s+|return\s+|\.\s*)$", s[:start]):
            continue
        if any(a <= start < b for a, b in protected):
            continue  # handled by to_rejects
        call = s[start:end]
        # `await` binds looser than `.`/`?.`/`[]`: (await engine.x()).prop
        if re.match(r"\s*(\?\.|\.|\[)", s[end:]):
            call = f"(await {call})"
        else:
            call = f"await {call}"
        out.append(s[last:start])
        out.append(call)
        last = end
    out.append(s[last:])
    return "".join(out)


def to_rejects(s: str) -> str:
    """expect(() => [await] ENGINE.x(...)).toThrow(A)
       ->  await expect(ENGINE.x(...)).rejects.toThrow(A)"""
    guard = 0
    while True:
        guard += 1
        if guard > 500:
            raise RuntimeError("to_rejects did not converge")
        m = ARROW.search(s)
        if not m:
            break
        body_start = m.end()
        rest = s[body_start:].lstrip()
        inner_start = body_start + (len(s[body_start:]) - len(rest))
        if not rest.startswith(ENGINES):
            s = s[: m.start()] + "\x00" + s[m.start() + 1 :]
            continue
        call_end = match_paren(s, body_start + s[body_start:].index("(")) + 1
        after = s[call_end:]
        tm = re.match(r"\s*\)\s*\.\s*toThrow\s*\(", after)
        if not tm:
            s = s[: m.start()] + "\x00" + s[m.start() + 1 :]
            continue
        throw_open = call_end + tm.end() - 1
        throw_close = match_paren(s, throw_open)
        inner = s[inner_start:call_end].strip()
        inner = re.sub(r"^await\s+", "", inner)  # the promise itself is asserted
        args = s[throw_open + 1 : throw_close]
        s = (
            s[: m.start()]
            + f"await expect({inner}).rejects.toThrow({args})"
            + s[throw_close + 1 :]
        )
    return s.replace("\x00", "e")


def fix_api_error_of(s: str) -> str:
    s = s.replace(
        "function apiErrorOf(fn: () => unknown): ApiError {\n  try {\n    fn();",
        "async function apiErrorOf(fn: () => Promise<unknown>): Promise<ApiError> {\n  try {\n    await fn();",
    )
    return re.sub(r"(?<!await )\bapiErrorOf\(\(\)\s*=>\s*", "await apiErrorOf(async () => ", s)


def make_callbacks_async(s: str) -> str:
    for fn in ("it", "test", "beforeEach", "afterEach", "beforeAll", "afterAll"):
        s = re.sub(
            rf"\b{fn}\((\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)(\s*,)?\s*\(\)\s*=>\s*\{{",
            lambda m, fn=fn: f"{fn}({m.group(1)}{m.group(2) or ''} async () => {{",
            s,
        )
    s = re.sub(r"(\)\s*\([^)]*,)\s*\(\)\s*=>\s*\{", r"\1 async () => {", s)
    return s


for path in sys.argv[1:]:
    p = pathlib.Path(path)
    s = p.read_text()
    before = s
    s = add_awaits(s)
    s = to_rejects(s)
    s = fix_api_error_of(s)
    s = make_callbacks_async(s)
    if s != before:
        p.write_text(s)
        print("rewrote", path)
    else:
        print("unchanged", path)
