const ModelRouter = require('../core/router');

class AgentEngine {
  constructor() {
    this.router = new ModelRouter();
    this.systemPrompt = `You are FahOS V2, an intelligent AI operating layer and assistant for Windows.
Respond directly, clearly, and conversationally in plain, friendly text.
Do NOT append raw JSON blocks or technical JSON schemas to your conversational answers.`;
  }

  cleanOutputText(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();

    // Check if whole output is JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed.summary) return parsed.summary;
    } catch (e) {}

    // If there is text followed by a JSON block, extract clean text before '{' or strip JSON block
    const jsonStartIndex = text.indexOf('{');
    if (jsonStartIndex > 0) {
      text = text.slice(0, jsonStartIndex).trim();
    } else if (jsonStartIndex === 0) {
      // Starts with JSON block, try parsing inside or extracting summary
      const match = text.match(/"summary"\s*:\s*"([^"]+)"/);
      if (match && match[1]) return match[1];
      text = text.replace(/^\{[\s\S]*\}/, '').trim();
    }

    return text || rawText;
  }

  async processUserPrompt(userPrompt, onStatusUpdate = null) {
    console.log(`[Agent Engine] Processing Prompt: "${userPrompt}"`);

    const taskCategory = this.router.classifyTask(userPrompt);
    const selectedModel = this.router.selectModel(taskCategory);

    if (onStatusUpdate) onStatusUpdate(`SEE: Routing to [${taskCategory.toUpperCase()}] -> ${selectedModel.split('/')[1] || selectedModel}`);

    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    if (onStatusUpdate) onStatusUpdate(`UNDERSTAND: Querying Featherless.ai...`);

    try {
      const response = await this.router.executeTask(taskCategory, messages);
      const rawText = response.content || '';
      const cleanAnswer = this.cleanOutputText(rawText);

      const plan = {
        intent: 'direct_response',
        summary: cleanAnswer,
        steps: [
          { step: 1, action: 'reply', description: cleanAnswer, status: 'completed' }
        ]
      };

      if (onStatusUpdate) onStatusUpdate('PLAN: Response generated');

      return {
        success: true,
        answerText: cleanAnswer,
        plan,
        message: cleanAnswer
      };
    } catch (error) {
      console.error('[Agent Engine Error]:', error.message);
      return {
        success: false,
        error: error.message,
        plan: {
          intent: 'error_recovery',
          summary: `Execution Error: ${error.message}`,
          steps: [
            { step: 1, action: 'error_diagnosis', description: error.message, status: 'failed' }
          ]
        }
      };
    }
  }
}

module.exports = AgentEngine;
