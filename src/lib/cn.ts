// src/lib/cn.ts
// Minimal className combiner used by your UI components.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
