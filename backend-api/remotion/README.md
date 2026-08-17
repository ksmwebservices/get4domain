# Get4Domain reel renderer (Remotion)

Standalone render tool for AI Studio "Photo Reel" — the vendor's own photos + a text
overlay + an optional licensed music track, composited to an MP4. This is the
slideshow+audio model (Aug 10 decision), not AI video generation.

It is deliberately **separate from the NestJS build**: the backend `reels` module
invokes `render.mjs` as a child process, so Remotion's heavy native dependencies
(headless Chrome + FFmpeg) never enter `nest build`. Render happens on the VM.

## VM setup (once)

```bash
cd backend-api/remotion
npm install          # pulls remotion + @remotion/renderer (downloads Chrome Headless Shell on first render)
# ensure FFmpeg is installed and on PATH (apt-get install -y ffmpeg)
```

## Render (what the backend runs)

```bash
node render.mjs /tmp/reel-props.json /tmp/reel-out.mp4
```

## Licensing — confirm before production use

- **Remotion**: free for individuals and companies with ≤3 people; **4+ needs a paid
  Company License** (per seat). Confirm KSM's headcount/license before shipping.
- **Music tracks**: none are bundled. See `tracks/README.md` — KSM adds only tracks
  whose license permits multi-vendor reuse, with proof.
