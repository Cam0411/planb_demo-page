import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseTime(input: any): number {
  if (typeof input === "number") return input;

  if (typeof input === "string" && input.includes(":")) {
    const parts = input.split(":").map(Number);
    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }
  }

  return Number(input) || 0;
}

export function formatTime(sec: any): string {
  const totalSeconds = parseTime(sec);
  if (!totalSeconds && totalSeconds !== 0 || isNaN(totalSeconds)) return "0:00";
  
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);

  return `${m}:${s.toString().padStart(2, "0")}`;
}
