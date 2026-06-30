"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./ui";
import { apiFetch, formatDateTime } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  type: string;
  status?: string;
};

type Event = {
  id: string;
  title: string;
  startAt: string;
  type: string;
};

export function NotificationCenter() {
  const toast = useToast();
  const playedRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create a simple beep sound using Web Audio API
  function playSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880; // A5

      gain.gain.value = 0.3;

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;

      const duration = 0.6;

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      oscillator.start();

      setTimeout(() => {
        gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        setTimeout(() => oscillator.stop(), duration * 1000);
      }, 120);
    } catch {
      // Fallback: silent
    }
  }

  async function checkForReminders() {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 15 * 60 * 1000); // next 15 minutes

      // Check tasks
      const tasksRes = await apiFetch<{ items: Task[] }>("/api/tasks?mine=1");
      const dueTasks = tasksRes.items.filter((t) => {
        if (!t.dueDate || t.status === "done") return false;
        const due = new Date(t.dueDate);
        return due >= now && due <= soon;
      });

      dueTasks.forEach((task) => {
        const key = `task-${task.id}`;
        if (playedRef.current.has(key)) return;
        playedRef.current.add(key);

        toast({
          type: "info",
          title: "Task due soon",
          message: task.title,
        });
        playSound();
      });

      // Check calendar events
      const eventsRes = await apiFetch<{ items: Event[] }>("/api/events");
      const upcomingEvents = eventsRes.items.filter((e) => {
        const start = new Date(e.startAt);
        return start >= now && start <= soon;
      });

      upcomingEvents.forEach((ev) => {
        const key = `event-${ev.id}`;
        if (playedRef.current.has(key)) return;
        playedRef.current.add(key);

        toast({
          type: "info",
          title: "Upcoming event",
          message: `${ev.title} at ${formatDateTime(ev.startAt)}`,
        });
        playSound();
      });
    } catch {
      // Silently ignore (user might be logged out)
    }
  }

  useEffect(() => {
    // Run once on mount
    checkForReminders();

    // Check every 5 minutes
    const interval = setInterval(checkForReminders, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
