import { z } from "zod";

/**
 * Shared between onboarding.ts and settings.ts (both write these same
 * columns). Deliberately NOT defined inside either "use server" file: a
 * "use server" file may only export async functions -- exporting a Zod
 * schema object alongside the actions crashes the whole module at
 * evaluation time ("A 'use server' file can only export async functions,
 * found object"), taking down every page that transitively imports it.
 */
export const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please choose a valid time.");

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a name.")
  .max(40, "Keep it under 40 characters.");
