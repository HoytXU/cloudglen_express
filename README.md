# Cloudglen Express

Cloudglen Express is a static WebGL2 study of a procedural cloud landscape. It
adapts mdb's ShaderToy scene
[*Up in the Cloud Sea*](https://www.shadertoy.com/view/Ndc3zl) into a standalone
two-pass renderer, then decomposes the image into small live demonstrations of
value noise, fBm, parallax, analytic masks, smoke, and ordered compositing.

The project is educational. It is not presented as the original artwork or as
an independent derivation of the source shader.

## What is on the page

- A 16:9 live rendering of the complete scene.
- Music and fullscreen controls beneath the showcase. Music is off by default.
- Six small WebGL2 figures that isolate noise, cloud detail, depth layers,
  train geometry, smoke, and the post-process vignette.
- Equations expanded from elementary examples into the expressions used by the
  shaders.
- Numbered references linked to primary publication or creator pages.

## Run locally

There is no build step and no package installation.

```bash
git clone https://github.com/HoytXU/cloudglen_express.git
cd cloudglen_express
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser with WebGL2 support. Opening
`index.html` directly as a `file://` URL will not work reliably because the
module loads GLSL and image assets with `fetch()`.

## Controls

- **Music: Off / On** — explicitly starts or pauses the local soundtrack.
- **Fullscreen** — presents the final scene through the Fullscreen API.
- **F** — keyboard shortcut for the same fullscreen action.

Audio never starts from page load or from an unrelated user gesture.

## Project layout

```text
cloudglen_express/
├── index.html                 article, equations, controls, and references
├── style.css                  academic page layout and bounded canvas sizing
├── main.js                    final two-pass WebGL2 renderer and audio control
├── process-demos.js           shared debug renderer for the six figures
├── webgl-utils.js             shared WebGL setup, loading, and error helpers
├── shaders/
│   ├── common.glsl            production functions shared by scene and figures
│   ├── debug.glsl             intermediate-output debug modes
│   ├── scene.glsl             final clouds and ordered composition
│   └── post.glsl              vignette pass
└── assets/
    ├── blue-noise.png         1024 × 1024 scalar source texture
    └── soundtrack.mp3         optional local soundtrack
```

## Rendering pipeline

The final image uses two fragment passes and one full-screen triangle. No
vertex buffer or scene geometry is required.

```text
blue-noise texture ──► common.glsl
                         ├──► scene.glsl ──► framebuffer ──► post.glsl
                         └──► debug.glsl ──► explanatory figures
```

1. `common.glsl` samples `iChannel0` to construct textured value noise for both
   the final scene and debug figures.
2. Eight normalized noise octaves form the cloud boundaries.
3. The shader evaluates those boundaries at different offsets and speeds to
   produce layered parallax.
4. Boxes, circles, repeated coordinates, and threshold masks draw the train and
   bridge.
5. A noisy curved strip produces the smoke plume.
6. `post.glsl` samples the completed scene and applies the edge vignette.

The host exposes ShaderToy-style uniforms including `iResolution`, `iTime`,
`iFrame`, `iMouse`, `iDate`, and `iChannel0`. The drawing buffer follows the
canvas's actual CSS size and clamps device pixel ratio to 2 to control fragment
cost on dense displays.

## Explanatory figures

`process-demos.js` compiles one debug shader with the same `common.glsl` module
and blue-noise texture as the final renderer. A debug-mode uniform selects the
intermediate output for each figure:

| Figure | Isolated idea |
| --- | --- |
| Value noise | Smooth interpolation between random lattice values |
| Octaves | Three production-noise scales and their normalized sum |
| Layers | Exact isolated production cloud masks at four distances |
| Train and bridge | Exact cropped production masks |
| Smoke | Exact production noise field and nested smoke masks |
| Composition | Exact vignette field and its multiplicative effect |

The figures are rendered only while visible. Their drawing buffers are resized
from their bounded CSS boxes, so embedding the page under a different domain or
path does not make them inherit viewport-sized canvas dimensions.

## Static deployment

All project assets use document-relative URLs such as `./shaders/scene.glsl`.
The site can therefore be hosted at a domain root or a subdirectory without
rewriting paths. A deployment must serve the repository files together and
must not replace missing `.glsl`, `.png`, or `.mp3` requests with an HTML error
page.

Useful checks after deployment:

```text
./shaders/scene.glsl       returns shader text
./shaders/common.glsl      returns shader text
./shaders/debug.glsl       returns shader text
./shaders/post.glsl        returns shader text
./assets/blue-noise.png    returns a PNG
./assets/soundtrack.mp3    returns audio
```

The article width is capped at 820 px. The final canvas keeps a 16:9 ratio, and
the explanatory figures use fixed bounded heights on desktop and mobile. These
constraints prevent a host stylesheet or a tall code panel from stretching a
WebGL canvas.

## References and attribution

- **Source scene:** mdb,
  [*Up in the Cloud Sea*](https://www.shadertoy.com/view/Ndc3zl), ShaderToy.
  This is the original visual design and GLSL composition adapted here.
- **Quintic fade:** Ken Perlin,
  [Improved Noise reference implementation](https://cs.nyu.edu/~perlin/noise/).
  The project uses this polynomial to smooth the interpolation weights in its
  value-noise field.
- **Octave-based procedural functions:** F. Kenton Musgrave, Craig E. Kolb, and
  Robert S. Mace,
  [*The Synthesis and Rendering of Eroded Fractal Terrains*](https://dl.acm.org/doi/10.1145/74333.74335),
  SIGGRAPH 1989.
- **Blue-noise background:** Christoph Peters,
  [*Free Blue Noise Textures*](https://momentsingraphics.de/BlueNoise.html).
  This explains the texture class; it is not a provenance claim for the bundled
  PNG.
- **Music:** Helmy Trianggara,
  [*Bornean*](https://www.youtube.com/watch?v=8idsn_FdsI4), original upload on
  the artist's YouTube channel.

## Disclaimer

Codex-assisted decomposition of mdb's *Up in the Cloud Sea* on ShaderToy, for
educational purposes only. Original artwork, shader, music, papers, and linked
materials remain the work of their respective creators and publishers.
