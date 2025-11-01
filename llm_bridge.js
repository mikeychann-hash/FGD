// ai/llm_bridge.js
// Multi-provider LLM bridge supporting OpenAI, Grok (xAI), and other compatible APIs

// Constants
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 500;

// Provider configurations
const PROVIDERS = {
  openai: {
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    envKeyName: "OPENAI_API_KEY",
    envUrlName: "OPENAI_API_URL"
  },
  grok: {
    name: "Grok (xAI)",
    apiUrl: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-beta",
    envKeyName: "GROK_API_KEY",
    envUrlName: "GROK_API_URL"
  }
};

// Get selected provider from environment
const getSelectedProvider = () => {
  const providerName = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  return PROVIDERS[providerName] || PROVIDERS.openai;
};

// Legacy constants for backward compatibility
const DEFAULT_API_URL = PROVIDERS.openai.apiUrl;
const DEFAULT_MODEL = PROVIDERS.openai.defaultModel;

/**
 * Builds a payload for the LLM API from a request object or string
 * @param {string|object} request - Either a string prompt or a configuration object
 * @param {string} [request.model] - The model to use (default: provider-specific)
 * @param {Array} [request.messages] - Array of message objects with role and content
 * @param {string} [request.prompt] - Alternative to messages for simple prompts
 * @param {number} [request.temperature] - Sampling temperature (default: 0.7)
 * @param {number} [request.max_tokens] - Maximum tokens to generate (default: 500)
 * @param {object} [request.response_format] - Response format specification
 * @param {Array} [request.tools] - Tool definitions for function calling
 * @param {number} [request.seed] - Seed for deterministic sampling
 * @param {object} provider - Provider configuration object
 * @returns {object} Formatted payload for LLM API
 */
function buildPayload(request, provider) {
  const defaultModel = provider.defaultModel || DEFAULT_MODEL;

  // Handle simple string requests
  if (typeof request === "string") {
    return {
      model: defaultModel,
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
    model = defaultModel,
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
 * Queries an LLM via the selected provider's API with retry logic
 * @param {string|object} request - The request to send to the LLM
 * @param {number} [retries=0] - Current retry count (used internally)
 * @returns {Promise<string|null>} The LLM's response content, or null on failure
 */
export async function queryLLM(request, retries = 0) {
  // Get selected provider configuration
  const provider = getSelectedProvider();
  const apiKey = process.env[provider.envKeyName];
  const apiUrl = process.env[provider.envUrlName] || provider.apiUrl;

  let payload;
  try {
    payload = buildPayload(request, provider);
  } catch (err) {
    console.error("❌ Invalid request format:", err.message);
    return null;
  }

  // Return mock response if no API key is configured
  if (!apiKey) {
    console.warn(`⚠️  No ${provider.name} API key found; returning mock output.`);
    console.warn(`   Set ${provider.envKeyName} environment variable to enable ${provider.name}.`);
    return "Mock LLM response: I understand you want to build a structure. Please provide more specific details about what you'd like to create.";
  }

  // Log provider being used (only on first attempt)
  if (retries === 0) {
    console.log(`🤖 Using ${provider.name} (${payload.model}) for LLM query`);
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

/**
 * Get information about the currently configured provider
 * @returns {object} Provider information
 */
export function getProviderInfo() {
  const provider = getSelectedProvider();
  const apiKey = process.env[provider.envKeyName];
  const apiUrl = process.env[provider.envUrlName] || provider.apiUrl;

  return {
    name: provider.name,
    model: provider.defaultModel,
    apiUrl: apiUrl,
    configured: !!apiKey,
    envKeyName: provider.envKeyName
  };
}

/**
 * Get list of all supported providers
 * @returns {Array} List of provider information objects
 */
export function getAllProviders() {
  return Object.keys(PROVIDERS).map(key => {
    const provider = PROVIDERS[key];
    const apiKey = process.env[provider.envKeyName];

    return {
      id: key,
      name: provider.name,
      model: provider.defaultModel,
      apiUrl: provider.apiUrl,
      configured: !!apiKey,
      envKeyName: provider.envKeyName,
      envUrlName: provider.envUrlName
    };
  });
}
