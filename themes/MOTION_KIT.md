# The motion kit

One CSS file, `themes/shared/motion-kit.css` (**under 4 KB**), gives every theme the same animations. A theme uses **class names only**; it does not write animation CSS of its own. The build copies the file, byte for byte, into every package between two markers at the top of `css/motion.css`:

```
/* shared:motion-kit:begin */
...the kit...
/* shared:motion-kit:end */
...the theme's own motion CSS, if any...
```

`node themes/cli.mjs build-themes` does the copy for the Standard themes (and `build-themes --check` fails when a copy differs); the internal `_starter` carries the same text; `test/motion-kit.test.mjs` checks that all copies are identical. A Premium theme made in Bolt copies the markers and the kit unchanged and adds its own motion after the end marker. The whole `css/motion.css` must stay **under 6 KB**, so a theme has about 2 KB of its own motion CSS.

## What drives it

| Wrapper attribute / token | What it does |
|---|---|
| `data-motion="off"` | Fully static: no reveal, no counters, no float or pulse, transitions run in 0 s, no hover lift. |
| `data-motion="low"` (the default tokens) | Reveal, underline and sweep, card lift, sticky bar and menu slide, counters, float, pulse, dividers. Distance 12 px, speed 0.5 s. |
| `data-motion="medium"` | Adds hero image zoom and the marquee. Distance 16 px. |
| `data-motion="rich"` | Adds parallax and the headline shimmer. Distance 28 px, speed 0.8 s. |
| `--g4d-motion-speed`, `--g4d-motion-ease`, `--g4d-motion-distance` | The three tokens. A theme may override them on its wrapper (not required). |
| `prefers-reduced-motion: reduce` | Nothing moves and nothing is hidden: every effect lives inside `prefers-reduced-motion: no-preference`, and a final block sets `animation: none; transition: none`. |

Only `transform`, `opacity`, `clip-path` and `filter` are animated.

## Classes

| Class | Put it on | One line |
|---|---|---|
| `g4d-reveal` | a section, grid or list (**never the hero**) | the box and its first six children fade and rise as they enter the screen, staggered; plain visible layout where `animation-timeline: view()` is not supported |
| `g4d-hero-zoom` | the hero picture's wrapper | the picture inside zooms slowly (Medium and Rich) |
| `g4d-shimmer` | the accent word of the headline | a soft brightness pulse (Rich) |
| `g4d-float` | a badge | gentle up-and-down float |
| `g4d-underline` | the call button or a link | a line draws under it on hover and focus |
| `g4d-sweep` | a card | the same line, in the accent colour, sweeps along the bottom edge |
| `g4d-count` | an **empty** inline element with `style="--g4d-to:120"` | counts from 0 to the number; shows the final number when motion is off |
| `g4d-marquee` with `g4d-marquee__track` inside | a strip of badges (list twice, second copy `aria-hidden`) | scrolls slowly, pauses on hover and focus (Medium and Rich) |
| `g4d-lift` | a card | rises 4 px on hover and focus |
| `g4d-parallax` | a wrapper around an `img` | the picture drifts as it scrolls (Rich) |
| `g4d-ba` with `g4d-ba__after` | a before and after pair, with `id` | half of the second picture shows; opening `#id` reveals all of it (no script) |
| `g4d-divider` | the divider element between sections | shape from the wrapper's `data-divider`: `wave`, `curve`, `diagonal`, `notch`, `speed-line` |
| `g4d-burger` | the phone menu button, three `<i>` bars 2 px high with a 5 px gap | the bars turn into a cross while `.g4d-menu:target` is open (browsers with `:has()`) |

Automatic (no class needed): the platform's bottom bar (`g4d-slot--bottom-nav`) slides up, the floating WhatsApp button pulses three times and stops, the phone menu (`.g4d-menu:target`) slides in, and a cross-document fade (`@view-transition`) where the browser supports it.

The Standard themes also carry two extras that are not part of the kit (`source/shared/css/motion.css`): `g4d-zoom` (card picture zoom on hover) and `g4d-mask` (a clip-path reveal of a picture).

## Seeing it

`node themes/cli.mjs preview` then open **Motion lab** (`/motion`): every class above, the four intensities, a reduced-motion switch (`?reduced=1`), the count of animated elements per section (limit 12) and the CSS size readout with the kit's own size.

## Rules the lint enforces on motion

`css-budget-motion` (6 KB), `reduced-motion` (block present), `hero-visible` (the hero is never hidden at the start), `motion-properties` (only the four properties), `motion-count` (at most 12 animated elements per section).
