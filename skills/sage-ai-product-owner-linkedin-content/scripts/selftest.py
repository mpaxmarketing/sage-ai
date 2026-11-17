#!/usr/bin/env python3
"""Self test for validate_import.py. Run it after any change to the validator.

  python3 -I selftest.py

It builds one clean import file in memory, confirms the validator passes it, then breaks it one
way at a time and confirms the validator fails each break. Exit status 0 means every case behaved.
"""
import argparse
import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_import as v  # noqa: E402

CARD = (
    "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<style>\n"
    "html, body { width:1080px; height:1350px; overflow:hidden; background:#112233; }\n"
    "</style>\n</head>\n<body><div>Card</div></body>\n</html>"
)


def notes(tid="CF_LI_Post_K"):
    return ("Template: %s. Hook 2: The first hire changed my day. Hook 3: Nobody warns you about this part. "
            "Image headline: The hard part was not the work. Image subtext: It was what lived in my head. "
            "Share text: I ran this alone for years. Then I hired one person." % tid)


def clean_item(n):
    return {
        "item_ref": "a%d" % n,
        "title": "Hiring the first employee and what changed %d" % n,
        "body": "I ran this alone for years.\n\nThen I hired one person.\n\nWhat I learned:\n\n→ Write things down early\n→ Ask for a second view",
        "notes": notes(),
        "schedule_date": None,
        "media_source_url": None,
        "media_url": None,
        "media_source_code": CARD,
    }


def clean_doc():
    items = [clean_item(1), clean_item(2)]
    return {
        "schema_version": "1.0", "account_id": 6, "property": "TEST_PROP", "step": "Draft",
        "content_type": "Post", "project_number": "1.2.3", "item_count": 2,
        "generated_on": "2026-11-17", "generated_by": "Selftest", "items": items,
    }


def run(doc_or_text, extra=None):
    text = doc_or_text if isinstance(doc_or_text, str) else json.dumps(doc_or_text, ensure_ascii=False, indent=2)
    ns = argparse.Namespace(sentence_limit=10, template_id=[], allow_tell=[], forbid=["interviewer"],
                            warn_chars=65000, max_chars=0)
    for k, val in (extra or {}).items():
        setattr(ns, k, val)
    rep = v.validate(text.encode("utf-8"), text, ns)
    return rep


def set_body(d, s, i=0):
    d["items"][i]["body"] = s
    return d


CASES = []


def case(name, expect):
    def deco(fn):
        CASES.append((name, expect, fn))
        return fn
    return deco


@case("em dash in body", "em dash")
def _(d): return set_body(d, "I ran it alone " + chr(0x2014) + " for years.")
@case("en dash in title", "en dash")
def _(d): d["items"][0]["title"] = "Hiring " + chr(0x2013) + " the first employee"; return d
@case("em dash in generated_by", "em dash")
def _(d): d["generated_by"] = "Sage_AI " + chr(0x2014) + " session"; return d
@case("em dash in notes", "em dash")
def _(d): d["items"][1]["notes"] += " Extra " + chr(0x2014) + " text."; return d
@case("sentence of ten words", "sentence of 10 words")
def _(d): return set_body(d, "One two three four five six seven eight nine ten.")
@case("long sentence in a list line", "sentence of")
def _(d): return set_body(d, "→ This list line has far too many words in it to be allowed here")
@case("duplicate title", "title repeats")
def _(d): d["items"][1]["title"] = d["items"][0]["title"]; return d
@case("duplicate title, different case", "title repeats")
def _(d): d["items"][1]["title"] = d["items"][0]["title"].upper(); return d
@case("duplicate item_ref", "item_ref repeats")
def _(d): d["items"][1]["item_ref"] = "a1"; return d
@case("item_count mismatch", "item_count is")
def _(d): d["item_count"] = 15; return d
@case("unknown item field", "unknown field")
def _(d): d["items"][0]["hooks"] = "x"; return d
@case("unknown envelope field", "unknown field")
def _(d): d["author"] = "x"; return d
@case("title over 255 characters", "title is 256")
def _(d): d["items"][0]["title"] = "T" * 256; return d
@case("emoji in body", "not in the character library")
def _(d): return set_body(d, "I ran it alone \U0001F600")
@case("bullet dot not in library", "not in the character library")
def _(d): return set_body(d, "• A list line")
@case("emoticon", "emoticon")
def _(d): return set_body(d, "That went well :)")
@case("HTML in body", "contains HTML")
def _(d): return set_body(d, "I ran it <b>alone</b>.")
@case("asterisk emphasis", "asterisk")
def _(d): return set_body(d, "I ran it *alone*.")
@case("heading in body", "heading")
def _(d): return set_body(d, "# A heading\n\nText.")
@case("hyphen list", "hyphen")
def _(d): return set_body(d, "Items:\n\n- one\n- two")
@case("engagement call to action", "call to action")
def _(d): return set_body(d, "I ran it alone. Let me know in the comments.")
@case("template variable left in", "template variable")
def _(d): return set_body(d, "I ran %topic% alone.")
@case("template note left in", "double parentheses")
def _(d): return set_body(d, "I ran it alone. ((note))")
@case("interviewer named", "forbidden")
def _(d): return set_body(d, "The interviewer asked me about it.")
@case("tell: stock word", "writing tell")
def _(d): return set_body(d, "This was a pivotal week for us.")
@case("tell: not X but Y", "writing tell")
def _(d): return set_body(d, "It is not just a hire, but a change.")
@case("tell: staged opener", "writing tell")
def _(d): return set_body(d, "Let's dive in.")
@case("tell: trailing -ing rider", "writing tell")
def _(d): return set_body(d, "We hired fast, highlighting our need.")
@case("notes name no template", "no 'Template: ID'")
def _(d): d["items"][0]["notes"] = notes().replace("Template: CF_LI_Post_K. ", ""); return d
@case("notes name an unknown template", "not in the library")
def _(d): d["items"][0]["notes"] = notes("CF_LI_Post_Z"); return d
@case("notes missing hook 3", "missing Hook 3")
def _(d): d["items"][0]["notes"] = notes().replace("Hook 3:", "Hook three:"); return d
@case("notes missing share text", "missing Share text")
def _(d): d["items"][0]["notes"] = notes().replace("Share text:", "Share:"); return d
@case("notes missing image text", "missing Image headline")
def _(d): d["items"][0]["notes"] = notes().replace("Image headline:", "Headline:"); return d
@case("card missing", "image card is missing")
def _(d): d["items"][0]["media_source_code"] = None; return d
@case("card not locked to size", "1080px")
def _(d): d["items"][0]["media_source_code"] = CARD.replace("1350px", "900px"); return d
@case("card has em dash", "dash")
def _(d): d["items"][0]["media_source_code"] = CARD.replace("Card", "Card " + chr(0x2014) + " x"); return d
@case("card has script", "script tag")
def _(d): d["items"][0]["media_source_code"] = CARD.replace("<body>", "<body><script>1</script>"); return d
@case("bad schedule date", "YYYY-MM-DD")
def _(d): d["items"][0]["schedule_date"] = "11/17/2026"; return d
@case("bad schema version", "schema_version")
def _(d): d["schema_version"] = "2.0"; return d
@case("bad content type", "content_type")
def _(d): d["content_type"] = "Tweet"; return d
@case("account_id as string", "account_id")
def _(d): d["account_id"] = "6"; return d
@case("url over 255 characters", "255 characters")
def _(d): d["items"][0]["media_url"] = "https://x.example/" + "a" * 260; return d


def main():
    bad = 0

    def check(label, ok, detail=""):
        nonlocal bad
        print(("ok    " if ok else "WRONG ") + label + (("  " + detail) if detail else ""))
        if not ok:
            bad += 1

    rep = run(clean_doc())
    check("clean file passes", not rep.fails, "; ".join(m for _, m in rep.fails[:3]))

    for name, expect, fn in CASES:
        d = fn(copy.deepcopy(clean_doc()))
        rep = run(d)
        hit = any(expect.lower() in m.lower() for _, m in rep.fails)
        check("fails: " + name, hit, "" if hit else "no failure containing %r; got %s" % (expect, [m for _, m in rep.fails][:2]))

    text = json.dumps(clean_doc(), indent=2)[:-3]
    rep = run(text)
    check("fails: truncated JSON", any("not valid JSON" in m for _, m in rep.fails))
    text = json.dumps(clean_doc(), indent=2).replace('"Hiring the first', '"Hiring\nthe first', 1)
    rep = run(text)
    check("fails: literal line break in a string", any("not valid JSON" in m for _, m in rep.fails))
    text = json.dumps(clean_doc(), indent=2).rstrip("}") + ",}"
    rep = run(text)
    check("fails: trailing comma", any("not valid JSON" in m for _, m in rep.fails))
    rep = v.validate(b"\xef\xbb\xbf" + json.dumps(clean_doc()).encode(), json.dumps(clean_doc()), argparse.Namespace(
        sentence_limit=10, template_id=[], allow_tell=[], forbid=["interviewer"], warn_chars=65000, max_chars=0))
    check("fails: byte order mark", any("byte order mark" in m for _, m in rep.fails))

    # Options that must loosen a check.
    d = set_body(clean_doc(), "One two three four five six seven eight nine ten.")
    check("sentence limit can be raised", not run(d, {"sentence_limit": 12}).fails)
    d = set_body(clean_doc(), "This was a pivotal week for us.")
    check("a tell can be allowed", not run(d, {"allow_tell": ["pivotal"]}).fails)
    d = clean_doc()
    d["items"][0]["notes"] = notes("XY_LI_Post_Q")
    check("a profile template ID is accepted", not run(d, {"template_id": ["XY_LI_Post_Q"]}).fails)
    d = set_body(clean_doc(), "Here is what happened. In my humble opinion, you will get better results this way.")
    check("a fixed template line is exempt from sentence length", not run(d).fails)
    d = set_body(clean_doc(), "The future of freelance work is arriving faster than we think.")
    check("the template D closer is exempt", not run(d).fails)
    d = set_body(clean_doc(), "One of the great things about having experience with invoices is you learn to ask early.")
    check("the template F closer is exempt", not run(d).fails)
    d = set_body(clean_doc(), "The future of freelance work is arriving faster than we think, and it is loud.")
    check("a longer line is not exempt", any("sentence of" in m for _, m in run(d).fails))
    d = set_body(clean_doc(), "I ran it alone for years.\n\nWhat did I learn?")
    rep = run(d)
    check("a closing question warns and does not fail", not rep.fails and any("ends with a question" in m for _, m in rep.warns))

    print("\n%s" % ("All cases behaved." if not bad else "%d case(s) did not behave." % bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
