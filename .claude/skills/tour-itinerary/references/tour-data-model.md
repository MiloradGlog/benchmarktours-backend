# Tour data model and house conventions

What an activity is, and how Makoto's existing tours are actually filled in.
Matching the established shape matters more than matching the source document
literally — participants read these in the mobile app, where consistency across
days is what makes a schedule scannable.

## Activity fields

| Field | Notes |
|---|---|
| `type` | `CompanyVisit`, `Discussion`, `Hotel`, `Restaurant`, `Travel` |
| `company_id` | Only for `CompanyVisit`; picks from the Companies list |
| `title` | Required, 2–255 chars |
| `description` | Optional, up to 1000 chars |
| `start_time` / `end_time` | Stored UTC, **entered and displayed as JST** |
| `location_details` | Address; for place activities the app turns it into a Maps button |
| `website` | Only offered for Restaurant/Hotel (and Leisure once deployed) |
| `survey_url` | Optional external survey link |

A `Leisure` type for sightseeing and free time exists in the codebase but is not
deployed yet. Until it ships, tourism blocks are typed `Discussion` — that is a
workaround, not a convention worth spreading. If you see the type available in
the dropdown, it has shipped and is the right choice for sightseeing, shopping,
museums, temples and free evenings.

## A typical tour day

Real tours follow a stable rhythm. Use it to sanity-check a source document and
to fill gaps it leaves implicit:

| Time | Activity | Type |
|---|---|---|
| 07:00–08:00 | Breakfast | Restaurant |
| 08:30–09:00 | Transfer to the Site | Travel |
| 09:00–12:00 | The company visit | CompanyVisit |
| 12:00–13:00 | Lunch | Restaurant |
| 13:30–16:00 | Second visit, or Reflections | CompanyVisit / Discussion |
| 16:00–17:30 | Transfer to the next city | Travel |
| 17:30–19:00 | Reflections on the Site | Discussion |
| 19:00–20:00 | Dinner | Restaurant |
| 22:00–23:00 | *Hotel name* | Hotel |

Points that are easy to get wrong:

- **The hotel is an activity**, titled with the hotel's name, placed late
  (22:00–23:00) so it reads as "where you sleep tonight" rather than an event.
  There is one per night, including the arrival night, and none on the departure
  day.
- **No breakfast on the arrival day.** The group is still flying in.
- **Transfers bracket every visit.** If a source document shows a visit with no
  transfer either side, that is usually the document being terse, not the day
  being different — check against neighbouring days before inventing one.
- **Spreadsheets encode hotels as a row spanning several nights.** A merged cell
  covering Wednesday and Thursday means two separate Hotel activities.

## Titles and descriptions

The established pattern is **title = the learning theme, description = the
detail**, with the company carried by the company link rather than repeated in
the title:

| Title | Company | Description |
|---|---|---|
| IoT and Visual Management | NISSIN Kogyo Co., Ltd | IoT and Visual Management |
| Machine Reliability and Workers Leadership | AVEX Corporation Ltd. | Increase Machine Reliability and Skills of Workers, Leadership Mindset (Toyota Tier 2) |
| Building the Culture of Kaizen | Mazda Motor Corporation | Visiting Mazda Motor Corporation Hofu plant |

Two exceptions exist in live data — the Toyota Commemorative Museum is titled
with its own name because the theme alone would be meaningless, and older
entries are sometimes titled "*Company* visit". Follow whichever pattern the
surrounding days already use rather than rewriting them for consistency; a tour
half-migrated to a new convention reads worse than one consistently old.

Proposal decks phrase each site as `theme – company`, which maps directly:
"Pull system and making a kaizen culture of Jidoka TPS – YAZAKI Meter, Tenryu
factory" becomes that title, that company, and a description naming the factory.

## Companies

`CompanyVisit` activities link to a Companies record, which drives the app's
company page, logo and website. The list is short and fixed — if the source
names a site with no matching record, say so rather than picking the closest
name. Some entries are deliberate stand-ins (the Toyota Commemorative Museum is
linked to "Toyota L&F" because no museum record exists); flag those, don't
silently repoint them.

## Time zone

Everything is JST. The form labels say "(JST)" and the backend stores UTC. When
reading the API, always format with `timeZone: 'Asia/Tokyo'` or you will be nine
hours out and conclude the schedule is wrong.

## Tour-level fields

Tour name, description, dates and status live on the tour record, not the
itinerary. This skill stays on the itinerary page; if the dates or name are
wrong, report it rather than navigating away to fix it.
