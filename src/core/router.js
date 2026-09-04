const FeatherlessClient = require('./featherless');

class ModelRouter {
  constructor() {
    this.client = new FeatherlessClient();
    this.models = {
      reasoning: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      vision: 'Qwen/Qwen2-VL-7B-Instruct',
      fast: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      coding: 'Qwen/Qwen2.5-Coder-32B-Instruct'
    };
  }

  selectModel(taskType = 'reasoning') {
    return this.models[taskType] || this.models.reasoning;
  }

  async executeTask(taskType, messages, tools = null) {
    const selectedModel = this.selectModel(taskType);
    console.log(`[Model Router] Selected Model: ${selectedModel} for Task: ${taskType}`);
    
    return await this.client.chatCompletion({
      model: selectedModel,
      messages,
      tools
    });
  }
}

module.exports = ModelRouter;
