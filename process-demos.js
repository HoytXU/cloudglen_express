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

const fragmentHeader = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform int uDebugMode;
uniform sampler2D iChannel0;
`;

const modeByName = {
  noise: 1,
  detail: 2,
  layers: 3,
  train: 4,
  smoke: 5,
};

async function loadText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.text();
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Failed to load ${path}`)), { once: true });
    image.src = path;
  });
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Debug shader failed to compile");
  }
  return shader;
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Debug program failed to link");
  }
  return program;
}

function createNoiseTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

const [commonSource, debugSource, noiseImage] = await Promise.all([
  loadText("./shaders/common.glsl"),
  loadText("./shaders/debug.glsl"),
  loadImage("./assets/blue-noise.png"),
]);

const fragmentSource = `${fragmentHeader}\n${commonSource}\n${debugSource}`;

function createStudy(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const program = createProgram(gl, fragmentSource);
  const texture = createNoiseTexture(gl, noiseImage);
  return {
    canvas,
    gl,
    program,
    texture,
    mode: modeByName[canvas.dataset.demo],
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    debugMode: gl.getUniformLocation(program, "uDebugMode"),
    channel0: gl.getUniformLocation(program, "iChannel0"),
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
  const seconds = reduceMotion.matches ? 0 : (time-start)/1000;

  for (const study of studies) {
    if (!study.visible) continue;
    const { canvas, gl } = study;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width*dpr));
    const height = Math.max(1, Math.round(rect.height*dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(study.program);
    gl.bindVertexArray(study.vao);
    gl.uniform2f(study.resolution, width, height);
    gl.uniform1f(study.time, seconds);
    gl.uniform1i(study.debugMode, study.mode);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, study.texture);
    gl.uniform1i(study.channel0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
