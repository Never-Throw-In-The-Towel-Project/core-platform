"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setContentItemDay, scheduleContentItem } from "@/lib/actions/contentCalendar";
import { initialRoutineState } from "@/lib/actions/routineState";

type DropTarget =
  | { type: "day"; day: number } // Week column (0 = Any day, 1–7 = Mon–Sun)
  | { type: "date"; date: string } // Month date cell (yyyy-mm-dd)
  | { type: "unschedule" }; // Month unscheduled-drafts panel

/**
 * A calendar drop target. On drop it reads the dragged item's id and moves it by
 * calling the SAME server actions the on-card controls use — setContentItemDay
 * (weekday) or scheduleContentItem (date / clear) — then refreshes so the moved
 * card re-renders in its new slot. Highlights while a card hovers over it.
 */
export function CalendarDropZone({
  target,
  className,
  activeClassName = "ring-2 ring-inset ring-brand-accent",
  children,
}: {
  target: DropTarget;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const itemId = e.dataTransfer.getData("text/plain");
    if (!itemId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("itemId", itemId);
      if (target.type === "day") {
        fd.set("day", target.day === 0 ? "" : String(target.day));
        await setContentItemDay(initialRoutineState, fd);
      } else {
        // date or unschedule both go through scheduleContentItem ("" clears it).
        fd.set("date", target.type === "date" ? target.date : "");
        await scheduleContentItem(initialRoutineState, fd);
      }
      router.refresh();
    });
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // Ignore leaving into a child element (avoids highlight flicker).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={handleDrop}
      className={`${className ?? ""} ${over ? activeClassName : ""} ${pending ? "opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}
