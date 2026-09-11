# RippleEdit

The RippleEdit website: video editing for music producers. Live at
www.ripple-edit.com (see `CNAME`).

A static site. No build step, no framework, no dependencies: plain HTML, CSS
and ES modules loaded directly by the browser.

## Run locally

```sh
node dev-server.mjs
```

Serves the site at http://localhost:8090 (set `PORT` to change it). The server
sends `Cache-Control: no-store` for HTML/CSS/JS, so a refresh is enough, and
supports byte-range requests, which the video scrubbing needs.

## Structure

```
index.html            the one page, all sections
impressum.html        legal notice
datenschutz.html      privacy policy
css/                  tokens, base, hero, sections, process, legal
js/main.js            everything except the process section
js/process.js         the process section ("How we work")
js/data/              featured work, client profiles, testimonials
assets/               video, images, logos, client portraits, thumbnails
```

## Deploy

Built for GitHub Pages: publish the repository root. `CNAME` holds the
custom domain; `.nojekyll` stops Pages from processing the files.

## Video assets

The videos are trimmed to what the page actually plays:

- `main-film*.mp4`: the first 61s of the hero film (the hero restarts at
  60s), no audio (it is always muted).
- `hero-3.mp4`: 13.08s to 34.6s of the original process plate. The timing
  constants `FILM_START` / `FILM_END` in `js/process.js` are relative to it.
- `background-video-small.mp4`: 720p, no audio (it sits behind a filter at
  50% opacity).

The untrimmed originals live in the old working folder
(`Ripple Edit Website/v8/assets`).

The detailed project history and working notes (`HANDOVER.md`) are kept
locally and are not part of the repository.
