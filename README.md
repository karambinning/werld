# WERLD/

**Live intelligence engine from [binning.ai](https://karambinning.github.io/portfolio/).**

What is happening in the world right now, who is reporting it, and where — linked to the original reporting.

- Headlines are each outlet's own words. Nothing is rewritten by a model.
- When several outlets report the same event, WERLD merges them into one story and links every one.
- Built from Binning.AI's Intel Engine; the feed is refreshed about every 15 minutes.

**Draft.** Place and desk labels are assigned automatically and can be wrong —
[report a correction](https://github.com/karambinning/werld/issues/new?title=Correction:%20).

## Pages
- `/s/<CODE>/`: one page per story. Codes are 5 characters and never change, so they are safe to put in a video.
- `/t/<slug>/`: threads, long-running stories with a timeline.
- `/b/<n>/`: numbered briefs, frozen at 07:00 and 18:00 UK time. `/b/<n>/#3` is item 3.
- `/v/<n>/`: the landing page for video #n: the clip, its sources, and what has changed since.

## Data
`data/feed.json` (schema 2), `data/brief.json`, `data/s/<CODE>.json`, `data/t/<slug>.json`, `data/b/<n>.json` and `data/videos.json` are public; the WERLD/ app and video briefs read the same files.

## Layout
`main` holds the hand-written site (`site/`). The `feed` branch holds the generated data and pages, replaced on every publish.

## Credits
Fonts: Bebas Neue (Dharma Type) and IBM Plex Mono (IBM), both under the SIL Open Font License 1.1.
Map outlines: Natural Earth via world-atlas.
