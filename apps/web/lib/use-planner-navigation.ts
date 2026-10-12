"use client";
import { useEffect, useState } from "react";
import { civilDate } from "@timely/contracts";
import type { PlannerMode } from "@timely/domain";
/** Account-scoped browser navigation, restored before writing the current view. */
export function usePlannerNavigation(ownerId: string, initialDay: string) {
  const [selected, setSelected] = useState(initialDay);
  const [mode, setMode] = useState<PlannerMode>("Day");
  const [tab, setTab] = useState("Planner");
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const url = new URL(window.location.href);
      let stored: {
        date?: string;
        mode?: string;
        tab?: string;
      } = {};
      try {
        stored = JSON.parse(
          localStorage.getItem(`timely-navigation:${ownerId}`) ?? "{}",
        );
      } catch {
        /* Ignore invalid navigation only. */
      }
      const day = url.searchParams.get("date") ?? stored.date;
      if (civilDate.safeParse(day).success) setSelected(day!);
      const view = url.searchParams.get("mode") ?? stored.mode;
      if (view === "Day" || view === "Week" || view === "Month") setMode(view);
      const destination = url.searchParams.get("tab") ?? stored.tab;
      if (
        ["Planner", "Review", "Search", "Settings"].includes(destination ?? "")
      )
        setTab(destination!);
      setNavigationReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [ownerId]);
  useEffect(() => {
    if (!navigationReady) return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", selected);
    url.searchParams.set("mode", mode);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
    localStorage.setItem(
      `timely-navigation:${ownerId}`,
      JSON.stringify({ date: selected, mode, tab }),
    );
  }, [navigationReady, selected, mode, tab, ownerId]);
  return { selected, setSelected, mode, setMode, tab, setTab };
}
