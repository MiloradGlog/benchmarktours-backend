---
name: tour-itinerary
description: Build, update, correct, or audit a tour itinerary in the Benchmark Tours / Japan Lean Experience admin console (benchmarktours-admin-web) by driving it with Claude in Chrome, working from whatever source material exists — a proposal PowerPoint, an Excel itinerary, emailed text, or screenshots. Use this whenever the user wants tour activities created, moved, retimed, renamed or checked, or asks whether a tour "matches" a deck, spreadsheet or email — including phrasings like "check the ASENTA tour against this xlsx", "add the Mazda visit", "the itinerary changed, update it", "fix day 3", "load this proposal into the system", or when they simply drop a tour file and name a tour. It covers reading .pptx/.xlsx without any Office libraries installed, diffing against live data, and applying edits safely to production.
---

# Tour itinerary editing

The itinerary is **live production data for a real tour that real people will
travel on**. A wrong company on the wrong day sends a group to the wrong city.
So the shape of this work is: read everything, show the person a diff, get
agreement, then apply one change at a time and verify each one.

Two references hold the detail. Read them when you reach the relevant phase:

- `references/admin-ui.md` — how to drive the console without silently losing
  edits. Read before your first write, every time. It is all failure modes that
  look like success.
- `references/tour-data-model.md` — what an activity is and how Makoto's tours
  are conventionally filled in. Read when composing new activities.

This skill lives in the backend repo because that is where the API and the data
model it verifies against are, but the work spans all three: it reads source
files locally, drives `benchmarktours-admin-web`, and the result is what
participants see in `benchmarktours-mobile-app`.

## Scope

Stay on the itinerary. Navigate **tours list → the tour → its itinerary** and
remain there. Don't wander into Companies, Users or Surveys; if something there
needs changing, report it instead.

Creating a company is the common case of this — a `CompanyVisit` needs a
Companies record, and making one means leaving the itinerary. Draft the values
and hand them to the person to enter rather than navigating there yourself,
unless they widen the boundary.

## Phase 1 — Read the source material

Run the bundled parsers. This machine has no `python-pptx`, `openpyxl` or
`markitdown`, and both formats are zipped XML, so these use only the standard
library:

```bash
python3 scripts/read_pptx.py "deck.pptx" --audit
python3 scripts/read_xlsx.py "itinerary.xlsx"
```

Screenshots and pasted text need no tooling — read them directly.

Three things reliably go wrong here:

**A spreadsheet often contains several versions of the same tour.** Extra sheets
named `… (2)`, `… (3)` are usually competing drafts with different sites, hotels
and cities — not extra days. Picking the wrong one rewrites the tour incorrectly
while looking entirely plausible. Never assume the first or last sheet is
current. Identify the right one by cross-checking a few anchors against live
data (hotels are the best tell, then the set of companies), then **confirm with
the person before using it**, saying which anchors led you there.

**A proposal deck usually has no day-by-day schedule.** It lists dates and sites
and is silent on which site falls on which day. `--audit` reports pictures and
SmartArt whose contents can't be read as text — if the schedule seems missing,
check whether it's sitting in an image, and ask for it in another form rather
than inferring. Inferring a schedule from geography is invention, not
extraction; offer it as a proposal only, clearly labelled.

**Excel encodes times by vertical position, not as values.** `read_xlsx.py`
maps rows to clock times (row 3 = 07:00, each row 30 minutes by default; adjust
with `--anchor`) and expands merged cells so a block's row span becomes its
duration. Treat the result as approximate: blocks are drawn as stacked
continuation lines, so a visit shown as "13:30–15:00" may legitimately be
13:00–16:00 live. The reliable signals are **sequence and rough time of day**,
not exact minutes. The last rows of a sheet are the hotel row and a colour
legend — their computed times are meaningless.

## Phase 2 — Read the live itinerary

Confirm the tab is visible, then read the current state **through the backend
API rather than by scraping the calendar** — the calendar shows titles only, so
a diff built from it silently misses wrong times, types and company links. The
exact recipe, including why the admin origin's `/api` returns a 500, is in
`references/admin-ui.md`.

## Phase 3 — Diff and agree

Lay the two side by side and present a table: what matches, what differs, what
is missing, what exists live but isn't in the source. Include your reasoning
where a difference is ambiguous.

Distinguish clearly between:

- **Errors** — a different company, a missing visit, a day out of order.
- **Judgement calls** — a 30-minute time difference, a theme folded into a
  description instead of its own entry. These are usually deliberate; say so and
  leave them alone unless asked.

Corroborate before calling something an error. Geography is a good check: a site
600km away cannot follow a morning visit and still reach the evening's hotel. An
empty slot bracketed by "Transfer to the Site" and "Transfer back" is strong
evidence a visit was meant to be there.

**Get explicit agreement before writing.** Say exactly what you will change,
create and delete. "Correct what's wrong" authorises the corrections you have
listed and agreed, not unlisted ones you discover mid-flight — if the work grows,
come back and ask.

## Phase 4 — Apply

Read `references/admin-ui.md` first if you haven't.

One activity at a time, and after each: re-read that activity through the API
and confirm it landed. Batching writes and verifying at the end means a failure
halfway through leaves the itinerary in a state neither you nor the person can
describe.

Sequence edits so the itinerary is never left worse than you found it. Shortening
an existing block before creating its replacements opens a hole in the day; if
you are interrupted there, the tour is actively broken. Prefer creating first, or
finish the group in one go — and if you do get interrupted, say plainly and
prominently which day is currently inconsistent.

Never delete an activity unless the person asked for that specific deletion.

## Phase 5 — Verify and report

Re-read the whole tour and check it day by day, not just the activities you
touched. Confirm:

- every source item is present, and nothing unexpected exists live
- visits sit on the right days, with transfers abutting and no overlaps
- one hotel per night, no breakfast on arrival day, a meal where meals belong
- all times read sensibly in JST

Report as a per-day table with a verdict per day, then a short list of anything
left open — stand-in company links, conventions you chose to preserve, anything
you couldn't verify. If you couldn't re-read live data, say the report is based
on your last confirmed read rather than presenting it as current.

## When something blocks you

Several failures in this environment look like success: a backgrounded tab
accepts clicks that never land, and a screenshot taken while a dialog is open
closes it. If two attempts at the same interaction don't produce the expected
change, stop and diagnose rather than repeating — check tab visibility first.

Report blockers plainly, including what state the itinerary is in right now.
A half-finished day the person doesn't know about is far worse than an
unfinished task they do.
