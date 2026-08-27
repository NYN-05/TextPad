import { useState, useCallback, useEffect } from "react";
import { generateUUID } from "../crypto/uuid";

export interface Activity {
  id: string;
  type: "created" | "renamed" | "imported" | "backup" | "sync" | "restore";
  label: string;
  timestamp: number;
}

const STORAGE_KEY = "textpad-activity";
const MAX_ITEMS = 20;

function load(): Activity[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function useActivityLog() {
  const [activities, setActivities] = useState<Activity[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  }, [activities]);

  const addActivity = useCallback((type: Activity["type"], label: string) => {
    const entry: Activity = {
      id: generateUUID(),
      type,
      label,
      timestamp: Date.now(),
    };
    setActivities(prev => [entry, ...prev].slice(0, MAX_ITEMS));
  }, []);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  return { activities, addActivity, clearActivities };
}
