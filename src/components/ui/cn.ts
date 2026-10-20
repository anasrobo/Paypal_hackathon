/**
 * Class name joining.
 *
 * `clsx` for conditionals, `tailwind-merge` so a later utility wins over
 * an earlier one of the same kind. That ordering is what lets a component
 * accept `className` and still be overridable.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
