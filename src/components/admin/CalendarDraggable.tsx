"use client";

import { useState, type ReactNode } from "react";

/**
 * Makes a calendar card draggable — carries the content item's id so a
 * CalendarDropZone can move it on drop. Native HTML5 drag (mouse/trackpad); the
 * per-card day <select> / date picker remain the keyboard- and touch-accessible
 * way to move an item, so this is a pure enhancement.
 */
export function CalendarDraggable({ itemId, children }: { itemId: string; children: ReactNode }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", itemId);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`cursor-grab active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
    >
      {children}
    </div>
  );
}
