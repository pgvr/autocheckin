import { type CheckInFrequency } from "@prisma/client";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Get an object property using a string object notation
 * Example: const obj = {a: b: {c: "hi"}} => get(obj, "a.b.c") = "hi"
 * From here: https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_get
 */
export const get = (obj: any, path: string, defaultValue = undefined) => {
  const travel = (regexp: RegExp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce(
        (res, key) => (res !== null && res !== undefined ? res[key] : res),
        obj,
      );
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};

export const FrequencyText: Record<CheckInFrequency, string> = {
  WEEKLY: "Weekly-ish",
  BIWEEKLY: "Bi-weekly-ish",
  MONTHLY: "Monthly-ish",
};

export function getRandomNumberBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
