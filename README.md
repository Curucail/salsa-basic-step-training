# Salsa On2 Feet

A static page: an embedded YouTube player for *Tu Con Él* (Frankie Ruiz) and, below it, two pairs of shoes
(leader in sneakers, follower in heels) dancing the salsa on2 basic step on hand-annotated beats.

## Run it

No build step.

```
python -m http.server 8000     # then open http://localhost:8000
```

(Opening `index.html` directly also works, but the YouTube player prefers a real origin.)

## Publish on GitHub Pages

1. Create an empty repository on GitHub and push this one:
   ```
   git remote add origin https://github.com/<you>/salsa-on2-viz.git
   git push -u origin main
   ```
2. Repository **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The page is at `https://<you>.github.io/salsa-on2-viz/` after a minute.

## Controls

- **Music / Beat clicks**: a click on every beat is played over the video (count 1 has a higher pitch). The two
  sliders are the mix between the music and the clicks. *Clicks on* limits them to the steps (not 4 and 8) or to 1 and 5.
- **Sync**: the beats were annotated on an audio file, so the video may be a few milliseconds off (or have a different
  intro). If the clicks come too late, drag Sync to the left; if too early, to the right. It is remembered.
- The browser blocks sound until you click on the page once; a click inside the video counts.
- Clicks are scheduled by a timer, so keep the tab in the foreground (browsers throttle background tabs).

## The step

Leader (sneakers): 1 L back · 2 R replace · 3 L together · 4 pause · 5 R forward · 6 L replace · 7 R together · 8 pause.
Follower (heels): 1 R forward · 2 L replace · 3 R together · 4 pause · 5 L back · 6 R replace · 7 L together · 8 pause.

A foot lands exactly on its beat; it is already travelling during the beat before. The break steps (direction
changes) are on 2 and 6. The tables are in `dance.js` (`FEET`, `LANDS`); change them to try other patterns.

## Files

| file | |
| --- | --- |
| `index.html` | page and styles |
| `app.js` | video clock, click track, drawing, controls |
| `dance.js` | the step as foot positions per count, and the interpolation between beats |
| `beats.js` | `[time, count]` for every beat (generated from `data/tu-con-el.csv`) |
| `data/tu-con-el.csv` | the annotation: `time,position` with position = count 1-8, 1 = downbeat |
| `test/dance.test.js` | `node test/dance.test.js` |

`?t=17.1` shows one still frame of the animation at that time of the song (no video), handy for testing.
