const FeatherlessClient = require('./featherless');

class ModelRouter {
  constructor() {
    this.client = new FeatherlessClient();
    this.models = {
      complex: 'Qwen/Qwen2.5-14B-Instruct',
      vision: 'Qwen/Qwen2.5-VL-3B-Instruct',
      simple: 'Qwen/Qwen2.5-7B-Instruct',
      coding: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      whisper: 'whisper-1'
    };
  }

  classifyTask(prompt, hasImage = false) {
    if (hasImage || /screen|image|screenshot|look|see|vision|window/i.test(prompt)) {
      return 'vision';
    }
    if (/code|script|python|javascript|func|bug|error|powershell|cmd|build|create/i.test(prompt)) {
      return 'coding';
    }
    const words = prompt.trim().split(/\s+/);
    if (words.length <= 8 && !/how|why|explain|plan|steps/i.test(prompt)) {
      return 'simple';
    }
    return 'complex';
  }

  selectModel(taskType = 'complex') {
    return this.models[taskType] || this.models.complex;
  }

  async executeTask(taskType, messages, tools = null) {
    const selectedModel = this.selectModel(taskType);
    console.log(`[Model Router] Selected Model: ${selectedModel} for Task Category: ${taskType}`);
    
    try {
      return await this.client.chatCompletion({
        model: selectedModel,
        messages,
        tools
      });
    } catch (err) {
      console.warn(`[Model Router] Primary model ${selectedModel} failed (${err.message}). Retrying with fast model Qwen/Qwen2.5-7B-Instruct after 1500ms delay...`);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Sanitize messages for text-only fallback model if multimodal payload was sent
      const cleanMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          const textObj = m.content.find(c => c.type === 'text');
          return { ...m, content: textObj ? textObj.text : 'Analyze context' };
        }
        return m;
      });

      return await this.client.chatCompletion({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: cleanMessages,
        tools
      });
    }
  }
}

module.exports = ModelRouter;
