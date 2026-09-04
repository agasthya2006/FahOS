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

  async chatCompletion({ model = 'meta-llama/Meta-Llama-3.1-70B-Instruct', messages, tools = null, temperature = 0.2 }) {
    if (!this.apiKey) {
      console.warn('[Featherless] No API key set. Returning mock fallback structured plan.');
      return this.generateMockResponse(messages);
    }

    const payload = {
      model,
      messages,
      temperature,
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Featherless API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      return data.choices[0].message;
    } catch (error) {
      console.error('[Featherless Client Error]:', error.message);
      throw error;
    }
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
