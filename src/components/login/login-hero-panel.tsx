"use client";

import { motion } from "framer-motion";
import { FloatingCards } from "./floating-cards";

const headlineLines = ["Tarefas em ordem,", "times em movimento."];

export function LoginHeroPanel() {
  return (
    <aside
      className="login-hero"
      aria-labelledby="login-headline"
      style={{
        position: "relative",
        flex: 1,
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #15708C 0%, #0F4C5C 55%, #0a3744 100%)",
        color: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "48px",
      }}
    >
      {/* Starfield (céu estrelado) */}
      <div className="login-stars" aria-hidden />
      <div className="login-stars login-stars--2" aria-hidden />
      <style>{`
        .login-stars {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-repeat: repeat; background-size: 220px 220px;
          background-image:
            radial-gradient(1px 1px at 25px 35px, rgba(255,255,255,.9), transparent),
            radial-gradient(1px 1px at 90px 120px, rgba(255,255,255,.5), transparent),
            radial-gradient(1.5px 1.5px at 160px 70px, rgba(255,255,255,.7), transparent),
            radial-gradient(1px 1px at 200px 180px, rgba(255,255,255,.4), transparent),
            radial-gradient(1px 1px at 60px 200px, rgba(255,255,255,.6), transparent);
          animation: stars-twinkle 4s ease-in-out infinite;
        }
        .login-stars--2 {
          background-size: 320px 320px; opacity: .85;
          background-image:
            radial-gradient(1.4px 1.4px at 130px 50px, rgba(224,122,82,.6), transparent),
            radial-gradient(1.5px 1.5px at 40px 150px, rgba(255,255,255,.6), transparent),
            radial-gradient(1px 1px at 250px 210px, rgba(255,255,255,.35), transparent),
            radial-gradient(1px 1px at 180px 110px, rgba(255,255,255,.4), transparent);
          animation: stars-twinkle 6.5s ease-in-out infinite reverse;
        }
        @keyframes stars-twinkle { 0%,100%{opacity:.55} 50%{opacity:1} }
        @media (prefers-reduced-motion: reduce){ .login-stars,.login-stars--2{ animation:none } }
      `}</style>

      {/* Logo top-left */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <img
          src="/logos/clareza-lockup-cream.svg"
          alt="Clareza"
          style={{ height: 44, width: "auto", display: "block" }}
        />
      </div>

      {/* Cards flutuantes */}
      <FloatingCards />

      {/* Headline central */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative", zIndex: 2 }}>
        <h1
          id="login-headline"
          aria-label="Tarefas em ordem, times em movimento."
          style={{
            fontFamily: "var(--font-poppins), Poppins, sans-serif",
            fontWeight: 600,
            fontSize: "clamp(2rem, 4.6vw, 4rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#fff",
            margin: 0,
            maxWidth: "16ch",
          }}
        >
          {headlineLines.map((line, i) => (
            <motion.span
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.12, ease: "easeOut" }}
              style={{ display: "block" }}
              aria-hidden
            >
              {line}
            </motion.span>
          ))}
        </h1>
      </div>

      {/* Subheadline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.78 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={{
          fontFamily: "var(--font-figtree), Figtree, sans-serif",
          fontWeight: 400,
          fontSize: 18,
          margin: "0 0 24px",
          maxWidth: "32ch",
          position: "relative",
          zIndex: 2,
        }}
      >
        A plataforma de gestão de tarefas da PERCI.
      </motion.p>

      {/* Footer */}
      <footer
        style={{
          fontFamily: "var(--font-figtree), Figtree, sans-serif",
          fontSize: 13,
          opacity: 0.5,
          position: "relative",
          zIndex: 2,
        }}
      >
        © 2026 NexIA Lab
      </footer>

      {/* Responsivo */}
      <style>{`
        @media (max-width: 1023px) {
          .login-hero {
            min-height: 40vh !important;
            padding: 24px !important;
          }
          .login-hero h1 {
            font-size: clamp(1.6rem, 4vw, 2.4rem) !important;
          }
          .login-hero p { font-size: 14px !important; margin-bottom: 12px !important; }
        }
        @media (max-width: 767px) {
          .login-hero {
            min-height: 28vh !important;
            padding: 20px !important;
          }
          .login-hero h1 {
            font-size: clamp(1.4rem, 5vw, 2rem) !important;
            max-width: none !important;
          }
        }
      `}</style>
    </aside>
  );
}
