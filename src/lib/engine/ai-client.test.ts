// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAI, parseJSON } from "./ai-client";

beforeEach(() => vi.stubEnv("AI_API_KEY", "test-only-key"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI provider boundary", () => {
  it("does not include the upstream body in an error that routes log", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private transcript and token", { status: 403 })));
    await expect(callAI("policy", "hello")).rejects.toThrow(/^AI API error 403$/);
  });

  it("does not include malformed model output in parse errors", () => {
    expect(() => parseJSON("private transcript")).toThrow(/^Failed to parse AI response as JSON$/);
    expect(parseJSON('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it("passes a deadline signal to the provider fetch", async () => {
    const deadline = AbortSignal.abort(new DOMException("Timed out", "TimeoutError"));
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline);
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      init.signal?.throwIfAborted();
      return Response.json({ choices: [{ message: { content: "{}" } }] });
    }));
    await expect(callAI("policy", "hello")).rejects.toThrow("Timed out");
    expect(timeout).toHaveBeenCalledWith(30_000);
  });
});
