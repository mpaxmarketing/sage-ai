# Log Entry Skeleton

Skeleton: Log Entry Skeleton
Skeleton version: 1
Skeleton date: 11/25/2026

A Skeleton is a starting file with the structure and the rules in place and blanks for the mission's content. Sage_AI reads this file from the clone of the sage-ai repository, copies it, fills it in for the mission, and writes the result as one JSON log entry in the log folder. It does not write to this file.

How to fill it. Replace every bracketed variable. Add a line to activities_executed for each activity, and an object to sessions for each session. Add a line to each list for each item, and leave a list with one line reading None where there is nothing to say. Leave out claude_md_snapshot, commit_reference, verified_by_hand, defects_found, decisions, and rules_added in a marketing entry.

Write the file from the JSON block below. Leave these notes and the rules out of it.

# Log Entry

```json
{
  "created_at": "[created_at]",
  "updated_at": "[updated_at]",
  "mission_name": "[mission_name]",
  "sprint_token": "[sprint_token]",
  "plan_advanced": "[plan_advanced]",
  "activities_executed": [
    "[activity]",
    "[activity]"
  ],
  "how_this_advances_the_plan": "[how_this_advances_the_plan]",
  "sessions": [
    {
      "start_time": "[start_time]",
      "end_time": "[end_time]"
    }
  ],
  "duration": "[duration]",
  "claude_md_snapshot": "[claude_md_snapshot]",
  "commit_reference": "[commit_reference]",
  "verified_by_hand": [
    "[verified_by_hand]",
    "[verified_by_hand]"
  ],
  "defects_found": [
    "[defects_found]",
    "[defects_found]"
  ],
  "decisions": [
    "[decision]",
    "[decision]"
  ],
  "rules_added": [
    "[rule_added]",
    "[rule_added]"
  ]
}
```

# Rules

- The marketing log entry goes in the Planning phase folder in X.1.3 Logs. The development log entry goes in the Development phase folder in X.2.3 Logs. X is the product number.
- Each entry is one JSON file. Name it with the date and the mission name.
- Each activity in activities_executed is a short sentence.
- created_at, updated_at, start_time, and end_time are ISO 8601 with the UTC offset, for example 2026-11-25T08:10:00-07:00.
- Duration is the sum of the sessions in whole minutes, written as a number, so a mission that resumes the next day needs no pause tracking.
- When the duration is filled in, remove the quotes around it.
- created_at is set once. updated_at changes whenever the entry changes.
- The sprint token is the token in the Sprint heading of the plan, for example TmplPass.
- A development entry carries six extra fields after duration, claude_md_snapshot, commit_reference, verified_by_hand, defects_found, decisions, and rules_added. A marketing entry does not.
- verified_by_hand says what the Product Owner or a session checked against the live thing, what was not read back, and every read that stopped early with the characters read and the total.
- defects_found names each fault in the product, a document, a brief, or an instruction, with what it cost and the cause where it is known.
- decisions gives each decision with its reason on the same line, what was left alone on purpose, and what the Product Owner chose.
- rules_added gives each rule, where it went, and the failure that produced it. A lesson that failed the four checks is named here as a Sprint Note or a Watch List line.
- The Skeleton is global. The entry built from it is localized.
