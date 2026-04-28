"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ContentSlide } from "@/lib/types";

interface Props {
  contentItemId: string;
  slides: ContentSlide[];
  onChange: () => void | Promise<unknown>;
}

export function CarouselSlideEditor({ contentItemId, slides, onChange }: Props) {
  const [order, setOrder] = useState<ContentSlide[]>(slides);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => { setOrder(slides); }, [slides]);

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((s) => s.id === active.id);
    const newIdx = order.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    await api.reorderContentSlides(next.map((s) => s.id));
    onChange();
  };

  const updateSlide = async (slideId: string, patch: Partial<Pick<ContentSlide, "title" | "body" | "notes">>) => {
    setOrder((prev) => prev.map((s) => s.id === slideId ? { ...s, ...patch } : s));
    await api.updateContentSlide(slideId, patch);
  };

  const addSlide = async () => {
    await api.createContentSlide(contentItemId);
    onChange();
  };

  const removeSlide = async (slideId: string) => {
    await api.deleteContentSlide(slideId);
    setConfirmDeleteId(null);
    onChange();
  };

  return (
    <section aria-label="Slides do carrossel" style={{ marginTop: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 }}>
          Slides ({order.length})
        </h3>
        <button onClick={addSlide}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8,
            background: "var(--primary)", color: "#fff", border: "none",
            cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          }}>
          <Plus size={14} aria-hidden /> Adicionar slide
        </button>
      </header>

      {order.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Sem slides. Clique em <strong>Adicionar slide</strong>.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {order.map((slide, idx) => (
                <SortableSlide
                  key={slide.id}
                  slide={slide}
                  index={idx}
                  onUpdate={(patch) => updateSlide(slide.id, patch)}
                  onRemove={() => setConfirmDeleteId(slide.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {confirmDeleteId && (
        <div role="dialog" aria-modal="true" style={overlay} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--card-border)",
            borderRadius: 12, padding: 20, width: "min(380px, 92vw)",
          }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Excluir slide?</h4>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
              O conteúdo do slide será perdido.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDeleteId(null)} style={smallBtn}>Cancelar</button>
              <button onClick={() => removeSlide(confirmDeleteId)}
                style={{ ...smallBtn, background: "#E2445C", color: "#fff", border: "none" }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SortableSlide({
  slide, index, onUpdate, onRemove,
}: {
  slide: ContentSlide;
  index: number;
  onUpdate: (patch: Partial<Pick<ContentSlide, "title" | "body" | "notes">>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={{
      ...style,
      border: "1px solid var(--card-border)", borderRadius: 10,
      padding: 14, background: "var(--surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span {...attributes} {...listeners}
          style={{ cursor: "grab", color: "var(--text-muted)", padding: "4px 8px", fontSize: 18 }}
          title="Arrastar pra reordenar">⠿</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>Slide {index + 1}</span>
        <button onClick={onRemove} aria-label="Excluir slide"
          style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" }}>
          <Trash2 size={14} />
        </button>
      </div>
      <input
        defaultValue={slide.title}
        onBlur={(e) => { if (e.target.value !== slide.title) onUpdate({ title: e.target.value }); }}
        placeholder="Título do slide..."
        style={{
          width: "100%", padding: "6px 0", marginBottom: 8,
          background: "transparent", border: "none", borderBottom: "1px solid transparent",
          color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", fontFamily: "inherit",
        }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--primary)")}
      />
      <textarea
        defaultValue={slide.body}
        onBlur={(e) => { if (e.target.value !== slide.body) onUpdate({ body: e.target.value }); }}
        placeholder="Conteúdo do slide..."
        rows={3}
        style={{
          width: "100%", padding: "8px 10px",
          background: "var(--input-bg)", border: "1px solid var(--input-border)",
          color: "var(--text)", fontSize: 13, lineHeight: 1.5,
          outline: "none", fontFamily: "inherit", resize: "vertical", borderRadius: 6,
        }}
      />
      <textarea
        defaultValue={slide.notes}
        onBlur={(e) => { if (e.target.value !== slide.notes) onUpdate({ notes: e.target.value }); }}
        placeholder="Notas visuais (pra Ariel/designer)..."
        rows={2}
        style={{
          width: "100%", padding: "8px 10px", marginTop: 8,
          background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          border: "1px dashed var(--card-border)",
          color: "var(--text)", fontSize: 12, lineHeight: 1.4,
          outline: "none", fontFamily: "inherit", resize: "vertical", borderRadius: 6,
        }}
      />
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "var(--overlay)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
};

const smallBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8,
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit",
};
