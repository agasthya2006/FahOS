const fs = require('fs');
const path = require('path');

class FeatherlessClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.FEATHERLESS_API_KEY || this.loadKeyFromEnvFile();
    this.baseUrl = 'https://api.featherless.ai/v1';
  }

  loadKeyFromEnvFile() {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/FEATHERLESS_API_KEY\s*=\s*(.*)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch (e) {
      console.warn('Could not read .env file:', e.message);
    }
    return null;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async chatCompletion({ model = 'Qwen/Qwen2.5-7B-Instruct', messages, tools = null, temperature = 0.3, max_tokens = 2048 }) {
    if (!this.apiKey) {
      console.warn('[Featherless] No API key set. Returning mock fallback structured plan.');
      return this.generateMockResponse(messages);
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          const is429 = response.status === 429 || errText.includes('concurrency_limit_exceeded');
          const is503 = response.status === 503 || errText.includes('capacity_exhausted');

          if ((is429 || is503) && attempt < maxAttempts) {
            const backoffMs = attempt * 2500;
            console.warn(`[Featherless Client] Status ${response.status} (${is503 ? 'GPU Capacity Exhausted' : 'Rate Limited'}) on ${model} (attempt ${attempt}/${maxAttempts}). Waiting ${backoffMs}ms before retrying...`);
            await this.sleep(backoffMs);
            continue;
          }

          throw new Error(`Featherless API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return data.choices[0].message;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          lastError = new Error(`Featherless API Request Timed Out after 45s (Model: ${model})`);
        } else {
          lastError = error;
        }

        if (attempt < maxAttempts && !error.message?.includes('Timed Out')) {
          const backoffMs = attempt * 1200;
          console.warn(`[Featherless Client Error]: ${error.message}. Retrying in ${backoffMs}ms...`);
          await this.sleep(backoffMs);
        } else {
          break;
        }
      }
    }

    console.error('[Featherless Client Final Failure]:', lastError?.message);
    throw lastError;
  }

  generateMockResponse(messages) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    return {
      role: 'assistant',
      content: JSON.stringify({
        intent: 'execute_workflow',
        summary: `Autonomous plan for: "${lastUserMsg}"`,
        steps: [
          { step: 1, action: 'context_analysis', description: 'Analyze active window & screen context', status: 'completed' },
          { step: 2, action: 'plan_generation', description: 'Generate optimal tool execution path', status: 'completed' },
          { step: 3, action: 'tool_execution', description: 'Execute tool actions securely', status: 'active' },
          { step: 4, action: 'verification', description: 'Verify state and recover if needed', status: 'pending' }
        ]
      })
    };
  }
}

module.exports = FeatherlessClient;
