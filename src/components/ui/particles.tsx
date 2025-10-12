"use client";

import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    particlesJS: (tagId: string, params: object) => void;
  }
}

const ParticleBackground: React.FC = () => {
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js";
    script.async = true;

    script.onload = () => {
      if (window.particlesJS && particlesRef.current) {
        window.particlesJS("particles-js", {
          particles: {
            number: { value: 120, density: { enable: true, value_area: 1200 } }, // 🌌 more "stars"
            color: { value: ["#ffffff", "#f0f0f0", "#d0d0d0", "#a0a0a0", "#707070", "#404040", "#202020", "#000000"] }, // ⚫ white to black gradient colors
            shape: { type: "circle" },
            opacity: {
              value: 0.9,
              random: true,
              anim: { enable: true, speed: 0.8, opacity_min: 0.2, sync: false },
            },
            size: {
              value: 2.5,
              random: true,
              anim: { enable: true, speed: 2, size_min: 0.5, sync: false },
            },
            line_linked: {
              enable: true,
              distance: 150, // 🔹 constellation-like linking
              color: "#ffffff",
              opacity: 0.4,
              width: 0.8,
            },
            move: {
              enable: true,
              speed: 1.5, // 🌠 slow drifting stars
              direction: "none",
              random: true,
              straight: false,
              out_mode: "out",
            },
          },
          interactivity: {
            detect_on: "window",
            events: {
              onhover: { enable: true, mode: "grab" },
              onclick: { enable: false, mode: "push" },
              resize: true,
            },
            modes: {
              grab: {
                distance: 250,
                line_linked: { opacity:0.5}, // 🌟 lines brighten when hovered
              },
              repulse: { distance: 200, duration: 0.6 },
              push: { particles_nb: 4 },
            },
          },
          retina_detect: true,
        });
      }
    };

    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <div
      id="particles-js"
      ref={particlesRef}
      className="fixed inset-0 -z-10"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        background: "radial-gradient(ellipse at bottom, #0d1b2a1f 0%, #000 100%)", // 🌌 galaxy background
      }}
    />
  );
};

export default ParticleBackground;
