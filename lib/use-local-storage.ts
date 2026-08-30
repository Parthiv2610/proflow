"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_PREFIX = "proflow-"

/**
 * Like useState, but persists the value to localStorage.
 * Falls back to `initialValue` if localStorage is unavailable (SSR, private browsing, etc.)
 * or if the stored value cannot be parsed.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key)
      if (raw !== null) {
        return JSON.parse(raw) as T
      }
    } catch {
      // localStorage unavailable or data corrupted — use initialValue
    }
    return initialValue
  })

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (action) => {
      setStored((prev) => {
        const next = typeof action === "function" ? (action as (prev: T) => T)(prev) : action
        try {
          localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(next))
        } catch {
          // quota exceeded or unavailable — silently ignore
        }
        return next
      })
    },
    [key],
  )

  // Listen for LAN sync external updates — re-read from localStorage when data changes externally
  // (dispatched by auto-sync pull in lan-sync.ts)
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key)
        if (raw !== null) {
          setStored(JSON.parse(raw) as T)
        }
      } catch {}
    }
    window.addEventListener("proflow:synced", handler)
    return () => window.removeEventListener("proflow:synced", handler)
  }, [key])

  return [stored, setValue]
}
