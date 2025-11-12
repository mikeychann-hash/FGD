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
    envKeyName: ["GROK_API_KEY", "XAI_API_KEY"],
    envUrlName: ["GROK_API_URL", "XAI_API_URL"]
  },
  local: {
    name: "Local Mock",
    apiUrl: null,
    defaultModel: "fgd-local",
    envKeyName: null,
    envUrlName: null,
    local: true
  }
};

const FALLBACK_SEQUENCE = ["openai", "grok", "local"];

function resolveProviderSequence() {
  const preferred = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const sequence = [preferred, ...FALLBACK_SEQUENCE];
  return sequence.filter((id, index) => PROVIDERS[id] && sequence.indexOf(id) === index);
}

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

async function executeProvider(providerId, request) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  if (provider.local) {
    return "Mock LLM response: I understand you want to build a structure. Please provide more specific details about what you'd like to create.";
  }

  const apiKey = provider.envKeyName ? resolveEnvValue(provider.envKeyName) : null;
  if (!apiKey) {
    throw new Error(`${provider.name} API key not configured`);
  }

  const apiUrl = provider.envUrlName ? (resolveEnvValue(provider.envUrlName) || provider.apiUrl) : provider.apiUrl;

  let payload;
  try {
    payload = buildPayload(request, provider);
  } catch (err) {
    throw new Error(`Invalid request format: ${err.message}`);
  }

  console.log(`🤖 Using ${provider.name} (${payload.model}) for LLM query`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(apiUrl, {
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
    if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("Invalid response structure: missing choices array");
    }

    const content = data.choices[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("Invalid response: empty content received");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveEnvValue(keys) {
  if (!keys) {
    return null;
  }
  if (Array.isArray(keys)) {
    for (const key of keys) {
      if (key && process.env[key]) {
        return process.env[key];
      }
    }
    return null;
  }
  return process.env[keys] || null;
}

/**
 * Queries an LLM with provider fallback support.
 */
export async function queryLLM(request, retries = 0, sequence = null) {
  const providerSequence = Array.isArray(sequence) ? sequence : resolveProviderSequence();
  if (providerSequence.length === 0) {
    console.warn("No LLM providers available; returning mock response");
    return "Mock LLM response: Provider unavailable.";
  }

  const [currentProvider, ...rest] = providerSequence;
  try {
    return await executeWithRetries(currentProvider, request, retries);
  } catch (err) {
    console.warn(`⚠️  Provider ${currentProvider} failed: ${err.message}`);
    if (rest.length > 0) {
      console.log(`🔁 Falling back to provider ${rest[0]}`);
      return queryLLM(request, 0, rest);
    }
    console.error("❌ All LLM providers failed");
    return null;
  }
}

async function executeWithRetries(providerId, request, attempt = 0) {
  try {
    return await executeProvider(providerId, request);
  } catch (err) {
    const shouldRetry =
      attempt < MAX_RETRIES &&
      (err.name === "AbortError" || err.name === "TypeError" || (err.status >= 500 && err.status < 600) || err.status === 429);

    if (shouldRetry) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Provider ${providerId} retry in ${delay}ms due to ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetries(providerId, request, attempt + 1);
    }

    throw err;
  }
}

/**
 * Get information about the currently configured provider
 * @returns {object} Provider information
 */
export function getProviderInfo() {
  const [current] = resolveProviderSequence();
  const provider = PROVIDERS[current] || PROVIDERS.openai;
  const apiKey = provider.envKeyName ? process.env[provider.envKeyName] : null;
  const apiUrl = provider.envUrlName ? (process.env[provider.envUrlName] || provider.apiUrl) : provider.apiUrl;
  return {
    name: provider.name,
    model: provider.defaultModel,
    apiUrl: apiUrl,
    configured: provider.local ? true : !!apiKey,
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
    const apiKey = provider.envKeyName ? process.env[provider.envKeyName] : null;

    return {
      id: key,
      name: provider.name,
      model: provider.defaultModel,
      apiUrl: provider.apiUrl,
      configured: provider.local ? true : !!apiKey,
      envKeyName: provider.envKeyName,
      envUrlName: provider.envUrlName
    };
  });
}
