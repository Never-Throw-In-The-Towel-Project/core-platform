"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ContentTopic } from "@/types/database";

// Editing the member Library's topic taxonomy (content_topics). ntitt_admin only
// (RLS + the guard here). The slug is the stable filter key, so a rename only
// touches the label — the slug is set once, at create, and left alone so
// /content?topic=<slug> links and existing assignments never break.

export type TopicManageResult = { status: "success" } | { status: "error"; message: string };

const REVALIDATE = ["/admin/brain", "/content"];
function revalidate() {
  for (const p of REVALIDATE) revalidatePath(p);
}

/** A URL-safe slug from a label: lowercase, non-alphanumerics → single hyphens. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LabelSchema = z.string().trim().min(1, "Give the topic a name.").max(40, "Keep it under 40 characters.");
const IdSchema = z.string().uuid();

export async function createTopicAction(input: { label: string }): Promise<TopicManageResult> {
  await requireNtittAdmin();
  const parsed = LabelSchema.safeParse(input.label);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid name." };
  const label = parsed.data;
  const slug = slugify(label);
  if (!slug) return { status: "error", message: "That name has no letters or numbers to make a slug from." };

  const supabase = await createClient();
  // Append to the end of the current ordering.
  const { data: last } = await supabase
    .from("content_topics")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("content_topics").insert({ slug, label, sort_order: nextOrder });
  if (error) {
    // 23505 = unique_violation on the slug.
    if (error.code === "23505") return { status: "error", message: "A topic with that name already exists." };
    return { status: "error", message: "Couldn’t create the topic. Please try again." };
  }
  revalidate();
  return { status: "success" };
}

export async function renameTopicAction(input: { id: string; label: string }): Promise<TopicManageResult> {
  await requireNtittAdmin();
  if (!IdSchema.safeParse(input.id).success) return { status: "error", message: "Bad request." };
  const parsed = LabelSchema.safeParse(input.label);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid name." };

  const supabase = await createClient();
  const { error } = await supabase.from("content_topics").update({ label: parsed.data }).eq("id", input.id);
  if (error) return { status: "error", message: "Couldn’t rename the topic. Please try again." };
  revalidate();
  return { status: "success" };
}

export async function deleteTopicAction(input: { id: string }): Promise<TopicManageResult> {
  await requireNtittAdmin();
  if (!IdSchema.safeParse(input.id).success) return { status: "error", message: "Bad request." };

  const supabase = await createClient();
  // Assignments cascade (FK ON DELETE CASCADE); content_items are untouched.
  const { error } = await supabase.from("content_topics").delete().eq("id", input.id);
  if (error) return { status: "error", message: "Couldn’t remove the topic. Please try again." };
  revalidate();
  return { status: "success" };
}

/**
 * Move a topic one place up or down by swapping its sort_order with the adjacent
 * topic's. sort_order isn't unique, so a straight value swap is safe.
 */
export async function moveTopicAction(input: { id: string; direction: "up" | "down" }): Promise<TopicManageResult> {
  await requireNtittAdmin();
  if (!IdSchema.safeParse(input.id).success) return { status: "error", message: "Bad request." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("content_topics")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  const topics = (data as Pick<ContentTopic, "id" | "sort_order">[] | null) ?? [];

  const index = topics.findIndex((t) => t.id === input.id);
  if (index === -1) return { status: "error", message: "Topic not found." };
  const neighbourIndex = input.direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= topics.length) return { status: "success" }; // already at an end

  const a = topics[index];
  const b = topics[neighbourIndex];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("content_topics").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("content_topics").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  if (e1 || e2) return { status: "error", message: "Couldn’t reorder. Please try again." };
  revalidate();
  return { status: "success" };
}
