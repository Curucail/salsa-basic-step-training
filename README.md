# Salsa On2 Feet

A static page: an embedded YouTube player for *Tu Con Él* (Frankie Ruiz) and, below it, two pairs of shoes
(leader in black patent dance shoes, follower in heels) dancing the salsa on2 basic step on hand-annotated beats.

## Run it

No build step.

```
python -m http.server 8000     # then open http://localhost:8000
```

(Opening `index.html` directly also works, but the YouTube player prefers a real origin.)

## Publish on GitHub Pages

1. Create an empty repository on GitHub and push this one:
   ```
   git remote add origin https://github.com/Curucail/salsa-basic-step-training.git
   git push -u origin main
   ```
2. Repository **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The page is at `https://curucail.github.io/salsa-basic-step-training/` after a minute.

## Controls

- **Music / Beat clicks**: a click on every step is played over the video (count 1 has a higher pitch). The two
  sliders are the mix between the music and the clicks. *Clicks on* limits them to 1 and 5.
- **View as follower** swaps the two places on the floor, so the follower's steps are seen from behind (and back).
  The choice is remembered.
- The beats were annotated on an audio file, so they are shifted by a fixed -95 ms against the video
  (`SYNC_MS` at the top of `app.js`; a different upload may need another value).
- The browser blocks sound until you click on the page once; a click inside the video counts.
- Clicks are scheduled by a timer, so keep the tab in the foreground (browsers throttle background tabs).

## The step

Leader: 1 left foot a bit to the back · 2 right foot to the very back · 3 left foot back on its spot from 1 ·
5 right foot a bit in front of the center · 6 left foot steps forward · 7 right foot back on its spot from 5.
Counts 4 and 8 are not stepped on (the free foot is already travelling to where it lands next).
The follower mirrors the leader: what the leader's left foot does, the follower's right foot does the other way round
(back becomes forward), and vice versa.

A foot lands exactly on its beat; it is already travelling during the beat before. Before the first beat the
dancers stand with both feet centered; the foot that steps on count 1 moves into place during the beat before it and
the other one stays centered until its own step (only one foot moves at a time). The positions are two small
arrays at the top of `dance.js`; change them to try other patterns.

When the next label is not the expected one (1→2, …, 8→1) the dancers just go on to the next step: only the foot
that steps on that label moves, straight to its position, and the other foot stays where it is. After a gap of more
than 1.5 s in the annotation that foot moves in the last 0.35 s before its beat.

## Title and description

Edit **`content.md`**: the first `# heading` is the page title (also the browser tab title), everything below it is
the description. Paragraphs, `##` headings, `- ` lists, `**bold**`, `*italic*`, `` `code` `` and `[links](https://…)`
work; raw HTML is shown as text. (Served over http, as in the steps above; if `content.md` cannot be loaded the page
keeps the text written in `index.html`.)

## Updating the beats

After editing the annotation in the beat annotator, copy its csv over `data/tu-con-el.csv` and regenerate `beats.js`:

```
copy "..\salsa-beat-trackers\annotations\Tu Con El - Frankie Ruiz.csv" data\tu-con-el.csv
python tools/make_beats.py
```

## Files

| file | |
| --- | --- |
| `index.html` | page and styles |
| `content.md` | page title and description (markdown) |
| `markdown.js` | the small markdown reader for `content.md` |
| `app.js` | video clock, click track, drawing, controls |
| `dance.js` | the step as foot positions per count, and the interpolation between beats |
| `beats.js` | `[time, count]` for every beat (generated from `data/tu-con-el.csv` by `tools/make_beats.py`) |
| `data/tu-con-el.csv` | the annotation: `time,position` with position = count 1-8, 1 = downbeat |
| `test/*.test.js` | `node test/dance.test.js`, `node test/markdown.test.js` |

`?t=17.1` shows one still frame of the animation at that time of the song (no video), handy for testing.
