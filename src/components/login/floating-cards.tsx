"use client";

import { motion } from "framer-motion";

/** Cards decorativos que sugerem o produto (tarefas em movimento) sem mostrar UI real. */
export function FloatingCards() {
  // Cada card tem: posição (top/left), rotação, fase do float infinito, status color
  const cards = [
    { top: "12%",  left: "8%",  rotate: -3, delay: 0.4, phase: 0,   color: "#FDAB3D", w: 230 },
    { top: "30%",  left: "55%", rotate: 2,  delay: 0.55, phase: 1.5, color: "#00C875", w: 200 },
    { top: "60%",  left: "12%", rotate: -1, delay: 0.7, phase: 3,   color: "#579BFC", w: 250 },
    { top: "72%",  left: "58%", rotate: 4,  delay: 0.85, phase: 4.5, color: "#E2445C", w: 210 },
  ];

  return (
    <>
      {cards.map((c, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="floating-card"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 0.14, y: 0 }}
          transition={{ duration: 0.6, delay: c.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: c.top,
            left: c.left,
            width: c.w,
            transform: `rotate(${c.rotate}deg)`,
            pointerEvents: "none",
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0, 6, 0] }}
            transition={{
              duration: 5 + (i % 2),
              repeat: Infinity,
              ease: "easeInOut",
              delay: c.phase,
            }}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2)",
            }}
          >
            {/* "linha de título" */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
              <span style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.5)" }} />
              <span style={{ width: 24, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.25)" }} />
            </div>
            {/* "barra de progresso" */}
            <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
              <div style={{ width: `${50 + i * 12}%`, height: "100%", background: c.color, borderRadius: 4 }} />
            </div>
          </motion.div>
        </motion.div>
      ))}

      <style>{`
        @media (max-width: 768px) {
          .floating-card { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-card { animation: none !important; }
        }
      `}</style>
    </>
  );
}
