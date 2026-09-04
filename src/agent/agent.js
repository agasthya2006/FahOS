const ModelRouter = require('../core/router');
const VisionSensor = require('../core/vision_sensor');
const systemActions = require('../core/system_actions');

class AgentEngine {
  constructor() {
    this.router = new ModelRouter();
    this.visionSensor = new VisionSensor();
    this.systemPrompt = `You are an expert AI OS Assistant & Automation Controller. Your top priority is to provide FACTUALLY ACCURATE, CONCISE, and STRUCTURED answers.

### 📋 STRICT OUTPUT & ACCURACY RULES:
1. **EXPLAIN SIMPLY & STRUCTURED**: Use clear markdown headers (### Section), bold bullet points, and numbered steps. Never output huge unformatted blocks of text.
2. **NO HALLUCINATED COMMANDS**: Only output valid Windows PowerShell, CMD, or system commands that work natively.
3. **STRUCTURED COMMAND BLOCK FORMATTING**: 
   When your answer requires executing an action or automation, ALWAYS enclose the exact executable command in a fenced code block using one of the following tags:
   - For PowerShell actions: \`\`\`powershell ... \`\`\`
   - For CMD actions: \`\`\`cmd ... \`\`\`
   - For JSON structured actions: \`\`\`json ... \`\`\`
4. **JSON ACTION MANIFEST SCHEMA**:
   When proposing multi-step system or automation tasks, output a JSON block matching:
   \`\`\`json
   {
     "status": "success",
     "action": "run_command | open_browser | send_whatsapp | create_file | delete_file",
     "command": "<exact_powershell_or_url_command>",
     "description": "<short_human_readable_summary>"
   }
   \`\`\`
5. **VISION & SCREEN CONTENT RULES**:
   - When an image or screen snippet is attached or when answering screen queries:
   - Focus on the ACTUAL CONTENT shown — the text, code, data, errors, or information visible on screen.
   - Directly answer the user's question about the content's meaning, purpose, or solution.
   - Do NOT describe UI layout, dimensions, visual indicators, element positions, or screen chrome. The user wants to understand the CONTENT, not the interface it's displayed in.
   - Do NOT give generic canned disclaimers like "I cannot provide information about a specific link" or "I cannot see the content". You CAN see the image provided in the prompt. Answer directly based on the visible content!
6. **EXPLANATORY & TECHNICAL QUERIES**:
   - Structure sections cleanly using standard Markdown headings (### Section Title), bold text (**term**), bullet points (- point), and Markdown Tables (| Header 1 | Header 2 |).
   - When presenting tables, always use standard GitHub Markdown Pipe Table syntax (| Header 1 | Header 2 |\\n|---|---|\\n| Data 1 | Data 2 |). Never output raw ASCII grid borders (+---+---+) or dashed text blocks (----+----).
   - Ensure headings are clean, elegant, and readable without nested hash clutter.
   - Never ask lazy clarifying questions when you can provide a complete, detailed breakdown immediately.
7. **CONCISE CHAT**:
   - For simple greetings or basic queries ("hi", "thanks"), respond concisely and helpfully.`;
  }

  cleanOutputText(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();

    // If the entire output is a JSON string without markdown code block, extract readable summary or message
    if (text.startsWith('{') && text.endsWith('}') && !text.includes('```')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.description) return parsed.description;
        if (parsed.summary) return parsed.summary;
        if (parsed.message) return parsed.message;
      } catch (e) {}
    }

    return text || rawText;
  }

  async processUserPrompt(userPrompt, imageBase64 = null, onStatusUpdate = null, onChunk = null) {
    console.log(`[Agent Engine] Processing Prompt: "${userPrompt}"`, imageBase64 ? '(Vision Task)' : '');

    const taskCategory = this.router.classifyTask(userPrompt, !!imageBase64);

    // 0ms Local Fast-Path Execution for Windows OS Actions
    if (taskCategory.startsWith('fastpath_')) {
      if (taskCategory === 'fastpath_media') {
        if (onStatusUpdate) onStatusUpdate('FahOS is executing media action...');
        const res = await systemActions.systemControl({ action: userPrompt });
        return {
          success: res.ok,
          answerText: res.description
        };
      }

      if (taskCategory === 'fastpath_youtube') {
        if (onStatusUpdate) onStatusUpdate('FahOS is opening YouTube...');
        const ytMatch = userPrompt.match(/^(?:(?:open\s+)?(?:youtube|yt)\s+(?:and\s+)?(?:search|look\s+up|play)(?:\s+(?:for|about))?\s+(.+)|(?:search|play|look\s+up)(?:\s+(?:for|about))?\s+(.+?)\s+(?:on|in|using)\s+(?:youtube|yt)|(?:youtube|yt)\s+(?:search|play)\s+(.+))$/i);
        const query = (ytMatch ? (ytMatch[1] || ytMatch[2] || ytMatch[3]) : userPrompt).trim();
        const res = await systemActions.webSearch({ engine: 'youtube', query });
        return {
          success: res.ok,
          answerText: res.description
        };
      }

      if (taskCategory === 'fastpath_spotify') {
        if (onStatusUpdate) onStatusUpdate('FahOS is opening Spotify...');
        const spotMatch = userPrompt.match(/^(?:(?:open\s+)?spotify\s+(?:and\s+)?(?:search|play)\s+|(?:search|play)\s+(?:song\s+)?)(.*?)(?:\s+(?:on|in)\s+spotify)?$/i);
        const query = (spotMatch ? spotMatch[1] : userPrompt).trim();
        const res = await systemActions.spotifySearch({ query });
        return {
          success: res.ok,
          answerText: res.description
        };
      }

      if (taskCategory === 'fastpath_note') {
        if (onStatusUpdate) onStatusUpdate('FahOS is saving note...');
        const noteMatch = userPrompt.match(/^(?:open\s+notepad\s+and\s+(?:write|note\s+down)\s+|take\s+a\s+note\s+(?:saying\s+|that\s+)?|write\s+note\s+)(.*)$/i);
        const content = (noteMatch ? noteMatch[1] : userPrompt).trim();
        const res = await systemActions.notepadWrite({ content });
        return {
          success: res.ok,
          answerText: res.description
        };
      }

      if (taskCategory === 'fastpath_whatsapp') {
        if (onStatusUpdate) onStatusUpdate('FahOS is preparing WhatsApp...');
        const waMatch = userPrompt.match(/^(?:(?:open\s+)?whatsapp\s+(?:and\s+)?(?:send\s+(?:a\s+)?message\s+)?|send\s+(?:a\s+)?(?:whatsapp\s+)?message\s+(?:saying\s+|that\s+|to\s+say\s+)?)(.*)$/i);
        const text = (waMatch ? waMatch[1] : userPrompt).trim();
        const res = await systemActions.sendWhatsAppMessage({ text });
        return {
          success: res.ok,
          answerText: res.description
        };
      }

      if (taskCategory === 'fastpath_create') {
        if (onStatusUpdate) onStatusUpdate('FahOS is creating file...');
        const createMatch = userPrompt.match(/^(?:can\s+you\s+)?(?:create|make|add|new)\s+(?:a\s+)?(?:file|folder|directory)\s+(?:named|called)?\s*([a-zA-Z0-9_\-\.\s]+?)(?:\s+(?:in|on|inside)\s+(?:the\s+)?([a-zA-Z0-9_\-\\\/\s]+))?$/i);
        if (createMatch) {
          const isFolder = /folder|directory/i.test(createMatch[0]);
          const name = createMatch[1].trim();
          const targetFolder = createMatch[2] ? createMatch[2].trim() : 'Desktop';
          const res = await systemActions.createFileOrFolder({ name, targetFolder, isFolder });
          return {
            success: res.ok,
            answerText: res.description
          };
        }
      }

      if (taskCategory === 'fastpath_search') {
        if (onStatusUpdate) onStatusUpdate('FahOS is searching...');
        const searchMatch = userPrompt.match(/^(?:search\s+(?:google|web|for)?\s+(.+)|(?:google|search)\s+(.+))$/i);
        const query = (searchMatch ? (searchMatch[1] || searchMatch[2]) : userPrompt).trim();
        const res = await systemActions.webSearch({ engine: 'google', query });
        return {
          success: res.ok,
          answerText: res.description
        };
      }

      if (taskCategory === 'fastpath_app') {
        const appMatch = userPrompt.match(/^(?:open|launch|start|run|go\s+to|show|view)(?:\s+(?:the|folder|directory|app|file))?\s+(.+)$/i);
        const target = (appMatch ? appMatch[1] : userPrompt).trim();
        if (onStatusUpdate) onStatusUpdate(`FahOS is opening ${target}...`);
        const res = await systemActions.verifyAndOpenItem(target);
        return {
          success: res.ok,
          answerText: res.description
        };
      }
    }

    if (onStatusUpdate) onStatusUpdate('FahOS is thinking...');

    let messages;
    let actualTaskCategory = taskCategory;

    if (imageBase64) {
      if (onStatusUpdate) onStatusUpdate('FahOS is thinking...');
      try {
        const visionAnswer = await this.visionSensor.analyzeImage({
          systemPrompt: this.systemPrompt,
          userPrompt,
          imageBase64
        });

        if (visionAnswer) {
          console.log('[Agent Engine] Direct Gemini Vision Response received successfully!');
          const cleanAnswer = this.cleanOutputText(visionAnswer) || visionAnswer;
          return {
            success: true,
            answerText: cleanAnswer,
            plan: {
              intent: 'direct_response',
              summary: cleanAnswer,
              steps: [{ step: 1, action: 'reply', description: cleanAnswer, status: 'completed' }]
            },
            message: cleanAnswer
          };
        }
      } catch (err) {
        console.warn('[Agent Engine] Gemini direct vision failed, falling back to Featherless:', err.message);
      }

      // Fallback: If Gemini is unavailable, route to Featherless AI Vision Pool
      messages = [
        { role: 'system', content: this.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: `System Instruction: You are FahOS V2. Inspect and explain the attached image directly.\n\nUser Question: ${userPrompt || 'Explain what is visible on this screen capture snippet in detail.'}` },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ];
      actualTaskCategory = 'vision';
    } else {
      messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    }

    if (onStatusUpdate) onStatusUpdate('FahOS is thinking...');

    try {
      const response = await this.router.executeTask(actualTaskCategory, messages);
      const rawText = response.content || '';
      let cleanAnswer = this.cleanOutputText(rawText) || rawText;

      // Check if user specifically requested execution (e.g. "run command to ...", "execute ...", "do this")
      const wantsExecution = /^(?:run|execute|perform|do|apply)\b/i.test(userPrompt.trim());
      if (wantsExecution) {
        const cmdMatch = rawText.match(/```(?:powershell|cmd|sh|bash)?\r?\n([\s\S]*?)```/i);
        if (cmdMatch && cmdMatch[1] && cmdMatch[1].trim()) {
          const cmd = cmdMatch[1].trim();
          console.log(`[Agent Engine] Executing synthesized command: ${cmd}`);
          if (onStatusUpdate) onStatusUpdate('FahOS is executing command...');
          const execRes = await systemActions.runPowerShell(cmd);
          if (execRes.ok && execRes.output) {
            cleanAnswer += `\n\n> 💻 **Execution Output:**\n\`\`\`text\n${execRes.output.slice(0, 1500)}\n\`\`\``;
          }
        }
      }

      const plan = {
        intent: 'direct_response',
        summary: cleanAnswer,
        steps: [
          { step: 1, action: 'reply', description: cleanAnswer, status: 'completed' }
        ]
      };

      if (onStatusUpdate) onStatusUpdate('✓ Done ✓');

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
