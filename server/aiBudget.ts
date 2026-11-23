import { TRPCError } from "@trpc/server";
import { getAiBudget } from "./config";
import { addAiUsage, getAiUsage, getGlobalAiUsage } from "./db";
import { utcDay } from "./security";

/**
 * Cost control for the newsroom's language-model calls.
 *
 * Every AI action passes through `assertAiBudget` before the provider is
 * called and reports its token usage afterwards. The ledger is persisted per
 * UTC day for the whole deployment, per network and per editor, so a single
 * abuser (or a runaway translation loop) cannot create an unbounded bill even
 * if the in-memory rate limiter is bypassed by rotating addresses.
 */

const PER_IP_DAILY_CALLS = 60;
const PER_USER_DAILY_CALLS = 400;

export async function assertAiBudget(input: { ipHash: string; userId?: number | null }) {
  const budget = getAiBudget();
  const day = utcDay();
  const global = await getGlobalAiUsage(day);

  if (global.calls >= budget.dailyCalls) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "The AI desk has reached its daily limit. Please try again tomorrow.",
    });
  }
  if (global.tokens >= budget.dailyTokens) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "The AI desk has reached its daily token budget. Please try again tomorrow.",
    });
  }

  const ipRow = await getAiUsage(day, "ip", input.ipHash);
  if (Number(ipRow?.calls ?? 0) >= PER_IP_DAILY_CALLS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "The AI desk has received too many requests from this network today.",
    });
  }

  if (input.userId) {
    const userRow = await getAiUsage(day, "user", String(input.userId));
    if (Number(userRow?.calls ?? 0) >= PER_USER_DAILY_CALLS) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "You have reached today's AI drafting limit.",
      });
    }
  }
}

export async function recordAiUsage(input: {
  ipHash: string;
  userId?: number | null;
  promptTokens?: number;
  completionTokens?: number;
}) {
  const day = utcDay();
  const calls = 1;
  const promptTokens = Math.max(0, Math.round(input.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(input.completionTokens ?? 0));

  await Promise.all([
    addAiUsage({ day, scope: "global", scopeKey: "all", calls, promptTokens, completionTokens }),
    addAiUsage({
      day,
      scope: "ip",
      scopeKey: input.ipHash,
      calls,
      promptTokens,
      completionTokens,
    }),
    input.userId
      ? addAiUsage({
          day,
          scope: "user",
          scopeKey: String(input.userId),
          calls,
          promptTokens,
          completionTokens,
        })
      : Promise.resolve(),
  ]);
}

/** Rough token estimate used when the provider does not report usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
