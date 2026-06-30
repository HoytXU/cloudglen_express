import {
  createImageTexture,
  createProgram,
  loadImage,
  loadText,
  reloadOnContextRestore,
  resizeCanvas,
  showRenderError,
  webglContextOptions,
} from "./webgl-utils.js";
import { getControlText } from "./i18n.js?v=20260630-1";

const canvas = document.querySelector("#gl");
const shaderCard = document.querySelector(".shader-card");
const soundToggle = document.querySelector("#sound-toggle");
const fullscreenToggle = document.querySelector("#fullscreen-toggle");
const soundtrack = new Audio("./assets/soundtrack.mp3");
soundtrack.loop = true;
soundtrack.preload = "metadata";

let soundEnabled = false;

function updateSoundToggle() {
  soundToggle.textContent = getControlText("music", { enabled: soundEnabled });
}

function updateFullscreenToggle() {
  const active = document.fullscreenElement === shaderCard;
  fullscreenToggle.textContent = getControlText("fullscreen", { active });
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    shaderCard.requestFullscreen().catch(() => {});
  }
}

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  updateSoundToggle();
  if (soundEnabled) {
    soundtrack.play().catch(() => {});
  } else {
    soundtrack.pause();
  }
});

fullscreenToggle.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  const active = document.fullscreenElement === shaderCard;
  document.body.classList.toggle("shader-fullscreen", active);
  updateFullscreenToggle();
});
document.addEventListener("languagechange", () => {
  updateSoundToggle();
  updateFullscreenToggle();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "F11" || event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFullscreen();
  }
});

updateSoundToggle();
updateFullscreenToggle();

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

const uniformNames = [
  "iResolution",
  "iTime",
  "iTimeDelta",
  "iFrame",
  "iMouse",
  "iDate",
  "iChannel0",
  "iChannel1",
  "iChannelResolution",
];

function wrapShadertoy(source) {
  return `${shaderHeader}\n${source}\n
void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  outColor = color;
}`;
}

function createTexture(gl, width, height, data = null, filter = gl.LINEAR, wrap = gl.REPEAT) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return texture;
}

function createTarget(gl, width, height) {
  const texture = createTexture(gl, width, height, null, gl.LINEAR, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error("Framebuffer is incomplete");
  }
  return { texture, framebuffer, width, height };
}

async function startRenderer() {
  const gl = canvas.getContext("webgl2", {
    ...webglContextOptions,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL2 is not available");

  reloadOnContextRestore(canvas);

  const [commonText, sceneText, postText, noiseImage] = await Promise.all([
    loadText("./shaders/common.glsl"),
    loadText("./shaders/scene.glsl"),
    loadText("./shaders/post.glsl"),
    loadImage("./assets/blue-noise.png"),
  ]);

  const scene = createProgram(gl, wrapShadertoy(`${commonText}\n${sceneText}`), uniformNames);
  const post = createProgram(gl, wrapShadertoy(`${commonText}\n${postText}`), uniformNames);
  const noiseTexture = createImageTexture(gl, noiseImage);
  const vao = gl.createVertexArray();
  const mouse = [0, 0, 0, 0];
  const channelResolutions = new Float32Array([
    0, 0, 1,
    1024, 1024, 1,
    0, 0, 0,
    0, 0, 0,
  ]);

  let target = null;
  let frame = 0;
  let animationFrame = null;
  const start = performance.now();
  let previous = start;

  function resize() {
    const { width, height, changed } = resizeCanvas(canvas);
    if (!changed && target) return;
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    target = createTarget(gl, width, height);
    channelResolutions[0] = width;
    channelResolutions[1] = height;
  }

  function setCommonUniforms(pass, now, delta) {
    gl.useProgram(pass.program);
    gl.uniform3f(pass.uniforms.iResolution, canvas.width, canvas.height, 1);
    gl.uniform1f(pass.uniforms.iTime, now);
    gl.uniform1f(pass.uniforms.iTimeDelta, delta);
    gl.uniform1i(pass.uniforms.iFrame, frame);
    gl.uniform4fv(pass.uniforms.iMouse, mouse);

    const date = new Date();
    const seconds = date.getHours() * 3600 + date.getMinutes() * 60
      + date.getSeconds() + date.getMilliseconds() / 1000;
    gl.uniform4f(
      pass.uniforms.iDate,
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      seconds,
    );
    gl.uniform3fv(pass.uniforms.iChannelResolution, channelResolutions);
  }

  function bindTexture(unit, texture, uniform) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniform, unit);
  }

  function scheduleRender() {
    if (animationFrame === null && !document.hidden) {
      animationFrame = requestAnimationFrame(render);
    }
  }

  function render(timeMs) {
    animationFrame = null;
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    setCommonUniforms(post, now, delta);
    bindTexture(0, target.texture, post.uniforms.iChannel0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    frame += 1;
    scheduleRender();
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

  canvas.addEventListener("pointerdown", (event) => updateMouse(event, true));
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons !== 0) updateMouse(event);
  });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else {
      previous = performance.now();
      scheduleRender();
    }
  });
  canvas.addEventListener("webglcontextlost", () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    gl.deleteTexture(noiseTexture);
    gl.deleteProgram(scene.program);
    gl.deleteProgram(post.program);
    gl.deleteVertexArray(vao);
  });

  scheduleRender();
}

startRenderer().catch((error) => showRenderError(shaderCard, error));
