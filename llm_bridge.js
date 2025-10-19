// ai/llm_bridge.js
// Simplified bridge to an LLM (OpenAI API or local model)

import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;

export async function queryLLM(prompt, retries = 0) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn("⚠️  No API key found; returning mock output.");
    return JSON.stringify({
      action: "build",
      details: "test structure",
      target: { x: 0, y: 64, z: 0 }
    });
  }

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: API_TIMEOUT
      }
    );

    if (!res.data?.choices?.[0]?.message?.content) {
      throw new Error("Invalid response structure from API");
    }

    return res.data.choices[0].message.content;
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`❌ LLM query failed (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, errorMsg);

    // Retry on timeout or rate limit errors
    if (retries < MAX_RETRIES && (err.code === "ECONNABORTED" || err.response?.status === 429)) {
      const delay = Math.pow(2, retries) * 1000; // Exponential backoff
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return queryLLM(prompt, retries + 1);
    }

    return null;
  }
}