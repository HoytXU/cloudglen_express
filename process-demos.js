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
  composition: 6,
};

function createStudy(canvas, fragmentSource, noiseImage) {
  const gl = canvas.getContext("webgl2", webglContextOptions);
  if (!gl) {
    showRenderError(canvas.parentElement, new Error("WebGL2 is not available"));
    return null;
  }

  reloadOnContextRestore(canvas);
  const { program, uniforms } = createProgram(
    gl,
    fragmentSource,
    ["uResolution", "uTime", "uDebugMode", "iChannel0"],
  );
  return {
    canvas,
    gl,
    program,
    uniforms,
    texture: createImageTexture(gl, noiseImage),
    mode: modeByName[canvas.dataset.demo],
    vao: gl.createVertexArray(),
    visible: true,
  };
}

async function startDemos() {
  const canvases = [...document.querySelectorAll(".study-canvas")];
  const [commonSource, debugSource, noiseImage] = await Promise.all([
    loadText("./shaders/common.glsl"),
    loadText("./shaders/debug.glsl"),
    loadImage("./assets/blue-noise.png"),
  ]);
  const fragmentSource = `${fragmentHeader}\n${commonSource}\n${debugSource}`;
  const studies = canvases.map((canvas) => {
    try {
      return createStudy(canvas, fragmentSource, noiseImage);
    } catch (error) {
      showRenderError(canvas.parentElement, error);
      return null;
    }
  }).filter(Boolean);
  const studyByCanvas = new Map(studies.map((study) => [study.canvas, study]));

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const study = studyByCanvas.get(entry.target);
      if (study) study.visible = entry.isIntersecting;
    }
  });
  for (const study of studies) observer.observe(study.canvas);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const start = performance.now();
  let animationFrame = null;

  function scheduleRender() {
    if (animationFrame === null && !document.hidden) {
      animationFrame = requestAnimationFrame(render);
    }
  }

  function render(time) {
    animationFrame = null;
    const seconds = reduceMotion.matches ? 0 : (time - start) / 1000;

    for (const study of studies) {
      if (!study.visible || study.gl.isContextLost()) continue;
      const { canvas, gl, program, uniforms } = study;
      const { width, height } = resizeCanvas(canvas, "round");

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(study.vao);
      gl.uniform2f(uniforms.uResolution, width, height);
      gl.uniform1f(uniforms.uTime, seconds);
      gl.uniform1i(uniforms.uDebugMode, study.mode);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, study.texture);
      gl.uniform1i(uniforms.iChannel0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    scheduleRender();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
    } else {
      scheduleRender();
    }
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    observer.disconnect();
    for (const { gl, program, texture, vao } of studies) {
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    }
  });

  scheduleRender();
}

startDemos().catch((error) => {
  for (const canvas of document.querySelectorAll(".study-canvas")) {
    showRenderError(canvas.parentElement, error);
  }
});
