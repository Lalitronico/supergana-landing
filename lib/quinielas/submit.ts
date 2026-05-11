"use client";

import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import type {
  AnswersMap,
  PlayerRegistration,
  ProvisionalLeaderboardRow,
  SubmissionSuccess,
} from "./schema";

type SubmitResult =
  | { ok: true; data: SubmissionSuccess }
  | {
      ok: false;
      reason: "duplicate" | "closed" | "config" | "network" | "schema" | "unknown";
      message: string;
    };

interface SubmitRpcRow {
  submission_id: string;
  share_id: string;
  provisional_score: number;
  provisional_rank: number;
}

export async function submitQuiniela(
  slug: string,
  player: PlayerRegistration,
  answers: AnswersMap,
): Promise<SubmitResult> {
  if (!supabaseConfigured()) {
    return {
      ok: false,
      reason: "config",
      message:
        "Faltan las variables de Supabase. Puedes probar el flujo, pero aún no se puede guardar.",
    };
  }

  const { data, error } = await supabase().rpc("submit_quiniela", {
    p_slug: slug,
    p_nickname: player.nickname.trim(),
    p_email: player.email.trim().toLowerCase(),
    p_answers: answers,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("duplicate") || message.includes("ya participaste")) {
      return {
        ok: false,
        reason: "duplicate",
        message: "Ya estás dentro con ese correo. Para esta final solo cuenta una entrada.",
      };
    }
    if (message.includes("closed") || message.includes("cerrada")) {
      return {
        ok: false,
        reason: "closed",
        message: "La quiniela ya cerró capturas. El silbatazo nos ganó.",
      };
    }
    if (message.includes("failed to fetch")) {
      return {
        ok: false,
        reason: "network",
        message: "No pudimos conectar con Supabase. Revisa internet y prueba otra vez.",
      };
    }
    if (message.includes("could not find the function") || message.includes("schema cache")) {
      return {
        ok: false,
        reason: "schema",
        message:
          "La base conectada aún no tiene la migración de quinielas. Aplica las migraciones de Supabase y vuelve a intentar.",
      };
    }
    return { ok: false, reason: "unknown", message: error.message };
  }

  const row = Array.isArray(data) ? (data[0] as SubmitRpcRow | undefined) : (data as SubmitRpcRow | null);
  if (!row) {
    return {
      ok: false,
      reason: "unknown",
      message: "Supabase no devolvió la confirmación de participación.",
    };
  }

  const leaderboard = await getProvisionalLeaderboard(slug);

  return {
    ok: true,
    data: {
      submissionId: row.submission_id,
      shareId: row.share_id,
      provisionalScore: row.provisional_score,
      provisionalRank: row.provisional_rank,
      leaderboard,
    },
  };
}

export async function getProvisionalLeaderboard(
  slug: string,
): Promise<ProvisionalLeaderboardRow[]> {
  if (!supabaseConfigured()) return [];

  const { data, error } = await supabase()
    .from("provisional_leaderboard_view")
    .select("submission_id, nickname, provisional_score, final_score, rank, created_at")
    .eq("quiniela_slug", slug)
    .order("rank", { ascending: true })
    .limit(25);

  if (error) {
    console.error("provisional leaderboard error", error);
    return [];
  }

  return data ?? [];
}
