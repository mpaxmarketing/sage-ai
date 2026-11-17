# Content profile

The content profile is the Product Owner's own document for this skill. It is a child document of MPX X.3.6 Content Foundation in their Product History File, and it is registered in the Project Registry under X.3.6. A child document is named from its parent's product code and project number and then what it holds, with no category code. For a product coded XX, the profile reads as XX 0.3.6 Content Profile.

The profile is localized and the skill is global. Where the two disagree, the profile wins. The one exception is a template ID. A profile cannot change an ID from A to O.

## Finding it

1. Read the Project Registry for the product and find the Content Profile row under X.3.6. Read the document from Drive.
2. If there is no profile, say so. Ask for the envelope values and the brand slots below in one message, and offer to create the profile from the skeleton at the end of this file. Create it only through the Docs plugin, and only with the Product Owner's approval of the text.
3. Read the profile at the start of every run. Ask the Product Owner only for a value it does not hold.

## Sections

### Envelope

The batch values. They are the same for every run.

- account_id. An integer.
- property. The content property name, exactly as it reads in ProductSage.
- step. Usually Draft.
- project_number. A string such as 0.3.6, or none.
- generated_by name. The short name used in the generated_by line.
- file prefix. The prefix for the output file name. It defaults to the property name.

### Brand slots

Taken from the Product Owner's Brand Development document. Each is a value.

- background color
- accent color
- text color
- muted text color
- watermark color
- watermark text
- heading font and its weight
- body font
- font import URL, or a system font stack

### Style overrides

A change to a skill default, each with the reason. Examples: raise the sentence limit from under 10 to under 12 words. Change the reading level. Allow a word from the tells list. Add a word or a name that must never appear in a post, such as the interviewer's name.

### Templates

A template the Product Owner adds or changes. Write each in the shape used in templates.md, with an ID that does not reuse A to O. A profile template that replaces a standard one keeps the standard ID unchanged and cannot alter its fixed lines. Use a new ID to change them.

### Voice notes

Anything about the Product Owner's voice that the transcript does not carry. Words they always use. Words they never use. Topics to avoid. People and companies that may not be named.

## How the validator takes the profile

Pass the profile's choices to the script as options. A raised sentence limit is --sentence-limit. A profile template ID is --template-id. An allowed word is --allow-tell. A forbidden name is --forbid.

## Skeleton

Use this to create a profile. Replace every item in square brackets.

    Content Profile
    Product: [product name]. Parent: [X.3.6 Content Foundation]. Skill: Sage_AI Product Owner LinkedIn Content.

    Envelope
    account_id: [integer]
    property: [property name]
    step: Draft
    project_number: [X.Y.Z or none]
    generated_by name: [short name]
    file prefix: [prefix]

    Brand slots
    background: [hex]
    accent: [hex]
    text: [hex]
    muted text: [hex]
    watermark color: [hex]
    watermark text: [company name]
    heading font: [font, weight]
    body font: [font]
    font import: [URL or system font stack]

    Style overrides
    [none, or a rule and its reason]

    Templates
    [none, or a template in the shape of templates.md with its own ID]

    Voice notes
    [none, or notes]
