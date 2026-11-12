---
name: sage-ai-doc-edits
description: Use when a mission changes a Google Doc and the edits can be applied with the Sage_AI Edits script. Covers when to offer the script, writing the JSON correction file from a live read, the version check, reading the Copy result report, writing a retry file, and the pairs fallback for a Pending Updates tab.
license: MIT
---

# Sage_AI Doc Edits

This skill holds how Sage_AI offers, writes, and follows up a correction file for the Sage_AI Edits script. The script is bound to a Google Doc and applies a JSON file of edits. It describes script version 2. The specification is MPX 1.2.2 Sage_AI Doc Edits, and it owns the schema and the script behavior. Read it when this skill is not enough.

The Project Instructions section Updates holds the rule. This skill carries it in its own words. A change to the rule is made in the Project Instructions first.

## When to Offer the Script

- Offer the script for each document the mission changes. The Product Owner can decline and take pairs instead.
- The script earns its place on surgical edits. These are a delete, a short swap, or a line or two inserted into a list.
- Offer a paste for a whole log entry, a whole section, or a whole tab. The boundary is size and shape, not count. This is provisional until the next several runs report.
- Corrections written for this script are the only corrections written as JSON. Corrections for a Pending Updates tab stay in the Markdown form of the Project Instructions.

## Steps

1. Approve in chat. List the changes and wait for the Product Owner to approve them. That approval is the only one. There is no Preview and no step that names a version before the run.

2. Check the script version. Version 2 shows the line Sage_AI Edits version 2 in the dialog. A Doc whose dialog has no version line carries version 1 or older. For that Doc, deliver pairs and tell the Product Owner the Doc needs the current template. The Marketing Plan once carried an older script and the only way anyone found out was by running it.

3. Write the file from a live read of the document. Never quote from memory or from an earlier turn. Write one JSON array per document, one file per document, with ids that rise in the order of the array. The script applies the items in array order. Put a delete before an insert whose text repeats the delete anchors.

4. Deliver the file. Close the reply with this line. Open the Sage_AI Edits menu in the document name at its full address. Choose Apply edits, paste the file, and click Apply.

5. Read the result. The Product Owner reads the overall message in the dialog. A clean message needs nothing more. On a failure the Product Owner clicks Copy result and pastes the report to Sage_AI.

6. Report and stop. Read the failed rows. For a row that ended in APPLIED, VERIFY FAILED, read the document first, because the document changed. Read the live document again. Tell the Product Owner what the document holds and what each failed item asked for, offer help diagnosing it, and stop. The next step is the Product Owner's. Most misses are fixed by finding the right text and saying so. Errors are rare, so nothing retries on its own. Write a retry file only if the Product Owner asks for one. A retry file holds only the failed items, with their original ids and a different anchor or action. It leaves applied items out, because a rerun of the whole original file is the poor path.

7. Where the Product Owner takes pairs instead, deliver the failed items as pairs for the Pending Updates tab.

## The Correction File

A correction file is one JSON array. Each item is one object and one edit. Each item stands alone, so no item relies on an earlier item having landed. Where two edits touch the same passage, merge them into one item.

Every item carries six fields. They are id, document, source_section, action, scope, and style_hints. The script requires id, action, and the fields its action needs. It ignores the rest. The id is unique in the file.

The action is one of four.

- delete needs find. It removes the paragraph or paragraphs in find, with their bullets. A find of several paragraphs holds one paragraph per line, in order.
- delete_block needs starts_with and ends_with. It removes everything from the start of the first through the end of the second.
- replace needs find and replace_with. Two shapes work. In the first, replace_with is the find text with new lines added at the start or the end. In the second, find and replace_with have the same number of lines, and the script changes the paragraphs that differ. Any other shape fails the item. Split it into a delete and an insert.
- insert_after_block needs starts_with, ends_with, and insert_text. It inserts the new lines after the block as new paragraphs.

A move is a delete and an insert.

### Matching

Matching is exact on text. The script ignores bullet markers, curly quotes, odd spaces, and repeated spaces. Each anchor must match exactly once across all tabs. A starts_with matches the beginning of a paragraph and an ends_with matches the end of one. A short ending can match a second paragraph, such as a Changelog line, so write anchors long enough to be unique.

A block must sit in one tab with no table between its first and last paragraph. A block has no length limit. Write a long change as a set of real edits, section by section.

### Insert text and style_from

A line in insert_text that starts with a dash and a space is written that way for the reader. The script removes the prefix. A new paragraph becomes a list item only if the paragraph whose style it copies is one, so a bullet needs a style_from rule when the anchor is not a list item.

style_from is an optional list of rules on any item that inserts. Each rule holds line_starts_with and one of two style sources. The script takes the first rule whose line_starts_with matches the start of the line.

- template_starts_with copies the style of the first paragraph that starts with that text, at or after the anchor.
- named_style copies the first plain body paragraph and sets a named style on the copy. Use it where a new heading has no heading nearby to copy. The names are Normal, Title, Subtitle, and Heading 1 through Heading 6.

A line that matches no rule copies the style of the first paragraph of the block.

## What the Script Does Not Do

- It edits paragraphs and list items in the body of each tab. It does not edit tables, headers, or footers. The header fields, the Versions and Approvals table, and any table row are edited by hand or delivered as pairs.
- It does not roll back. Google Docs version history is the way back.
- It is not tested against pending suggestions, comments, or tracked changes.
- It does not run for Sage_AI. The Product Owner runs it in their own Google account, and Sage_AI holds no credentials. A check of a run belongs to the Product Owner.

## Results

Each item ends in one of four results.

- APPLIED, VERIFIED. The edit was made and the check passed.
- ALREADY_APPLIED. The edit is already in the document. A file whose items are all already applied reads as nothing to do and not as an error.
- FAILED. Nothing was changed for the item. A code, notes, and a hint say why.
- APPLIED, VERIFY FAILED. The edit was made and the check did not pass. The document changed.

A failed item is skipped and the rest of the file is applied. A failed step in a planned sequence makes the later steps fail on their own, and each shows as its own failure.

### Failure codes

- NOT_FOUND. An anchor is not in any tab. Read the document again and quote the anchor from it.
- AMBIGUOUS. An anchor matches more than once. Lengthen the anchor until it matches once.
- MALFORMED. An unknown action or a missing field.
- UNSUPPORTED_SHAPE. A replace fits neither shape. Split it into a delete and an insert.
- CROSSES_TABLE. A block crosses a table or another tab. Split the block or use pairs.
- BAD_ORDER. ends_with sits before starts_with.
- TEMPLATE_NOT_FOUND. A style_from rule names a paragraph that is not in the document.
- EXEC_ERROR. Apps Script raised an error. The notes hold the message.

The hint is a lead and not a rule.

### The Copy result report

The report is one JSON object with the fields script, version, document, ran_at, summary, and results. The results hold one object for each item with id, action, result, code where it failed, notes, and hint. Read the failed rows and report them.

## The Pairs Fallback

Use pairs when the Product Owner declines the script, the Doc has no script or an older one, or a block crosses a table. Pairs are numbered corrections in Markdown, one file per document, for the Pending Updates tab. The Project Instructions section Updates defines the form. A pairs file carries the corrections and nothing else. Every explanation goes in the reply.

The reply closes with this line. Open the Pending Updates tab of the document name at its full address. Paste the file in with Paste from Markdown, apply each correction with Find, then clear the tab.

## Keeping This Skill Current

The skill depends on the script. The Sage_AI Doc2 tactic Keep the Sage_AI Doc Edits skill in step with the script keeps them together. When the script version changes, this skill changes in the same pass, and the manifest entry moves with it.
