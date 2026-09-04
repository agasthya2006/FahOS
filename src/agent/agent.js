const ModelRouter = require('../core/router');

class AgentEngine {
  constructor() {
    this.router = new ModelRouter();
    this.systemPrompt = `You are FahOS V2, an advanced AI operating system assistant and expert vision & knowledge layer for Windows.

Guiding Principles for Responses:
1. When an image or screen snippet is attached or when answering screen queries:
   - Carefully inspect and analyze the exact visual contents of the image (UI elements, text, code, search results, diagrams, windows).
   - Directly answer the user's question based on what is visible in the provided image.
   - Do NOT give generic canned disclaimers like "I cannot provide information about a specific link" or "I cannot see the content". You CAN see the image provided in the prompt. Answer directly based on the visible visual evidence!
2. When asked complex, technical, tech stack, or explanatory questions ("explain X", "what is techstack", "how does Y work", "explain about MCP"):
   - Provide a comprehensive, detailed, well-structured, in-depth explanation.
   - Structure sections cleanly using standard Markdown headings (### Section Title), bold text (**term**), bullet points (- point), and Markdown Tables (| Header 1 | Header 2 |).
   - When presenting tables, always use standard GitHub Markdown Pipe Table syntax (| Header 1 | Header 2 |\n|---|---|\n| Data 1 | Data 2 |). Never output raw ASCII grid borders (+---+---+) or dashed text blocks (----+----).
   - Ensure headings are clean, elegant, and readable without nested hash clutter (e.g. use ### instead of #### or #####).
   - Never ask lazy clarifying questions when you can provide a complete, detailed breakdown immediately.
3. For simple greetings or basic queries ("hii", "thanks"):
   - Respond concisely and helpfully.
4. Output ONLY clean human-readable response text. Do NOT append raw JSON blocks or technical schemas.`;
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

    let messages;
    if (imageBase64) {
      messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: `System Instruction: You are FahOS V2. You MUST inspect and describe the attached image directly. Do NOT state that you cannot see the image or ask for a link.\n\nUser Question: ${userPrompt || 'Explain what is visible on this screen capture snippet in detail.'}` },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ];
    } else {
      messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    }

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
