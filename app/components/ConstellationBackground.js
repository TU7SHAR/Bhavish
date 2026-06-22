"use client";

import { useEffect, useRef, useState } from "react";

// Lightweight constellation shader — raw WebGL, no Three.js dependency
// Implements: hardware triage, intersection observer kill switch, capped pixel ratio

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;

  // Simple hash for pseudo-random
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Simplex-like noise for twinkle
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 color = vec3(0.039, 0.039, 0.059); // #0a0a0f background

    // Star layer 1 — dense, small, faint
    for (float i = 0.0; i < 60.0; i++) {
      vec2 starPos = vec2(hash(vec2(i, i * 1.7)), hash(vec2(i * 2.3, i)));
      float dist = length(uv - starPos);
      float twinkle = 0.3 + 0.7 * sin(u_time * (0.5 + hash(vec2(i, 0.0)) * 2.0) + i);
      float brightness = smoothstep(0.003, 0.0, dist) * twinkle * 0.6;
      color += vec3(0.65, 0.55, 0.98) * brightness; // Purple tint
    }

    // Star layer 2 — sparse, brighter, gold accent
    for (float i = 0.0; i < 15.0; i++) {
      vec2 starPos = vec2(hash(vec2(i * 3.1, i * 0.7)), hash(vec2(i * 1.9, i * 2.8)));
      float dist = length(uv - starPos);
      float twinkle = 0.5 + 0.5 * sin(u_time * (0.3 + hash(vec2(i, 1.0))) + i * 4.0);
      float brightness = smoothstep(0.005, 0.0, dist) * twinkle;
      color += vec3(0.96, 0.62, 0.04) * brightness * 0.7; // Gold accent
    }

    // Subtle nebula glow
    float nebula = noise(uv * 3.0 + u_time * 0.02);
    color += vec3(0.34, 0.22, 0.6) * nebula * 0.04;

    // Vignette
    float vignette = 1.0 - length((uv - 0.5) * 1.3);
    color *= smoothstep(0.0, 0.7, vignette);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Static fallback for low-end devices (CSS-only stars)
function StaticFallback() {
  return (
    <div className="absolute inset-0 stars-bg opacity-40" aria-hidden="true" />
  );
}

export default function ConstellationBackground() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const glRef = useRef(null);
  const isVisibleRef = useRef(true);
  const [useShader, setUseShader] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Hardware Triage: only enable shader on capable devices
    const cores = navigator.hardwareConcurrency || 2;
    const isDesktop = window.innerWidth > 768;
    const isHighEnd = cores >= 4 || isDesktop;

    // Also check if WebGL is available
    let webglAvailable = false;
    try {
      const testCanvas = document.createElement("canvas");
      webglAvailable = !!(testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl"));
    } catch (e) {
      webglAvailable = false;
    }

    setUseShader(isHighEnd && webglAvailable);
  }, []);

  useEffect(() => {
    if (!useShader || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // Cap pixel ratio to 1.5 max (saves massive GPU overhead)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = canvas.clientWidth * pixelRatio;
    const height = canvas.clientHeight * pixelRatio;
    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) { setUseShader(false); return; }
    glRef.current = gl;

    // Compile shaders
    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) { setUseShader(false); return; }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Program link error");
      setUseShader(false);
      return;
    }

    gl.useProgram(program);

    // Full-screen quad
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resLoc = gl.getUniformLocation(program, "u_resolution");

    gl.uniform2f(resLoc, width, height);

    const startTime = performance.now();

    function render() {
      if (!isVisibleRef.current) {
        animFrameRef.current = requestAnimationFrame(render);
        return; // Skip rendering when not visible (Intersection Observer kill switch)
      }

      const elapsed = (performance.now() - startTime) / 1000;
      gl.uniform1f(timeLoc, elapsed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animFrameRef.current = requestAnimationFrame(render);
    }

    render();

    // Intersection Observer: pause when hero scrolls out of view
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(canvas);

    // Cleanup
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [useShader]);

  // Handle resize
  useEffect(() => {
    if (!useShader) return;

    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas || !glRef.current) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = canvas.clientWidth * pixelRatio;
      canvas.height = canvas.clientHeight * pixelRatio;
      glRef.current.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [useShader]);

  if (!mounted) return <StaticFallback />;
  if (!useShader) return <StaticFallback />;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
