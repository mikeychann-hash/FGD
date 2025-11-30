import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Constants
const API_TIMEOUT = 60000; // Increased timeout for CLI operations
const MAX_RETRIES = 2;
const CONFIG_FILE = 'cli_config.json';

// Default configuration if file is missing
const DEFAULT_CONFIG = {
  providers: {
    openai: { name: "OpenAI" },
    codex: { name: "Codex" },
    gemini: { name: "Gemini" },
    claude: { name: "Claude" },
    grok: { name: "Grok" },
    local: { name: "Local Mock", local: true }
  }
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`Failed to load ${CONFIG_FILE}, using defaults: ${err.message}`);
  }
  return DEFAULT_CONFIG;
}

const FALLBACK_SEQUENCE = ["codex", "gemini", "claude", "openai", "local"];

function resolveProviderSequence() {
  const preferred = (process.env.LLM_PROVIDER || "codex").toLowerCase();
  const sequence = [preferred, ...FALLBACK_SEQUENCE];
  // Filter unique
  return sequence.filter((id, index) => sequence.indexOf(id) === index);
}

/**
 * Executes the LLM query via the Python CLI wrapper
 */
export async function executeProvider(providerId, request) {
  const config = loadConfig();
  const provider = config.providers[providerId] || { name: providerId };

  if (providerId === 'local' || provider.local) {
    return "Mock LLM response: I understand you want to build a structure.";
  }

  // Extract prompt string
  let promptText = "";
  if (typeof request === "string") {
    promptText = request;
  } else if (typeof request === "object" && request.prompt) {
    promptText = request.prompt;
  } else if (typeof request === "object" && Array.isArray(request.messages)) {
    promptText = request.messages.map(m => `${m.role}: ${m.content}`).join("\n");
  } else {
    throw new Error("Invalid request format");
  }

  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'llm_wrapper.py');
    const args = [
      pythonScript,
      '--provider', providerId,
      '--prompt', promptText
    ];

    if (request.model) {
      args.push('--model', request.model);
    }

    console.log(`🤖 Invoking CLI: python llm_wrapper.py --provider ${providerId}`);

    const process = spawn('python', args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`CLI process exited with code ${code}: ${stderr}`));
      } else {
        const output = stdout.trim();
        if (output.startsWith("Error:")) {
          // Enhance error message if possible
          const errorMsg = output.substring(6).trim(); // Remove "Error:" prefix
          reject(new Error(`Provider ${providerId} error: ${errorMsg}`));
        } else {
          resolve(output);
        }
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });

    // Timeout from config or default
    const timeoutDuration = provider.timeout || API_TIMEOUT;
    setTimeout(() => {
      process.kill();
      reject(new Error(`CLI process timed out after ${timeoutDuration}ms`));
    }, timeoutDuration);
  });
}

/**
 * Checks the health of configured providers
 * @returns {Promise<Object>} Health status of each provider
 */
export async function checkProviders() {
  const config = loadConfig();
  const results = {};

  for (const [id, provider] of Object.entries(config.providers)) {
    try {
      // Simple ping prompt
      if (id === 'local' || provider.local) {
        results[id] = { status: 'ok', latency: 0 };
        continue;
      }

      const start = Date.now();
      await executeProvider(id, { prompt: "ping", max_tokens: 5 });
      results[id] = { status: 'ok', latency: Date.now() - start };
    } catch (err) {
      results[id] = { status: 'error', error: err.message };
    }
  }

  return results;
}

export async function queryLLM(request, retries = 0, sequence = null) {
  const providerSequence = Array.isArray(sequence) ? sequence : resolveProviderSequence();
  if (providerSequence.length === 0) {
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
    const shouldRetry = attempt < MAX_RETRIES;
    if (shouldRetry) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetries(providerId, request, attempt + 1);
    }
    throw err;
  }
}

export function getProviderInfo() {
  const [current] = resolveProviderSequence();
  const config = loadConfig();
  const provider = config.providers[current] || { name: current };

  return {
    name: provider.name || current,
    model: "cli-default",
    configured: true
  };
}

export function getAllProviders() {
  const config = loadConfig();
  return Object.keys(config.providers).map(key => {
    const provider = config.providers[key];
    return {
      id: key,
      name: provider.name || key,
      model: "cli-default",
      configured: true
    };
  });
}
