# Cloudglen Express

A WebGL2 reimplementation of the ShaderToy
[** (`Ndc3zl`)](https://www.shadertoy.com/view/Ndc3zl) by **mdb**,
runnable as a self-contained static page with a local soundtrack.

```
cloudglen_express/
├── index.html              page shell, loads main.js
├── style.css               full-viewport canvas
├── main.js                 WebGL2 boilerplate (compile, bind, draw, audio)
├── shaders/
│   ├── scene.glsl          procedural skyline + train + smoke + bridge
│   └── post.glsl           output vignette
└── assets/
    └── soundtrack.mp3      Sape Dayak track played on loop
```

## Running

```bash
cd cloud_train
python3 -m http.server 8000     # any static server works
# open http://localhost:8000
```

The page sizes the canvas to the full browser viewport (`100vw × 100vh`).
The render loop calls `resize()` every frame, so:

- **Browser resize / window drag** — handled.
- **F11** (browser native fullscreen) — handled (the resize listener fires
  on the resulting window-size change; the per-frame call also catches
  any DPR change).
- **F** (custom shortcut) — toggles the *Fullscreen API* on the canvas
  itself (`canvas.requestFullscreen()` / `document.exitFullscreen()`).

The first user gesture (pointer down or any keypress) starts the
soundtrack — required by browser autoplay policies.

## Audio

`assets/soundtrack.mp3` is the audio track of
[*Bornean — Helmy Trianggara* (Sape Dayak Kalimantan)](https://www.bilibili.com/video/BV1gdFNznEQK/),
extracted with `yt-dlp -x --audio-format mp3`. It plays on loop via a
plain `Audio` element — no Web Audio analysis, the visuals are not
reactive to the soundtrack.

## Pipeline

Two fragment-only passes drawn over a single full-screen triangle
(`gl_VertexID`-emitted, no VBO). Both passes share the ShaderToy uniform
contract — `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`,
`iDate`, `iChannel0..1`, `iChannelResolution[4]` — so the GLSL files are
literal ShaderToy code wrapped by a `#version 300 es` header.

```
                         ┌────────────── iChannel0 (1024² value-noise) ──────────┐
                         │                                                       │
                         ▼                                                       │
   ┌──────────────┐  scene.glsl  ┌──────────────┐  post.glsl  ┌──────────┐       │
   │ full-screen  │ ───────────► │  offscreen   │ ──────────► │  screen  │       │
   │   triangle   │              │ FBO (RGBA8)  │             │ default  │       │
   └──────────────┘              └──────────────┘             │   FBO    │       │
                                        ▲                     └──────────┘       │
                                        │                                        │
                                  iChannel1 (1024² procedural "wash" texture) ───┘
```

- **Pass 1 (`scene.glsl`)** renders into an `RGBA8` framebuffer sized to
  the canvas drawing buffer.
- **Pass 2 (`post.glsl`)** reads pass 1 from `iChannel0` and applies a
  vignette into the default framebuffer.
- The wash texture (`iChannel1`) is a one-time CPU-generated 1024×1024
  warm-tinted gradient with hash-grain — used in pass 1 as a
  blend-on-top color grade and conceptually available to pass 2 (it is
  bound but `post.glsl` does not currently sample it).

## Mathematics

### Value noise

`noise(x)` is a textured 2-D value noise. Per cell it reads four
corner samples from `iChannel0` (a static random R8 texture, generated
with a CPU xorshift32) and interpolates with **Perlin's quintic fade**:

\[
u(f) = f^3\bigl(f(6f - 15) + 10\bigr), \qquad f = \mathrm{frac}(x).
\]

This is the polynomial \(6t^5 - 15t^4 + 10t^3\) — `C²`-continuous (its
first *and* second derivatives are zero at \(t \in \{0, 1\}\)), which
removes the directional banding you get from cubic
\(3t^2 - 2t^3\) smoothstep when you stack many noise octaves. The
returned scalar is the bilinear interpolation

\[
n(x) = a + (b - a) u_x + (c - a) u_y + (a - b - c + d) u_x u_y,
\]

with \(a, b, c, d\) the four texel reads. (`du` is computed but unused
in the current shader; it would be the analytic gradient of the noise
field.)

### Fractal Brownian motion

Two fBm flavours sum 8 octaves, doubling frequency and shrinking
amplitude each step:

```glsl
fbm(x):  amp *= 0.7   freq *= 2     // sharper, used for cloud silhouettes
fbm2(x): amp *= 0.9   freq *= 2     // softer, used for the smoke plume
```

The result is normalized by the running sum of weights so it stays in
roughly the same range regardless of octave count. Spectrally this is a
\(1/f^{\alpha}\) field with \(\alpha = -\log_2(\mathrm{gain})\):
`fbm` ≈ \(\alpha = 0.51\) (close to pink), `fbm2` ≈ \(\alpha = 0.15\)
(closer to white, softer).

### Layered cloud silhouettes

The skyline is **13 horizon bands** (`c1`…`c14`) each rasterized by:

```
midlevel ∈ [-0.1 … 1.0]      // band's vertical anchor
disp                          // height-displacement amplitude
dist                          // parallax denominator (bigger = slower)
uv2 = uv + vec2(t/dist + φ, 0)
h(x) = (fbm(uv2, 8) − 0.5) · disp
```

then the `layer(dh, color)` macro early-returns the band's color
whenever `uv.y < h + midlevel − dh`. Stacking layers with descending
`dh` produces the gradient *inside* a band (rim → mid → core), and the
full back-to-front order produces the depth gradient *across* bands.
Because each band advects with its own `t/dist`, foreground bands slide
faster than background ones — classical 2-D parallax, but driven by the
fBm height field instead of textured strips. Each band also gets a
phase offset `φ` so they decorrelate.

The motion is purely horizontal (`uv2 = uv + vec2(t/dist + φ, 0)`); the
vertical noise samples never change in time, which is what gives the
clouds their stable silhouette.

### Foreground antialiasing by accumulation

For pixels in the lower half of the screen, `mainImage` averages
**5 temporally jittered foreground evaluations**:

\[
\text{fg}(uv) \;=\; \frac{1}{5}\sum_{i=0}^{4}
  \text{foreground}\!\left(uv,\; t + \tfrac{4}{60}\cdot\tfrac{i}{5}\right)
\]

This is a 1-frame motion-blur of the fast-moving low-distance bands —
visually it softens the otherwise hard `step` boundaries of the layer
macro by smearing them over ~1/15 s of motion.

### The train (procedural raster)

The locomotive lives at fixed pixel-space coordinates. It is drawn with
combinator masks:

- **Wagon body** — `box`-shaped frame ANDed with a column pattern
  `step(0.05, 1 - |2·fract(uv.x·9) - 1|)`, i.e. "9 wagons per UV-span,
  draw the column if we're at least 5% away from the centerline".
- **Roof** — same trick with a different threshold (a slightly narrower
  band) and at a higher `y`.
- **Locomotive head** — three boxes (body, chimney, chimney rim) plus a
  roof.
- **Wheels** — squared-distance disks
  \(1 - \mathrm{step}(r^2,\, \lVert uv - c \rVert^2)\) using
  `dot2(v) = dot(v,v)` as a no-sqrt squared norm. Per-wagon wheels reuse
  the same `uv2 = fract(uv·9)` lattice so they auto-replicate.

### Smoke plume

A single fBm field is scrolled and slightly counter-skewed
(`uv2.x -= 0.2·t/dist`) to mimic the plume curling backward. The plume
mask is the implicit equation

\[
y \;=\; \bigl|\,uv_y + 0.4\,h(x) - 0.16\sqrt{x} - 0.12\,\bigr|
        \;-\; 0.8\,x\,e^{-10x}, \qquad x = 0.49 - uv_x.
\]

Geometrically: a centerline arch \(y_0(x) = 0.16\sqrt{x} + 0.12\)
(rising fast near the chimney, then flattening) is fattened by a
**bell-shaped half-thickness** \(0.8\,x\,e^{-10x}\) (this peaks at
\(x = 0.1\) — i.e. just behind the chimney) and noise-perturbed by
\(0.4\,h(x)\). The interior `y < 0` is filled white; the
deeper interior `y < -0.02` gets the slightly darker "core" tint.

The factor \(x e^{-10x}\) is the un-normalized
\(\Gamma(2, \lambda{=}10)\) probability density — used here purely as a
compact analytic envelope that is 0 at the chimney, peaks shortly
after, and decays exponentially.

### Bridge

A repeating parabolic-deck trestle. After tiling
`uv2.x = fract((uv.x + t/5 + 32.5) · 3)` (3 spans across the screen,
moving with the train), the deck silhouette is built from four
multiplied masks:

1. The deck line
   \(\bigl|\,uv2_y - 0.15\,(uv2_x - 0.5)^2 - 0.12\,\bigr|\) thresholded
   with `smoothstep(0.001, 0.003, …)` for a sub-pixel edge.
2. A pylon column band along the centerline.
3. A center-relief mask `smoothstep(0.02, 0.05, 1 - |2·uv2.x - 1|)`.
4. A picket pattern at 16× horizontal frequency
   `smoothstep(0.05, 0.2, 1 - |2·fract(uv2.x·16) - 1|)` — the X-trusses
   under the deck.

The trestle color is multiplied by `smoothstep(-0.08, 0.08, uv.y)` so
it fades into the lower haze rather than sitting on a hard edge.

### Color grade

After the scene composes (background → train → foreground), the result
is mixed 30% with the wash texture:

```glsl
col = mix(col, texture(iChannel1, uv).rgb, 0.3);
```

The wash is CPU-baked (see `createWashTexture` in `main.js`) — a
warm-tinted gradient with a soft sun-glow centered at uv ≈ (0.72, 0.68)
plus deterministic per-pixel grain. Effectively a fixed LUT-on-top.

### Post-process vignette

`post.glsl` is a one-liner:

```glsl
col *= 0.5 + 0.5·pow( 16·u·v·(1-u)·(1-v), 0.2 );
```

The product \(16\,u\,v\,(1-u)\,(1-v)\) is the separable polynomial
*"flat-top circle"*: it equals **1 at the center** \((u, v) = (0.5,
0.5)\) and **0 on the borders**. Raising to power 0.2 (i.e. taking the
fifth root) **flattens** the top — most of the frame stays bright — and
sharpens the falloff near the edges. The final factor \(0.5 + 0.5(\cdot)\)
clamps the darkening to at most 50% so the corners don't crush to
black.

## WebGL2 specifics

A few non-obvious choices in `main.js` worth knowing if you want to
modify the host:

- **No vertex buffers.** The vertex shader emits a covering triangle
  from a constant array indexed by `gl_VertexID`. The draw call is
  `gl.drawArrays(TRIANGLES, 0, 3)`. This is faster than a triangle
  strip *and* renders the entire framebuffer in one primitive (no seam
  at the diagonal).
- **DPR clamp.** `dpr = min(devicePixelRatio, 2)` so a Retina/4K
  display doesn't quietly 4× the fragment workload.
- **Lazy resize.** `resize()` checks `canvas.width === width && …` and
  bails early; only the first frame after a real size change pays the
  framebuffer rebuild cost (`createTarget` does
  `gl.deleteFramebuffer` + `gl.deleteTexture` + reallocate).
- **`iMouse.zw`.** Is set on `pointerdown` only and never reset, which
  matches ShaderToy's convention (`zw` = down-position, `xy` = current
  position; `xy` is sign-flipped on Y).
- **`iDate.w`.** Is the seconds-since-midnight as a float, with
  millisecond precision — same as ShaderToy.

## Credits

- Shader: [iq, *up in the cloud sea*](https://www.shadertoy.com/view/Ndc3zl)
- Soundtrack: [*Bornean* — Helmy Trianggara](https://www.bilibili.com/video/BV1gdFNznEQK/)
- WebGL2 host: written for this repo.
