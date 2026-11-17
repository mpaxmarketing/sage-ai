---
name: sage-ai-product-owner-linkedin-content
description: Use when a Product Owner wants LinkedIn feed posts made from a conversation about their product. Turns a transcript, a captured live interview, or a Sage_AI interview into fifteen posts, each with three hooks, image text, share text, and an HTML image card, delivered as one validated ProductSage import file.
license: MIT
---

# Sage_AI Product Owner LinkedIn Content

Skill version 1, 2026-11-17.

This skill turns a conversation about the product into a batch of fifteen LinkedIn posts for the Product Owner's own feed. Each post has three hooks, image text, share text, and an image card. The batch lands as one import file that ProductSage accepts the first time. The skill serves Growth Factor X.3.6 Content Foundation, for the content property that publishes text posts with an image to the Product Owner's feed.

The skill holds no value that belongs to one Product Owner. Account, property, brand, and style overrides come from the Product Owner's content profile. The voice comes from the transcript.

The specification is the feature Sage_AI Product Owner LinkedIn Content in MPX 1.2.2 DEV Technical Specification. The import format is owned by PS3 3.2.2 DEV Content Import JSON Schema. The process the Product Owner follows is in MPX 1.3.6 PE Content Foundation. Read them when this skill is not enough.

## What is in this skill

- references/style-guide.md holds the style rules and the character library.
- references/templates.md holds templates A to O in full.
- references/import-format.md holds the envelope, the item fields, the notes format, and how to write the file.
- references/image-card-spec.md holds the card rules, a skeleton, and the steps to render a PNG.
- references/interview-protocol.md holds the interview questions.
- references/writing-tells.md holds the machine writing tells to avoid.
- references/content-profile.md holds what the profile contains and how to find it.
- scripts/validate_import.py checks the finished file. scripts/selftest.py tests the validator.

Read style-guide.md, templates.md, import-format.md, and image-card-spec.md before writing. Read the others when a step calls for them.

## Steps

### 1. Read the content profile

Find the Product Owner's content profile and read it. See references/content-profile.md for where it lives, what it holds, and what to do when there is none. Ask only for a value the profile does not hold. Where the profile and this skill disagree, the profile wins, except that a template ID cannot change.

### 2. Check the skill version

The manifest.json in the Sage_AI clone lists this skill with a version. If the manifest version is higher than the version at the top of this file, say so before the run. Tell the Product Owner that a newer ZIP is in the repository and that they can reinstall it under Customize, then Skills. Then continue with the installed version unless they stop.

### 3. Take the transcript

There are three ways in, and all three end as a transcript.

- A transcript pasted or uploaded. Use it.
- A live interview captured in Listening Mode. When the Product Owner says it is over, treat the notes as the transcript.
- No transcript. Offer to interview the Product Owner in Interview Mode, with the questions in references/interview-protocol.md.

Read the whole transcript before anything else. Learn the Product Owner's words, jargon, phrasing, humor, and habits. When a person other than the Product Owner speaks, they are either presenting a question or prompt, or adding nuance. Treat the nuance as the Product Owner's input. That person has no voice or presence in a post, and their name never appears in one.

### 4. Find fifteen topics

Run this loop for each topic until there are fifteen.

1. Capture the gist of one moment in the transcript. A new topic usually starts with a new question or prompt. One answer can supply more than one topic, cast from different angles.
2. Read the whole template set and choose the best match. Choose the template that lets the post be interesting, informative, and engaging. Use a spread of templates across the batch, and do not force a poor fit to get one.
3. Write the topic the way the template frames it.
4. Add it to the list.

The batch is the default. Do not stop to ask which topics to write. Process all fifteen. Show the numbered topic list first only if the Product Owner asks for it. If the transcript supports fewer than fifteen good topics, say how many it supports and ask whether to deliver fewer, and never pad the batch.

### 5. Write each post

Use the chosen template in spirit. Keep its fixed lines as written. Follow references/style-guide.md. Each post has:

- A title that is specific to this post, as in import-format.md.
- Hook 1 as the opening of the body, and hooks 2 and 3 as alternates for the notes.
- The body, as plain text, with the Product Owner's voice.
- Image text, as a headline with subtext or with points.
- Share text of one or two sentences.
- The template ID, unchanged.

Mix short and long posts. Tell the full story where the story is good. Keep every sentence under 10 words.

### 6. Build each image card

Build one HTML card per post, as in references/image-card-spec.md. Use the brand slots from the profile. Give each card its own layout concept. If a brand slot is missing, ask before building.

### 7. Assemble the file

Write the posts into one import file as in references/import-format.md. Build the data in a script and write it with json.dump, never by hand. Name the file from the profile's file prefix and today's date.

### 8. Validate

Run the validator on the file.

    python3 scripts/validate_import.py FILE

Pass the profile's choices as options. They are --sentence-limit, --template-id, --allow-tell, and --forbid.

Read the report. Every FAIL line is a rule the file breaks. Fix the posts in the source, rebuild the file, and run the validator again. Repeat until it reports no failure. A sentence of 10 words or more is a failure, so the validator lists every one, and the list must be empty. A WARN line is read and judged, and it does not block delivery. Do not edit the JSON by hand to clear a failure. Do not skip the validator.

Then review the structural tells by eye, as listed in references/writing-tells.md. Fix any you find, rebuild, and validate again.

### 9. Deliver

Deliver the import file as a downloadable file. In the reply, give the Product Owner:

- The file name and the number of posts.
- The validator result, in one line.
- The template spread, as a count per ID.
- Any WARN that is still open, and any topic that was cut or reshaped.
- The next steps that are theirs. Import the file into ProductSage by the route in use. Render the cards they want to use as PNGs, as in references/image-card-spec.md.

Do not paste the file or the posts into the reply. The Product Owner judges the voice, so offer to revise any post. When they ask for a change, change the source, rebuild, and validate again.

## Rules that hold in every step

- No dash of any kind: no em dash and no en dash, in any field.
- No engagement question and no call to action.
- No emoji and no emoticon. Symbols come only from the character library.
- No HTML, asterisk, or heading in a body.
- No value belonging to another Product Owner. No invented URL.
- Never alter a template ID.
- Never edit a Google Doc or Sheet except through the Docs and Sheets plugins, and only after the Product Owner approves the change.
