"use client";

import { useEffect, useRef, useState } from "react";

// Zodiac constellation patterns — simplified star coordinates (normalized 0-1)
const CONSTELLATIONS = [
  // Aries (Mesha)
  { stars: [[0.1, 0.2], [0.15, 0.18], [0.22, 0.15], [0.28, 0.17], [0.32, 0.22]], connections: [[0,1],[1,2],[2,3],[3,4]] },
  // Taurus (Vrishabha)
  { stars: [[0.7, 0.1], [0.73, 0.14], [0.76, 0.12], [0.74, 0.18], [0.71, 0.2], [0.68, 0.17]], connections: [[0,1],[1,2],[1,3],[3,4],[4,5]] },
  // Gemini (Mithuna)
  { stars: [[0.4, 0.7], [0.42, 0.74], [0.44, 0.78], [0.47, 0.72], [0.49, 0.76], [0.51, 0.8]], connections: [[0,1],[1,2],[0,3],[3,4],[4,5]] },
  // Cancer (Karka)
  { stars: [[0.85, 0.4], [0.88, 0.43], [0.87, 0.47], [0.84, 0.45], [0.86, 0.5]], connections: [[0,1],[1,2],[2,3],[3,0],[2,4]] },
  // Leo (Simha)
  { stars: [[0.05, 0.5], [0.08, 0.48], [0.12, 0.5], [0.15, 0.53], [0.12, 0.56], [0.08, 0.55], [0.18, 0.5]], connections: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[2,6]] },
  // Scorpio (Vrischika)
  { stars: [[0.55, 0.3], [0.58, 0.33], [0.61, 0.35], [0.64, 0.33], [0.67, 0.35], [0.69, 0.38], [0.71, 0.42], [0.69, 0.45]], connections: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  // Sagittarius (Dhanu)
  { stars: [[0.2, 0.85], [0.23, 0.82], [0.26, 0.84], [0.24, 0.88], [0.28, 0.86], [0.31, 0.83]], connections: [[0,1],[1,2],[1,3],[2,4],[4,5]] },
  // Aquarius (Kumbha)
  { stars: [[0.75, 0.7], [0.78, 0.68], [0.81, 0.7], [0.84, 0.68], [0.82, 0.73], [0.79, 0.75]], connections: [[0,1],[1,2],[2,3],[2,4],[4,5]] },
  // Pisces (Meena)
  { stars: [[0.45, 0.45], [0.48, 0.42], [0.51, 0.44], [0.49, 0.48], [0.52, 0.5], [0.55, 0.47], [0.53, 0.43]], connections: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,1]] },
];

export default function ConstellationBackground() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const isVisibleRef = useRef(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap pixel ratio
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * pixelRatio;
      canvas.height = rect.height * pixelRatio;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.scale(pixelRatio, pixelRatio);
    }

    resize();
    window.addEventListener("resize", resize);

    // Intersection Observer — pause when not visible
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(canvas);

    const startTime = performance.now();

    function render() {
      if (!isVisibleRef.current) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const elapsed = (performance.now() - startTime) / 1000;
      const w = canvas.width / pixelRatio;
      const h = canvas.height / pixelRatio;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Draw each constellation
      CONSTELLATIONS.forEach((constellation, ci) => {
        const { stars, connections } = constellation;

        // Gentle floating animation per constellation
        const offsetX = Math.sin(elapsed * 0.3 + ci * 2) * 3;
        const offsetY = Math.cos(elapsed * 0.2 + ci * 1.5) * 3;

        // Draw connection lines
        connections.forEach(([a, b]) => {
          const x1 = stars[a][0] * w + offsetX;
          const y1 = stars[a][1] * h + offsetY;
          const x2 = stars[b][0] * w + offsetX;
          const y2 = stars[b][1] * h + offsetY;

          // Pulsing line opacity
          const pulse = 0.15 + 0.1 * Math.sin(elapsed * 0.5 + ci + a);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(139, 92, 246, ${pulse})`; // Purple lines
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });

        // Draw stars (nodes)
        stars.forEach(([sx, sy], si) => {
          const x = sx * w + offsetX;
          const y = sy * h + offsetY;

          // Twinkle effect
          const twinkle = 0.4 + 0.6 * Math.sin(elapsed * (1 + si * 0.3) + ci * 3 + si);
          const radius = 1.5 + twinkle * 1;

          // Star glow
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
          gradient.addColorStop(0, `rgba(167, 139, 250, ${twinkle * 0.8})`);
          gradient.addColorStop(0.5, `rgba(139, 92, 246, ${twinkle * 0.3})`);
          gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

          ctx.beginPath();
          ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // Star core
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.9})`;
          ctx.fill();
        });
      });

      // Sparse background dust (very faint random dots)
      for (let i = 0; i < 40; i++) {
        const x = ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1 * w;
        const y = ((Math.sin(i * 269.5 + 183.3) * 43758.5453) % 1 + 1) % 1 * h;
        const twinkle = 0.2 + 0.3 * Math.sin(elapsed * 0.8 + i * 7);
        ctx.beginPath();
        ctx.arc(x, y, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 200, 255, ${twinkle})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1, opacity: 0.7 }}
      aria-hidden="true"
    />
  );
}
