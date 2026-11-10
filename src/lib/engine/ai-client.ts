/**
 * AI API client - OpenAI-compatible interface.
 * Supports OpenAI, Claude (via proxy), DeepSeek, and other compatible APIs.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
}

export async function callAI(
  systemPrompt: string,
  userMessage: string,
): Promise<AIResponse> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey || apiKey === "your-api-key-here") {
    throw new Error("AI_API_KEY not configured");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    // Routes log this error. Provider bodies may echo a transcript or credentials.
    await response.body?.cancel().catch(() => {});
    throw new Error(`AI API error ${response.status}`);
  }

  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    // JSON parser errors can include provider body fragments. Routes log this error.
    throw new Error(
      `Invalid JSON from AI API (status: ${response.status}, content-type: ${response.headers.get("content-type") ?? "unknown"}, length: ${body.length})`,
    );
  }
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from AI API");
  }

  return { content };
}

export function parseJSON<T>(raw: string): T {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }
}

export function isAIConfigured(): boolean {
  const apiKey = process.env.AI_API_KEY;
  return !!apiKey && apiKey !== "your-api-key-here";
}
