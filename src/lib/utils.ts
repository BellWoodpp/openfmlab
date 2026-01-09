import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    process.env.BASE_URL
  if (explicit) return explicit.replace(/\/+$/, "")

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  if (process.env.NODE_ENV === "development") return "http://localhost:3000"

  // Fallback for builds without a configured domain.
  return "https://www.voiceslab.ai"
}
