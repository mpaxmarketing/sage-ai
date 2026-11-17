# Import format

The batch lands as one JSON file that ProductSage imports. The format is owned by PS3 3.2.2 DEV Content Import JSON Schema, Version 1.0. This file carries it. Where the two disagree, the owner is right and this file is corrected by a new release of the skill. The skill makes no version check at run time. ProductSage refuses an unrecognized schema version and refuses the whole file.

## What ProductSage does

- One batch imports into one account, one content property, and one step. There is no override per item.
- The importer is create only. It never updates or deletes. A title that already exists on the property refuses the whole file, whatever the step.
- It validates the whole document before it writes anything. Fifteen items either arrive or none do. A refused file is corrected and resubmitted.
- It renders the body Markdown to HTML with raw HTML disabled. A tag in the body is escaped and shows up as text.
- LinkedIn renders no Markdown. An asterisk pasted into a post shows as an asterisk. So the body is plain text with blank lines between paragraphs.

## Envelope

Fixed for the batch. Take the values from the content profile and copy them exactly. Ask the Product Owner only for a value the profile does not hold.

| Field | Value |
| --- | --- |
| schema_version | "1.0" |
| account_id | integer, from the profile |
| property | the content property name, from the profile, exactly as it reads in the account |
| step | "Draft" unless the profile says another step |
| content_type | "Post" |
| project_number | string such as "1.3.6", or null, from the profile |
| item_count | the number of items. It must match. |
| generated_on | today, YYYY-MM-DD |
| generated_by | a short line naming the session. No dash of any kind. |
| items | the array of items |

The account_id is a confirmation check. ProductSage refuses the file on a mismatch, because a batch loaded into the wrong account cannot be undone by a delete.

## Items

Use only these fields. Do not add or rename one.

| Field | Rule |
| --- | --- |
| item_ref | Required. A short key unique in the file: a1, a2, a3. |
| title | Required. The subject of the post. 255 characters or less. Unique in the file and on the property. |
| body | The post, as plain text. See below. |
| notes | Working notes. Not part of the content. See below. |
| media_source_code | The HTML image card. See image-card-spec.md. |
| media_source_url, media_url, posted_url | null. Never invent a URL. |
| schedule_date, posted_date | null unless the Product Owner gave a date. YYYY-MM-DD. |

## Title

The title is the subject of the post. It is not the opening line. It is what a person scanning a list of fifteen items reads to tell them apart. Write a short descriptive phrase that is specific to this post, so it cannot repeat a title already on the property. Prefer a title with the concrete subject in it over a template's generic topic line. Avoid the dashes and the symbols the style guide forbids.

## Body

- Hook 1 opens the body. The rest of the post follows the template.
- Blank line between paragraphs. A new line inside a paragraph is allowed for a template's grouped lines, such as a lesson and its reason.
- A list line starts with a character from the library, then a space.
- No HTML. No asterisk or underscore emphasis. No heading. No table, image, code fence, or link markup. Write a bare URL if one is needed.
- No em dash, no en dash, no emoji.

## Notes

The notes field holds what travels with the post and is not the post. Write it in this order, as one paragraph, with these exact labels:

Template: CF_LI_Post_X. Hook 2: the second hook. Hook 3: the third hook. Image headline: the headline. Image subtext: the subtext. Share text: the share text.

For a list post, write Image points: point one; point two; point three. in place of Image subtext. The template ID is exactly as in templates.md, or an ID from the content profile. The validator checks every label.

## Writing the file

Write the file with a script that builds the data and calls json.dump with ensure_ascii set to False. Do not type JSON by hand. A newline inside a string is escaped as \n, a double quote is escaped as \", and a hand typed file gets this wrong. Encode the file as UTF-8 with no byte order mark. Name it property_Import_YYYYMMDD.json, using the property name from the profile.

## Size

Keep the file under about 65,000 characters. That is the size of the manual imports that worked. The cards take most of the space, so keep each card compact. The importer's real limit is not known yet. Imports run through phpMyAdmin today and no PS3 form exists. The validator warns over 65,000 characters and does not fail on size.

## Envelope example

    {
      "schema_version": "1.0",
      "account_id": 40,
      "property": "CF_LI_Foundation",
      "step": "Draft",
      "content_type": "Post",
      "project_number": null,
      "item_count": 15,
      "generated_on": "2026-08-26",
      "generated_by": "Content session",
      "items": [ ]
    }
