#!/usr/bin/env python3
"""Validate a ProductSage content import file for the Sage_AI Product Owner LinkedIn Content skill.

Usage:
  python3 validate_import.py FILE [options]

Exit status: 0 when nothing failed, 1 when one or more checks failed, 2 when the file could not be read.
The script only reads the file. It never changes it.

Options:
  --sentence-limit N      A body sentence with N or more words fails. Default 10.
  --template-id ID        An extra template ID the Product Owner's profile defines. Repeat as needed.
  --allow-tell WORD       A word or phrase from the tells list that the Product Owner really uses. Repeat as needed.
  --forbid TEXT           A name or word that must not appear in a title or body. Repeat as needed.
  --warn-chars N          Warn when the file is longer than N characters. Default 65000.
  --max-chars N           Fail when the file is longer than N characters. Default none.
"""
import argparse
import json
import re
import sys
import unicodedata
from datetime import date

SCHEMA_VERSION = "1.0"
CONTENT_TYPES = {"Article", "Carousel", "Post", "Thread", "Video", "Other"}
ENVELOPE_FIELDS = {
    "schema_version", "account_id", "property", "step", "content_type", "project_number",
    "item_count", "generated_on", "generated_by", "items",
}
ENVELOPE_REQUIRED = ["schema_version", "account_id", "property", "step", "content_type", "item_count", "items"]
ITEM_FIELDS = {
    "item_ref", "title", "body", "notes", "media_source_url", "media_url", "media_source_code",
    "schedule_date", "posted_date", "posted_url",
}
URL_FIELDS = ["media_source_url", "media_url", "posted_url"]
DATE_FIELDS = ["schedule_date", "posted_date"]

# The character library. Keep this in step with references/style-guide.md.
CHARACTER_LIBRARY = set(
    "→←↑↓↔↩↪⇨⇒◦▸□▷"
    "✦✧✩✶✱―─═✓✔✗✘○"
    "◉●◎⚪⚫▹▻⋆➤"
)
LIST_SYMBOLS = CHARACTER_LIBRARY - {"―", "─", "═"}
CURLY_QUOTES = set("‘’“”")
EM_EN = (chr(0x2014), chr(0x2013))

TEMPLATE_IDS = {"CF_LI_Post_" + c for c in "ABCDEFGHIJKLMNO"}

# Fixed template lines that stay as written because the template ID tracks performance.
# They are exempt from the sentence length check only.
FIXED_LINES = {
    "in my humble opinion, you will get better results this way.",
    "this experience reminded us that even small wins can lead to significant improvements.",
    "it might seem small, but it's made a big difference!",
}

# Fixed lines that take a variable and still run 10 words or more at their shortest.
FIXED_PATTERNS = [
    re.compile(r"^the future of .{1,60} is arriving faster than we think\.$", re.I),
    re.compile(r"^one of the great things about having experience with .{1,60} is you learn .+\.$", re.I),
]

EMOTICON = re.compile(r"(?<!\w)[:;=8][\-o^']?[)(DPpOo/\\|](?!\w)")
HTML_TAG = re.compile(r"</?[A-Za-z][^>]*>|<!--|<!DOCTYPE", re.I)
HEADING = re.compile(r"^\s{0,3}#{1,6}\s", re.M)
HYPHEN_LIST = re.compile(r"^\s*[-+]\s+\S", re.M)
NUMBER_LIST = re.compile(r"^\s*\d+[.)]\s+\S", re.M)

CTA_PHRASES = [
    "let me know", "what do you think", "what's your experience", "what is your experience",
    "drop a comment", "comment below", "comments below", "in the comments", "share your thoughts",
    "tell me in the comments", "tag someone", "tag a ", "dm me", "follow me", "like and share",
    "like if you", "repost if", "sound off", "what would you add", "thoughts?", "agree?",
    "do you agree", "who else", "click the link", "link in the comments", "link in comments",
]

TELL_WORDS = [
    "additionally", "align with", "aligns with", "aligned with", "bolster", "crucial", "deep dive",
    "delve", "delves", "delving", "enduring", "enhance", "enhances", "enhancing", "garner",
    "garnered", "interplay", "intricate", "intricacies", "landscape", "meticulous", "meticulously",
    "pivotal", "quietly", "robust", "showcase", "showcases", "showcasing", "tapestry", "testament",
    "underscore", "underscores", "underscoring", "vibrant", "navigate the", "in today's fast-paced",
    "game-changer", "game-changing", "game changer", "revolutionary", "cutting-edge", "cutting edge",
    "supercharge", "seamless", "seamlessly", "world-class", "best-in-class", "next level",
    "unlock the", "unleash",
]
TELL_PHRASES = [
    r"let'?s dive in", r"let'?s explore", r"let'?s break (this|it) down", r"here'?s what you need to know",
    r"here'?s the thing", r"the thing is,", r"let'?s be honest", r"real talk", r"\bhonestly\?",
    r"without further ado", r"don'?t get me wrong", r"to be clear,", r"i'?m not saying",
    r"this is not to say", r"read that again", r"let that sink in", r"the real question is",
    r"at its core", r"what really matters", r"the heart of the matter", r"the deeper issue",
    r"stands? as a testament", r"a pivotal moment", r"plays? a (key|crucial|vital) role",
    r"indelible mark", r"the future looks bright", r"exciting times (lie )?ahead",
    r"a step in the right direction", r"i hope this helps", r"great question", r"as an ai\b",
    r"feel free to", r"certainly!", r"\bi'?d be happy to\b", r"in conclusion", r"in summary,",
    r"take (it|your \w+) to the next level",
    # not X but Y
    r"\bnot (just|only|merely|simply)\b[^.!?\n]{0,80}\bbut\b",
    r"\bit'?s not\b[^.!?\n]{0,60}[,;] ?it'?s\b",
    r"\bit is not\b[^.!?\n]{0,60}[,;] ?it is\b",
    r"\b(this|that) (does not|doesn'?t) mean\b",
    r"\bisn'?t (just|only|about)\b[^.!?\n]{0,60}[,;.] ?(it'?s|it is)\b",
    # trailing -ing riders
    r", (highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|contributing to|cultivating|fostering|encompassing|showcasing)\b",
]
TELL_PHRASE_RES = [re.compile(p, re.I) for p in TELL_PHRASES]

NOTES_LABELS = [
    ("Hook 2:", "Hook 2"),
    ("Hook 3:", "Hook 3"),
    ("Share text:", "Share text"),
    ("Image headline:", "Image headline"),
]


class Report:
    def __init__(self):
        self.fails = []
        self.warns = []

    def fail(self, where, msg):
        self.fails.append((where, msg))

    def warn(self, where, msg):
        self.warns.append((where, msg))


def iter_strings(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from iter_strings(k, path + "<key>")
            yield from iter_strings(v, path + "." + str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_strings(v, path + "[" + str(i) + "]")
    elif isinstance(obj, str):
        yield path, obj


def split_units(text, symbols=LIST_SYMBOLS):
    """Split a body into the sentences the sentence length check reads."""
    units = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line[0] in symbols or line[0] in CHARACTER_LIBRARY:
            line = line[1:].strip()
        parts = re.split(r"(?<=[.!?])\s+", line)
        units.extend(p for p in parts if p.strip())
    return units


def word_count(sentence):
    return sum(1 for t in sentence.split() if re.search(r"[A-Za-z0-9]", t))


def bad_symbol(ch):
    if ch in CHARACTER_LIBRARY or ch in CURLY_QUOTES or ch in "\n\t":
        return False
    if ord(ch) < 128:
        return False
    cat = unicodedata.category(ch)
    if cat[0] in ("L", "M", "N", "Z"):
        return False
    if ch in EM_EN:
        return False  # reported by the dash check
    return True


def check_text_field(rep, ref, field, text, args, check_symbols=True):
    where = "[%s] %s" % (ref, field)
    for d in EM_EN:
        if d in text:
            rep.fail(where, "contains %s (%s). Use separate short sentences." % (
                "an em dash" if d == EM_EN[0] else "an en dash", "U+%04X" % ord(d)))
    if check_symbols:
        seen = sorted({c for c in text if bad_symbol(c)})
        if seen:
            rep.fail(where, "symbol not in the character library: " + " ".join("%s (U+%04X)" % (c, ord(c)) for c in seen))
        if EMOTICON.search(text):
            rep.fail(where, "looks like an emoticon: %r" % EMOTICON.search(text).group(0))
        if "%" in text:
            rep.fail(where, "leftover template variable marker %")
        if "((" in text or "))" in text:
            rep.fail(where, "leftover template note in double parentheses")
        low = text.lower()
        for phrase in CTA_PHRASES:
            if phrase in low:
                rep.fail(where, "engagement call to action: %r" % phrase)
        low_allowed = [a.lower() for a in args.allow_tell]
        for w in TELL_WORDS:
            if w in low_allowed:
                continue
            if re.search(r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z])", low):
                rep.fail(where, "writing tell, word: %r" % w)
        for rx in TELL_PHRASE_RES:
            m = rx.search(text)
            if m and m.group(0).lower() not in low_allowed:
                rep.fail(where, "writing tell, phrase: %r" % m.group(0))
        for f in args.forbid:
            if re.search(r"\b" + re.escape(f) + r"\b", text, re.I):
                rep.fail(where, "forbidden word or name: %r" % f)


def check_body(rep, ref, body, args):
    where = "[%s] body" % ref
    if not body.strip():
        rep.fail(where, "body is empty")
        return
    if HTML_TAG.search(body):
        rep.fail(where, "contains HTML. The importer escapes it and LinkedIn would show the tags.")
    if "*" in body or "__" in body:
        rep.fail(where, "contains asterisk or underscore emphasis. LinkedIn renders no Markdown.")
    if HEADING.search(body):
        rep.fail(where, "contains a Markdown heading")
    if HYPHEN_LIST.search(body):
        rep.fail(where, "a list line starts with a hyphen. Start it with a character from the library.")
    if NUMBER_LIST.search(body):
        rep.fail(where, "a list line starts with a number. Start it with a character from the library.")
    if "\n\n\n" in body:
        rep.warn(where, "three or more line breaks in a row")
    if "```" in body or re.search(r"\[[^\]]+\]\([^)]+\)", body):
        rep.fail(where, "contains a code fence or link markup. Write a bare URL.")
    if body.rstrip().endswith("?"):
        rep.warn(where, "the post ends with a question. Check that it is not an engagement question.")
    long_units = []
    for unit in split_units(body):
        if unit.strip().lower() in FIXED_LINES or any(rx.match(unit.strip()) for rx in FIXED_PATTERNS):
            continue
        n = word_count(unit)
        if n >= args.sentence_limit:
            long_units.append((n, unit))
    for n, unit in long_units:
        rep.fail(where, "sentence of %d words (limit is under %d): %s" % (n, args.sentence_limit, unit))


def check_notes(rep, ref, notes, args):
    where = "[%s] notes" % ref
    if notes is None or not str(notes).strip():
        rep.fail(where, "notes is empty. It must name the template ID, two hooks, the image text, and the share text.")
        return
    ids = set(re.findall(r"\b[A-Za-z]{2,}_[A-Za-z]{2,}_[A-Za-z]+_[A-Za-z0-9]+\b", notes))
    allowed = TEMPLATE_IDS | set(args.template_id)
    m = re.search(r"Template:\s*([A-Za-z0-9_]+)", notes)
    if not m:
        rep.fail(where, "no 'Template: ID' found")
    elif m.group(1) not in allowed:
        rep.fail(where, "template ID %r is not in the library or the profile" % m.group(1))
    del ids
    for label, name in NOTES_LABELS:
        if label not in notes:
            rep.fail(where, "missing %s (write %r)" % (name, label))
    if "Image subtext:" not in notes and "Image points:" not in notes:
        rep.fail(where, "missing Image subtext or Image points")


def check_media_code(rep, ref, code):
    where = "[%s] media_source_code" % ref
    flat = re.sub(r"\s+", "", code)
    if not code.lstrip().lower().startswith("<!doctype html"):
        rep.fail(where, "does not start with <!DOCTYPE html>")
    if "width:1080px" not in flat or "height:1350px" not in flat:
        rep.fail(where, "html and body are not locked to 1080px by 1350px")
    if "overflow:hidden" not in flat:
        rep.fail(where, "missing overflow:hidden on html and body")
    for d in EM_EN:
        if d in code:
            rep.fail(where, "contains an %s dash" % ("em" if d == EM_EN[0] else "en"))
    if re.search(r"<script", code, re.I):
        rep.fail(where, "contains a script tag")
    if "%" in re.sub(r"[0-9.]+%", "", code):
        rep.warn(where, "contains a percent sign that is not a CSS percentage. Check for a leftover template marker.")


def valid_date(s):
    try:
        y, m, d = (int(p) for p in s.split("-"))
        date(y, m, d)
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", s))
    except Exception:
        return False


def validate(raw_bytes, text, args):
    rep = Report()
    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        rep.fail("file", "starts with a byte order mark. The file must be UTF-8 with no BOM.")
    if len(text) > args.warn_chars:
        rep.warn("file", "%d characters, over the %d guard. The manual imports that worked ran about 65,000." % (len(text), args.warn_chars))
    if args.max_chars and len(text) > args.max_chars:
        rep.fail("file", "%d characters, over the %d limit" % (len(text), args.max_chars))
    try:
        doc = json.loads(text.lstrip("﻿"))
    except json.JSONDecodeError as e:
        rep.fail("file", "not valid JSON: %s at line %d column %d" % (e.msg, e.lineno, e.colno))
        return rep
    if not isinstance(doc, dict):
        rep.fail("file", "the top level is not an object")
        return rep

    for k in doc:
        if k not in ENVELOPE_FIELDS:
            rep.fail("envelope", "unknown field %r" % k)
    for k in ENVELOPE_REQUIRED:
        if k not in doc or doc[k] is None:
            rep.fail("envelope", "missing required field %r" % k)
    if doc.get("schema_version") != SCHEMA_VERSION:
        rep.fail("envelope", "schema_version is %r, expected %r" % (doc.get("schema_version"), SCHEMA_VERSION))
    if "account_id" in doc and (not isinstance(doc["account_id"], int) or isinstance(doc["account_id"], bool)):
        rep.fail("envelope", "account_id must be an integer")
    for k in ("property", "step"):
        if k in doc and not (isinstance(doc[k], str) and doc[k].strip()):
            rep.fail("envelope", "%s must be a non-empty string" % k)
    ct = doc.get("content_type")
    if ct is not None and (not isinstance(ct, str) or ct.strip().lower() not in {c.lower() for c in CONTENT_TYPES}):
        rep.fail("envelope", "content_type %r is not one of %s" % (ct, ", ".join(sorted(CONTENT_TYPES))))
    pn = doc.get("project_number")
    if pn is not None and not isinstance(pn, str):
        rep.fail("envelope", "project_number must be a string such as \"0.3.6\", or null")
    go = doc.get("generated_on")
    if go is not None and not (isinstance(go, str) and valid_date(go)):
        rep.fail("envelope", "generated_on must be YYYY-MM-DD")
    for k in ("generated_by", "property", "step"):
        if isinstance(doc.get(k), str):
            for d in EM_EN:
                if d in doc[k]:
                    rep.fail("envelope", "%s contains an %s dash" % (k, "em" if d == EM_EN[0] else "en"))

    items = doc.get("items")
    if not isinstance(items, list) or not items:
        rep.fail("envelope", "items must be a non-empty array")
        return rep
    ic = doc.get("item_count")
    if isinstance(ic, int) and ic != len(items):
        rep.fail("envelope", "item_count is %d but items holds %d" % (ic, len(items)))
    elif "item_count" in doc and not isinstance(ic, int):
        rep.fail("envelope", "item_count must be an integer")

    refs, titles = {}, {}
    for i, it in enumerate(items):
        ref = it.get("item_ref") if isinstance(it, dict) and isinstance(it.get("item_ref"), str) else "item %d" % (i + 1)
        if not isinstance(it, dict):
            rep.fail(ref, "item is not an object")
            continue
        for k in it:
            if k not in ITEM_FIELDS:
                rep.fail("[%s]" % ref, "unknown field %r" % k)
        if not isinstance(it.get("item_ref"), str) or not it.get("item_ref", "").strip():
            rep.fail("[%s]" % ref, "item_ref is missing")
        else:
            if it["item_ref"] in refs:
                rep.fail("[%s]" % ref, "item_ref repeats item %d" % refs[it["item_ref"]])
            refs[it["item_ref"]] = i + 1
        title = it.get("title")
        if not isinstance(title, str) or not title.strip():
            rep.fail("[%s] title" % ref, "title is missing")
        else:
            if len(title) > 255:
                rep.fail("[%s] title" % ref, "title is %d characters, the limit is 255" % len(title))
            key = title.strip().casefold()
            if key in titles:
                rep.fail("[%s] title" % ref, "title repeats item %d. A duplicate title refuses the whole file." % titles[key])
            titles[key] = i + 1
            if len(title.split()) < 3:
                rep.warn("[%s] title" % ref, "title is very short. It must tell this post from the other %d." % (len(items) - 1))
            check_text_field(rep, ref, "title", title, args)
        for f in DATE_FIELDS:
            v = it.get(f)
            if v is not None and not (isinstance(v, str) and valid_date(v)):
                rep.fail("[%s] %s" % (ref, f), "must be YYYY-MM-DD or null")
        for f in URL_FIELDS:
            v = it.get(f)
            if v is not None:
                if not isinstance(v, str) or len(v) > 255:
                    rep.fail("[%s] %s" % (ref, f), "must be a string of 255 characters or less, or null")
                else:
                    rep.warn("[%s] %s" % (ref, f), "a URL is present. Confirm that the Product Owner supplied it.")
        body = it.get("body")
        if not isinstance(body, str):
            rep.fail("[%s] body" % ref, "body is missing")
        else:
            check_text_field(rep, ref, "body", body, args)
            check_body(rep, ref, body, args)
        notes = it.get("notes")
        if notes is not None and not isinstance(notes, str):
            rep.fail("[%s] notes" % ref, "notes must be a string")
        else:
            check_notes(rep, ref, notes, args)
            if isinstance(notes, str):
                check_text_field(rep, ref, "notes", notes, args)
        code = it.get("media_source_code")
        if code is None:
            rep.fail("[%s] media_source_code" % ref, "the image card is missing")
        elif not isinstance(code, str):
            rep.fail("[%s] media_source_code" % ref, "must be a string")
        else:
            check_media_code(rep, ref, code)
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--sentence-limit", type=int, default=10)
    ap.add_argument("--template-id", action="append", default=[])
    ap.add_argument("--allow-tell", action="append", default=[])
    ap.add_argument("--forbid", action="append", default=["interviewer"])
    ap.add_argument("--warn-chars", type=int, default=65000)
    ap.add_argument("--max-chars", type=int, default=0)
    args = ap.parse_args(argv)
    try:
        raw = open(args.file, "rb").read()
        text = raw.decode("utf-8")
    except (OSError, UnicodeDecodeError) as e:
        print("FAIL file: cannot read as UTF-8: %s" % e)
        return 2
    rep = validate(raw, text, args)
    for where, msg in rep.fails:
        print("FAIL %s: %s" % (where, msg))
    for where, msg in rep.warns:
        print("WARN %s: %s" % (where, msg))
    print("%d failed, %d warnings, %d characters" % (len(rep.fails), len(rep.warns), len(text)))
    return 1 if rep.fails else 0


if __name__ == "__main__":
    sys.exit(main())
