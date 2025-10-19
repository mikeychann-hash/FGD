// ai/llm_bridge.js
// Simplified bridge to an LLM (OpenAI API or local model)

const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const API_URL = "https://api.openai.com/v1/chat/completions";

function buildPayload(request) {
  if (typeof request === "string") {
    return {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: request }],
      temperature: 0.7,
      max_tokens: 500
    };
  }

  const {
    model = "gpt-4o-mini",
    messages,
    prompt,
    temperature = 0.7,
    max_tokens = 500,
    response_format,
    tools,
    seed
  } = request || {};

  const payload = {
    model,
    messages: Array.isArray(messages) ? messages : [{ role: "user", content: prompt || "" }],
    temperature,
    max_tokens
  };

  if (response_format) payload.response_format = response_format;
  if (tools) payload.tools = tools;
  if (typeof seed === "number") payload.seed = seed;

  return payload;
}

export async function queryLLM(request, retries = 0) {
  const apiKey = process.env.OPENAI_API_KEY;
  const payload = buildPayload(request);

  if (!apiKey) {
    console.warn("⚠️  No API key found; returning mock output.");
    return JSON.stringify({
      action: "build",
      details: "mock structure",
      target: { x: 0, y: 64, z: 0 },
      priority: "normal"
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Invalid response structure from API");
    }

    return content;
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`❌ LLM query failed (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, errorMsg);

    if (
      retries < MAX_RETRIES &&
      (err.code === "ECONNABORTED" || err.response?.status === 429 || err.response?.status >= 500)
    ) {
      const delay = Math.pow(2, retries) * 1000; // Exponential backoff
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return queryLLM(request, retries + 1);
    }

    return null;
  }
}
