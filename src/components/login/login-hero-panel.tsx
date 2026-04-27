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
          "linear-gradient(135deg, #46347F 0%, #36286a 50%, #2d1f5c 100%)",
        color: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "48px",
      }}
    >
      {/* Logo top-left */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <img
          src="/logos/ordum-wordmark-branco.svg"
          alt="Ordum"
          style={{ height: 40, width: "auto", display: "block" }}
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
          fontFamily: "var(--font-inter), Inter, sans-serif",
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
          fontFamily: "var(--font-inter), Inter, sans-serif",
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
