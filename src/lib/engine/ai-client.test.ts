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

  it.each([
    ["TOKEN123 private transcript", "text/html"],
    ['{"transcript":"TOKEN123"', "application/json"],
    [null, null],
  ])("sanitizes malformed HTTP 200 JSON errors (%s)", async (body, contentType) => {
    const response = new Response(body, { status: 200 });
    if (contentType) response.headers.set("content-type", contentType);
    else response.headers.delete("content-type");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const error = await callAI("policy", "hello").catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("message",
      `Invalid JSON from AI API (status: 200, content-type: ${contentType ?? "unknown"}, length: ${body?.length ?? 0})`);
    expect(error).not.toHaveProperty("cause");
    expect(String(error)).not.toContain("TOKEN123");
  });

  it("does not include malformed model output in parse errors", () => {
    expect(() => parseJSON("private transcript")).toThrow(/^Failed to parse AI response as JSON$/);
    expect(parseJSON('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it("returns content from a valid HTTP 200 JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }),
    ));
    await expect(callAI("policy", "hello")).resolves.toEqual({ content: '{"ok":true}' });
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
