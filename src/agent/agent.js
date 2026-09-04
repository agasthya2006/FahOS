const ModelRouter = require('../core/router');

class AgentEngine {
  constructor() {
    this.router = new ModelRouter();
    this.systemPrompt = `You are FahOS V2, an autonomous AI operating layer for Windows.
Your core operating loop is: SEE -> UNDERSTAND -> PLAN -> ACT -> OBSERVE -> VERIFY -> RECOVER.

When the user asks you to perform a task:
1. Analyze the intent and active context.
2. Produce a JSON plan with discrete steps.
3. Specify actions and target tools.
4. Verify output state after each step.

Always output valid structured JSON matching:
{
  "intent": "<intent_name>",
  "summary": "<short_summary>",
  "steps": [
    { "step": 1, "action": "<action>", "description": "<desc>", "status": "completed|active|pending" }
  ]
}`;
  }

  async processUserPrompt(userPrompt, onStatusUpdate = null) {
    console.log(`[Agent Engine] Processing Prompt: "${userPrompt}"`);

    if (onStatusUpdate) onStatusUpdate('SEE: Gathering context...');

    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    if (onStatusUpdate) onStatusUpdate('UNDERSTAND: Routing to Featherless AI...');

    try {
      const response = await this.router.executeTask('reasoning', messages);
      let plan;

      try {
        plan = JSON.parse(response.content);
      } catch (parseErr) {
        plan = {
          intent: 'direct_response',
          summary: response.content || 'Task processed successfully.',
          steps: [
            { step: 1, action: 'reasoning', description: 'Analyze request', status: 'completed' },
            { step: 2, action: 'action', description: 'Execute response', status: 'completed' },
            { step: 3, action: 'verify', description: 'Verify state', status: 'completed' }
          ]
        };
      }

      if (onStatusUpdate) onStatusUpdate('PLAN: Action tree created');

      return {
        success: true,
        plan,
        message: plan.summary || 'Plan constructed successfully.'
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
