# Driving the admin itinerary in Claude in Chrome

Everything here was learned by doing it on the live console. Each item below is
a failure mode that produces a **silent wrong result** rather than an error,
which is why they are worth reading before you start clicking.

## Contents

- [Before you touch anything](#before-you-touch-anything)
- [Reading the current itinerary](#reading-the-current-itinerary)
- [Coordinates](#coordinates)
- [Opening and reading a dialog](#opening-and-reading-a-dialog)
- [Filling fields: click once, then use the keyboard](#filling-fields-click-once-then-use-the-keyboard)
- [Finding events on the calendar](#finding-events-on-the-calendar)
- [Selects (activity type, company)](#selects-activity-type-company)
- [Times](#times)
- [Creating an activity](#creating-an-activity)
- [Editing an activity](#editing-an-activity)
- [Verifying a write](#verifying-a-write)

## Before you touch anything

**The tab must be visible.** A backgrounded tab is the single worst failure
mode: `computer` clicks report success in the tool output while nothing reaches
the page, screenshots time out, and eventually the renderer freezes and even
`fetch` stops resolving. You can spend a long time "editing" a page that is not
listening.

Check first, and again if anything starts behaving oddly:

```js
JSON.stringify({vis: document.visibilityState, url: location.pathname})
```

If `vis` is not `"visible"`, stop and ask the person to bring the tab forward.
Do not try to work around it.

Also expect the person to be using the same browser. They may navigate away
mid-task or edit the same record. If a value you wrote changes later, assume a
human did it and ask before "fixing" it back.

## Reading the current itinerary

Read through the backend API, not by scraping the calendar. The calendar shows
only titles — no times, types, company links or descriptions — so a diff built
from it will miss real differences.

**Use the backend origin.** `fetch('/api/...')` against the admin host returns
**500 with an empty body**: production serves the Vite dev server, so its `/api`
proxy is live and points at a localhost that isn't there.

```js
const t = localStorage.getItem('authToken');
const base = 'https://benchmarktours-backend-production.up.railway.app/api';
const j = await (await fetch(base + '/tours/9/activities',
                 {headers: {Authorization: 'Bearer ' + t}})).json();
```

Render in JST and sort by start time — the API returns UTC:

```js
const T = s => new Date(s).toLocaleString('en-GB',
  {timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false});
```

Output gets truncated around a thousand characters, so print two or three days
per call rather than the whole week at once.

## Coordinates

`computer` clicks use the screenshot's coordinate frame, which is **not** CSS
pixels. This browser has been seen at a ~3400px-wide viewport, making raw
`getBoundingClientRect()` values off by more than 2x.

Take one screenshot to learn the frame (it is reported as
`coordinate frame: WIDTHxHEIGHT`), then compute positions from the DOM:

```js
const vw = document.documentElement.clientWidth;
const vh = document.documentElement.clientHeight;
const sx = FRAME_W / vw, sy = FRAME_H / vh;
const at = el => { const r = el.getBoundingClientRect();
  return [Math.round((r.left + r.width/2) * sx),
          Math.round((r.top + r.height/2) * sy)]; };
```

Recompute after anything that changes layout. Do not carry coordinates from one
dialog to the next: the form's height depends on the activity type (see below),
and the window may be resized between steps.

## Opening and reading a dialog

Clicking a calendar event opens an "Edit Activity" dialog; dragging on empty
calendar opens "Create New Activity". The dialog renders in a portal outside
`<main>`, so `get_page_text` will not show it — use `read_page` or JavaScript.

**Never screenshot or zoom while a dialog or dropdown is open.** The screenshot
mechanism injects a script that takes focus, and Radix closes the open dialog or
select in response. This silently discards a half-filled form. Verify open
dialogs by reading input values instead:

```js
const d = document.querySelector('[role="dialog"]');
JSON.stringify({
  heading: d.querySelector('h2')?.textContent,
  selects: [...d.querySelectorAll('[role="combobox"]')].map(e => e.textContent),
  fields: [...d.querySelectorAll('input,textarea')].map(e => ({
    label: e.previousElementSibling?.textContent || e.placeholder, value: e.value }))
});
```

A `[role="dialog"]` node can linger in the DOM after closing. Check
`d.dataset.state` — `"closed"` means it is gone, regardless of the node existing.

## Filling fields: click once, then use the keyboard

Click the *first* field you need, then `Tab` to the next and type. Avoid a
second coordinate click inside an open dialog: focusing a field can scroll the
dialog, which moves everything below it, so a click computed a moment earlier
lands outside the dialog and dismisses it — taking the whole half-filled form
with it. This is easy to miss because the click itself reports success.

Field order in the form is Title → Description → Start → End → Location Details
→ Website (Restaurant/Hotel only) → Survey URL, so tabbing between neighbours is
usually all you need.

**Enter submits.** Update and Create are `type="submit"`, so pressing Return
from any text field saves the form. This is more reliable than clicking the
button, which in a narrow window can sit below the fold and therefore outside
the screenshot's coordinate frame entirely.

A whole edit then becomes one batch — click the event, click the field, type,
Tab, type — followed by reading the values back and a single Return.

## Finding events on the calendar

`find` locates calendar events well, but **do not trust the date it reports**.
It infers the day from surrounding layout and has been seen to name the column
one day later than the event actually is. Open the event and read the dialog's
Start Time, which is authoritative, before typing anything into it — especially
when several nights share a hotel name and only the date distinguishes them.

## Selects (activity type, company)

These are Radix selects: a button trigger plus a hidden native `<select>`.
Setting the hidden select's value does not update React state, so click the
trigger and then the option.

The dropdown closes if anything steals focus, so **open it and pick the option
in one `browser_batch`**, without a screenshot in between. Get the option
coordinates from the open listbox:

```js
const lb = document.querySelector('[role="listbox"]');
[...lb.querySelectorAll('[role="option"]')].map(o => ({t: o.textContent, ...}))
```

The form changes height with the chosen type, which is why coordinates must be
re-read afterwards:

| Type | Extra fields shown |
|---|---|
| Company Visit | Company select |
| Discussion | Linked Activity select **plus a two-line help paragraph** |
| Restaurant / Hotel | Website field |
| Travel | none |

Set the type **first**, then re-read positions, then fill the rest.

## Times

`datetime-local` inputs are segmented (`DD. MM. YYYY., HH:MM` in this locale)
and reject a typed full string — the year comes out mangled, e.g. `0200`.

Two approaches that do work:

**Drag on the calendar** (best for creating). It snaps cleanly to 30-minute
slots and fills both times correctly. Get slot geometry from the DOM:

```js
document.querySelector('.fc-timegrid-col[data-date="2026-11-14"]')
document.querySelector('.fc-timegrid-slot[data-time="12:00:00"]')
```

A drag shorter than roughly 40px in the screenshot frame registers as a **click**
and opens a create dialog with *empty* times. One hour is only ~23px, so for a
one-hour activity drag two hours and correct one segment afterwards.

**Click the individual segment and type only that segment.** Clicking the hour
and typing `12` works; focus then auto-advances so typing `00` sets the minutes.
Segment x-positions are roughly evenly spaced across the field — compute from
the field's `left` and `width` and verify by reading `.value` after each step.

## Creating an activity

1. Drag on the target day for the intended span (drag long, correct after).
2. Set Activity Type.
3. Re-read coordinates.
4. Fill Title, Description, Company if applicable.
5. Read back every field value in JavaScript and confirm it matches intent.
6. Click Create.
7. Verify through the API.

## Editing an activity

Click the event, read the dialog, change only what needs changing, read back,
Update, verify. Leave times alone unless the times are what's wrong — the
existing schedule usually has deliberate spacing around transfers.

The dialog also has a **Delete** button next to Cancel/Update. Do not click it
unless the person explicitly asked for that activity to be deleted.

## Verifying a write

Re-read the API after every write, before moving to the next one. Two reasons:
a click may not have landed at all, and the itinerary is shared — verifying
immediately keeps the blast radius of a mistake to one activity.

Check that the activity's neighbours still abut correctly. A visit inserted
between two transfers should leave no gap and no overlap; that adjacency is the
quickest signal that a time is wrong.
