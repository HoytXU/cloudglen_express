const vertexSource = `#version 300 es
precision highp float;

const vec2 positions[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);

void main() {
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}`;

const fragmentPrelude = `#version 300 es
precision highp float;

out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = hash(cell);
  float b = hash(cell + vec2(1.0, 0.0));
  float c = hash(cell + vec2(0.0, 1.0));
  float d = hash(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float cloudNoise(vec2 p) {
  float shape = noise(p);
  float detail = 0.7 * noise(2.0 * p);
  float fine = 0.49 * noise(4.0 * p);
  return (shape + detail + fine) / 2.19;
}

float smokeNoise(vec2 p) {
  float sum = 0.0;
  float weight = 0.0;
  float amplitude = 1.0;
  for (int k = 0; k < 8; k++) {
    sum += amplitude * noise(p);
    weight += amplitude;
    p *= 2.0;
    amplitude *= 0.9;
  }
  return sum / weight;
}

vec3 skyColor(vec2 uv) {
  return mix(vec3(0.96, 0.97, 0.98), vec3(0.72, 0.80, 0.85), uv.y);
}
`;

const fragments = {
  noise: `${fragmentPrelude}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float y = 0.5 + 0.62 * (noise(vec2(4.0 * uv.x + 0.08 * uTime, 0.0)) - 0.5);

  vec3 color = vec3(0.97, 0.98, 0.98);
  vec2 gridDistance = abs(fract(uv * vec2(10.0, 5.0)) - 0.5);
  float grid = 1.0 - smoothstep(0.47, 0.49, max(gridDistance.x, gridDistance.y));
  color = mix(color, vec3(0.65, 0.70, 0.73), 0.18 * grid);

  float area = 1.0 - smoothstep(y - 0.012, y + 0.012, uv.y);
  float curve = 1.0 - smoothstep(0.006, 0.014, abs(uv.y - y));
  color = mix(color, vec3(0.58, 0.70, 0.77), 0.22 * area);
  color = mix(color, vec3(0.16, 0.29, 0.36), curve);
  outColor = vec4(color, 1.0);
}`,

  detail: `${fragmentPrelude}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  bool detailed = uv.x >= 0.5;
  float localX = fract(uv.x * 2.0);
  vec2 p = vec2(3.2 * localX + 0.07 * uTime, 1.4);
  float value = detailed ? cloudNoise(p) : noise(p);
  float y = 0.52 + 0.82 * (value - 0.5);

  vec3 color = skyColor(vec2(localX, uv.y));
  color = mix(color, vec3(0.70, 0.79, 0.83), 1.0 - smoothstep(y - 0.01, y + 0.01, uv.y));
  if (detailed) {
    color = mix(color, vec3(0.48, 0.61, 0.67), 1.0 - smoothstep(y - 0.09, y - 0.07, uv.y));
    color = mix(color, vec3(0.28, 0.39, 0.45), 1.0 - smoothstep(y - 0.17, y - 0.15, uv.y));
  }
  outColor = vec4(color, 1.0);
}`,

  layers: `${fragmentPrelude}
float heightAt(float x, float time, float distance, float phase, float middle, float spread) {
  float shape = cloudNoise(vec2(2.8 * (x + time / distance) + phase, 1.7));
  return middle + spread * (shape - 0.5);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 color = skyColor(uv);

  float farY = heightAt(uv.x, uTime, 20.0, 1.0, 0.78, 0.55);
  float middleY = heightAt(uv.x, uTime, 9.0, 4.2, 0.61, 0.62);
  float nearY = heightAt(uv.x, uTime, 4.0, 7.4, 0.43, 0.75);
  float frontY = heightAt(uv.x, uTime, 2.0, 11.0, 0.22, 0.9);

  color = mix(color, vec3(0.86, 0.89, 0.91), 1.0 - smoothstep(farY - 0.008, farY + 0.008, uv.y));
  color = mix(color, vec3(0.68, 0.76, 0.80), 1.0 - smoothstep(middleY - 0.008, middleY + 0.008, uv.y));
  color = mix(color, vec3(0.47, 0.58, 0.63), 1.0 - smoothstep(nearY - 0.008, nearY + 0.008, uv.y));
  color = mix(color, vec3(0.25, 0.33, 0.37), 1.0 - smoothstep(frontY - 0.008, frontY + 0.008, uv.y));
  outColor = vec4(color, 1.0);
}`,

  smoke: `${fragmentPrelude}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Crop the production shader's coordinate system to the plume region.
  vec2 p = vec2(0.55 * uv.x, 0.45 * uv.y);
  float x = 0.49 - p.x;
  float h = smokeNoise(p + vec2(0.16 * uTime + 3.5, 0.0)) - 0.55;
  float center = 0.16 * sqrt(max(x, 0.0)) + 0.12 - 0.4 * h;
  float width = 0.8 * x * exp(-10.0 * x);

  float plume = (1.0 - smoothstep(width, width + 0.004, abs(p.y - center)))
    * step(0.0, x);
  float centerline = (1.0 - smoothstep(0.001, 0.0035, abs(p.y - center)))
    * step(0.0, x);

  vec3 color = vec3(0.96, 0.97, 0.97);
  vec2 gridDistance = abs(fract(uv * vec2(10.0, 5.0)) - 0.5);
  float grid = 1.0 - smoothstep(0.47, 0.49, max(gridDistance.x, gridDistance.y));
  color = mix(color, vec3(0.67, 0.71, 0.73), 0.15 * grid);
  color = mix(color, vec3(0.63, 0.70, 0.73), 0.72 * plume);
  color = mix(color, vec3(0.18, 0.31, 0.38), centerline);

  float chimney = step(0.476, p.x) * step(p.x, 0.49)
    * step(0.07, p.y) * step(p.y, 0.13);
  color = mix(color, vec3(0.18, 0.22, 0.24), chimney);
  outColor = vec4(color, 1.0);
}`,

  train: `${fragmentPrelude}
float boxMask(vec2 p, vec2 center, vec2 halfSize) {
  vec2 d = abs(p - center) - halfSize;
  return 1.0 - step(0.0, max(d.x, d.y));
}

float circleMask(vec2 p, vec2 center, float radius) {
  return 1.0 - smoothstep(radius, radius + 0.004, length(p - center));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 color = skyColor(uv);

  float farY = 0.68 + 0.45 * (cloudNoise(vec2(2.7 * uv.x + 0.03 * uTime, 2.0)) - 0.5);
  float nearY = 0.2 + 0.65 * (cloudNoise(vec2(3.0 * uv.x + 0.15 * uTime, 5.0)) - 0.5);
  color = mix(color, vec3(0.74, 0.82, 0.85), 1.0 - smoothstep(farY, farY + 0.01, uv.y));

  float deck = boxMask(uv, vec2(0.5, 0.265), vec2(0.5, 0.018));
  float span = fract(uv.x * 4.0);
  float support = (1.0 - smoothstep(0.025, 0.035, abs(span - 0.5)))
    * step(0.05, uv.y) * (1.0 - step(0.265, uv.y));
  float archY = 0.09 + 0.43 * (span - 0.5) * (span - 0.5);
  float arch = (1.0 - smoothstep(0.008, 0.016, abs(uv.y - archY)))
    * (1.0 - step(0.27, uv.y));
  float bridge = max(deck, max(support, arch));
  color = mix(color, vec3(0.20, 0.25, 0.28), bridge);

  float body = boxMask(uv, vec2(0.49, 0.38), vec2(0.31, 0.07));
  body = max(body, boxMask(uv, vec2(0.67, 0.455), vec2(0.1, 0.095)));
  float chimney = boxMask(uv, vec2(0.76, 0.55), vec2(0.018, 0.075));
  chimney = max(chimney, boxMask(uv, vec2(0.76, 0.63), vec2(0.035, 0.012)));
  float wheels = 0.0;
  wheels = max(wheels, circleMask(uv, vec2(0.25, 0.3), 0.045));
  wheels = max(wheels, circleMask(uv, vec2(0.41, 0.3), 0.045));
  wheels = max(wheels, circleMask(uv, vec2(0.59, 0.3), 0.048));
  wheels = max(wheels, circleMask(uv, vec2(0.72, 0.3), 0.048));
  float train = max(max(body, chimney), wheels);
  color = mix(color, vec3(0.12, 0.17, 0.20), train);

  float dx = 0.76 - uv.x;
  float smokeCenter = 0.65 + 0.18 * sqrt(max(dx, 0.0));
  smokeCenter += 0.035 * (noise(vec2(12.0 * dx - 0.35 * uTime, 3.0)) - 0.5);
  float smokeWidth = 0.016 + 0.1 * max(dx, 0.0);
  float smoke = (1.0 - smoothstep(smokeWidth, smokeWidth + 0.015, abs(uv.y - smokeCenter)))
    * step(0.0, dx) * (1.0 - step(0.48, dx));
  color = mix(color, vec3(0.93, 0.95, 0.95), 0.86 * smoke);

  color = mix(color, vec3(0.36, 0.46, 0.51), 1.0 - smoothstep(nearY, nearY + 0.012, uv.y));
  outColor = vec4(color, 1.0);
}`,
};

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Study shader failed to compile");
  }
  return shader;
}

function createStudy(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragments[canvas.dataset.demo]));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Study shader failed to link");
  }

  return {
    canvas,
    gl,
    program,
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    vao: gl.createVertexArray(),
    visible: true,
  };
}

const studies = [...document.querySelectorAll(".study-canvas")]
  .map(createStudy)
  .filter(Boolean);

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const study = studies.find((item) => item.canvas === entry.target);
    if (study) study.visible = entry.isIntersecting;
  }
});

for (const study of studies) observer.observe(study.canvas);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const start = performance.now();

function render(time) {
  const seconds = reduceMotion.matches ? 0 : (time - start) / 1000;

  for (const study of studies) {
    if (!study.visible) continue;

    const { canvas, gl } = study;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(study.program);
    gl.bindVertexArray(study.vao);
    gl.uniform2f(study.resolution, width, height);
    gl.uniform1f(study.time, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
