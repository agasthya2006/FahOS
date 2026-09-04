const ModelRouter = require('../core/router');

class AgentEngine {
  constructor() {
    this.router = new ModelRouter();
    this.systemPrompt = `You are FahOS V2, an advanced AI operating system assistant and expert knowledge layer for Windows.

Guiding Principles for Responses:
1. When asked complex, technical, tech stack, or explanatory questions ("explain X", "what is techstack", "how does Y work", "explain about MCP"):
   - Provide a comprehensive, detailed, well-structured, in-depth explanation.
   - Structure sections cleanly using standard Markdown headings (### Section Title), bold text (**term**), bullet points (- point), and Markdown Tables (| Header 1 | Header 2 |).
   - When presenting tables, always use standard GitHub Markdown Pipe Table syntax (| Header 1 | Header 2 |\n|---|---|\n| Data 1 | Data 2 |). Never output raw ASCII grid borders (+---+---+) or dashed text blocks (----+----).
   - Ensure headings are clean, elegant, and readable without nested hash clutter (e.g. use ### instead of #### or #####).
   - Never ask lazy clarifying questions when you can provide a complete, detailed breakdown immediately.
2. For simple greetings or basic queries ("hii", "thanks"):
   - Respond concisely and helpfully.
3. Output ONLY clean human-readable response text. Do NOT append raw JSON blocks or technical schemas.`;
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

  async processUserPrompt(userPrompt, imageBase64 = null, onStatusUpdate = null) {
    console.log(`[Agent Engine] Processing Prompt: "${userPrompt}"`, imageBase64 ? '(Vision Task)' : '');

    const taskCategory = this.router.classifyTask(userPrompt, !!imageBase64);
    const selectedModel = this.router.selectModel(taskCategory);

    if (onStatusUpdate) onStatusUpdate(`SEE: Routing to [${taskCategory.toUpperCase()}] -> ${selectedModel.split('/')[1] || selectedModel}`);

    const userContent = imageBase64 ? [
      { type: 'text', text: userPrompt || 'Analyze this screen snippet in detail.' },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ] : userPrompt;

    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userContent }
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
