const canvas = document.querySelector("#gl");
const shaderCard = document.querySelector(".shader-card");
const gl = canvas.getContext("webgl2", {
  antialias: false,
  depth: false,
  stencil: false,
  alpha: false,
  preserveDrawingBuffer: false,
});

if (!gl) {
  throw new Error("WebGL2 is not available");
}

const soundtrack = new Audio("./assets/soundtrack.mp3");
soundtrack.loop = true;
soundtrack.preload = "auto";

function startSoundtrack() {
  soundtrack.play().catch(() => {});
}

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

const shaderHeader = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 outColor;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec3 iChannelResolution[4];
`;

function wrapShadertoy(source) {
  return `${shaderHeader}
${source}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  outColor = color;
}`;
}

async function loadText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.text();
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
  }
  return shader;
}

function createProgram(fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
  }
  return {
    program,
    uniforms: {
      iResolution: gl.getUniformLocation(program, "iResolution"),
      iTime: gl.getUniformLocation(program, "iTime"),
      iTimeDelta: gl.getUniformLocation(program, "iTimeDelta"),
      iFrame: gl.getUniformLocation(program, "iFrame"),
      iMouse: gl.getUniformLocation(program, "iMouse"),
      iDate: gl.getUniformLocation(program, "iDate"),
      iChannel0: gl.getUniformLocation(program, "iChannel0"),
      iChannel1: gl.getUniformLocation(program, "iChannel1"),
      iChannelResolution: gl.getUniformLocation(program, "iChannelResolution"),
    },
  };
}

function createTexture(width, height, data = null, filter = gl.LINEAR, wrap = gl.REPEAT) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return texture;
}

function createRandomTexture(size) {
  const data = new Uint8Array(size * size * 4);
  let seed = 0x12345678;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) & 255;
  };
  for (let i = 0; i < data.length; i += 4) {
    const v = rnd();
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return createTexture(size, size, data, gl.NEAREST, gl.REPEAT);
}

function createWashTexture(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const u = x / (width - 1);
      const v = y / (height - 1);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.72, v - 0.68) * 1.7);
      const grain = ((x * 17 + y * 31) % 19) / 255;
      data[i] = Math.min(255, 190 + glow * 62 + grain * 255);
      data[i + 1] = Math.min(255, 112 + glow * 78 + grain * 180);
      data[i + 2] = Math.min(255, 80 + glow * 56 + grain * 140);
      data[i + 3] = 255;
    }
  }
  return createTexture(width, height, data, gl.LINEAR, gl.REPEAT);
}

function createTarget(width, height) {
  const texture = createTexture(width, height, null, gl.LINEAR, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer is incomplete");
  }
  return { texture, framebuffer, width, height };
}

const [sceneText, postText] = await Promise.all([
  loadText("./shaders/scene.glsl"),
  loadText("./shaders/post.glsl"),
]);

const scene = createProgram(wrapShadertoy(sceneText));
const post = createProgram(wrapShadertoy(postText));
const noiseTexture = createRandomTexture(1024);
const washTexture = createWashTexture(1024, 1024);
const vao = gl.createVertexArray();
const mouse = [0, 0, 0, 0];

let target = null;
let frame = 0;
let start = performance.now();
let previous = start;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width === width && canvas.height === height && target) return;

  canvas.width = width;
  canvas.height = height;
  if (target) {
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.texture);
  }
  target = createTarget(width, height);
}

function setCommonUniforms(pass, now, delta) {
  gl.useProgram(pass.program);
  gl.uniform3f(pass.uniforms.iResolution, canvas.width, canvas.height, 1);
  gl.uniform1f(pass.uniforms.iTime, now);
  gl.uniform1f(pass.uniforms.iTimeDelta, delta);
  gl.uniform1i(pass.uniforms.iFrame, frame);
  gl.uniform4fv(pass.uniforms.iMouse, mouse);

  const date = new Date();
  const seconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
  gl.uniform4f(pass.uniforms.iDate, date.getFullYear(), date.getMonth() + 1, date.getDate(), seconds);
  gl.uniform3fv(pass.uniforms.iChannelResolution, new Float32Array([
    canvas.width, canvas.height, 1,
    1024, 1024, 1,
    0, 0, 0,
    0, 0, 0,
  ]));
}

function bindTexture(unit, texture, uniform) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(uniform, unit);
}

function render(timeMs) {
  resize();
  const now = (timeMs - start) / 1000;
  const delta = Math.min(0.1, (timeMs - previous) / 1000);
  previous = timeMs;

  gl.bindVertexArray(vao);
  gl.disable(gl.BLEND);

  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
  setCommonUniforms(scene, now, delta);
  bindTexture(0, noiseTexture, scene.uniforms.iChannel0);
  bindTexture(1, washTexture, scene.uniforms.iChannel1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  setCommonUniforms(post, now, delta);
  bindTexture(0, target.texture, post.uniforms.iChannel0);
  bindTexture(1, washTexture, post.uniforms.iChannel1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  frame += 1;
  requestAnimationFrame(render);
}

function updateMouse(event, setClickOrigin = false) {
  const rect = canvas.getBoundingClientRect();
  mouse[0] = (event.clientX - rect.left) * (canvas.width / rect.width);
  mouse[1] = canvas.height - (event.clientY - rect.top) * (canvas.height / rect.height);
  if (setClickOrigin) {
    mouse[2] = mouse[0];
    mouse[3] = mouse[1];
  }
}

canvas.addEventListener("pointerdown", (event) => {
  updateMouse(event, true);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.buttons === 0) return;
  updateMouse(event);
});

window.addEventListener("resize", resize);
document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle("shader-fullscreen", document.fullscreenElement === shaderCard);
  resize();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "F11" || event.key === "f" || event.key === "F") {
    event.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      shaderCard.requestFullscreen().catch(() => {});
    }
  }
});
window.addEventListener("pointerdown", startSoundtrack, { once: true });
window.addEventListener("keydown", startSoundtrack, { once: true });
startSoundtrack();
requestAnimationFrame(render);
