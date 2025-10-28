// ai/llm_bridge.js
// Simplified bridge to an LLM (OpenAI API or local model)

// Constants
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const DEFAULT_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 500;

/**
 * Builds a payload for the OpenAI API from a request object or string
 * @param {string|object} request - Either a string prompt or a configuration object
 * @param {string} [request.model] - The model to use (default: gpt-4o-mini)
 * @param {Array} [request.messages] - Array of message objects with role and content
 * @param {string} [request.prompt] - Alternative to messages for simple prompts
 * @param {number} [request.temperature] - Sampling temperature (default: 0.7)
 * @param {number} [request.max_tokens] - Maximum tokens to generate (default: 500)
 * @param {object} [request.response_format] - Response format specification
 * @param {Array} [request.tools] - Tool definitions for function calling
 * @param {number} [request.seed] - Seed for deterministic sampling
 * @returns {object} Formatted payload for OpenAI API
 */
function buildPayload(request) {
  // Handle simple string requests
  if (typeof request === "string") {
    return {
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: request }],
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS
    };
  }

  // Validate request is an object
  if (!request || typeof request !== "object") {
    throw new Error("Request must be a string or object");
  }

  const {
    model = DEFAULT_MODEL,
    messages,
    prompt,
    temperature = DEFAULT_TEMPERATURE,
    max_tokens = DEFAULT_MAX_TOKENS,
    response_format,
    tools,
    seed
  } = request;

  const payload = {
    model,
    messages: Array.isArray(messages) ? messages : [{ role: "user", content: prompt || "" }],
    temperature,
    max_tokens
  };

  // Add optional parameters if provided
  if (response_format) payload.response_format = response_format;
  if (tools) payload.tools = tools;
  if (typeof seed === "number") payload.seed = seed;

  return payload;
}

/**
 * Queries an LLM via the OpenAI API with retry logic
 * @param {string|object} request - The request to send to the LLM
 * @param {number} [retries=0] - Current retry count (used internally)
 * @returns {Promise<string|null>} The LLM's response content, or null on failure
 */
export async function queryLLM(request, retries = 0) {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiUrl = process.env.OPENAI_API_URL || DEFAULT_API_URL;

  let payload;
  try {
    payload = buildPayload(request);
  } catch (err) {
    console.error("❌ Invalid request format:", err.message);
    return null;
  }

  // Return mock response if no API key is configured
  if (!apiKey) {
    console.warn("⚠️  No API key found; returning mock output.");
    return "Mock LLM response: I understand you want to build a structure. Please provide more specific details about what you'd like to create.";
  }

  let response = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    response = await fetch(apiUrl, {
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
      const error = new Error(`HTTP ${response.status}: ${errorBody}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();

    // Validate response structure
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("Invalid response structure: missing choices array");
    }

    const content = data.choices[0]?.message?.content;

    // Validate content exists and is a non-empty string
    if (typeof content !== "string") {
      throw new Error("Invalid response structure: content is not a string");
    }

    if (content.trim().length === 0) {
      throw new Error("Invalid response: empty content received");
    }

    return content;
  } catch (err) {
    // Always clear timeout to prevent memory leak
    clearTimeout(timeout);

    const errorMsg = err.message || "Unknown error";
    console.error(`❌ LLM query failed (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, errorMsg);

    // Determine if we should retry based on error type
    if (retries < MAX_RETRIES) {
      const shouldRetry =
        err.name === 'AbortError' ||                     // Timeout
        err.name === 'TypeError' ||                      // Network error (fetch specific)
        (err.status === 429) ||                          // Rate limit
        (err.status >= 500 && err.status < 600);         // Server error

      if (shouldRetry) {
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return queryLLM(request, retries + 1);
      }
    }

    return null;
  }
}
