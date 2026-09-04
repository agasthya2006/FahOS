const FeatherlessClient = require('./featherless');

class ModelRouter {
  constructor() {
    this.client = new FeatherlessClient();
    this.models = {
      complex: 'Qwen/Qwen2.5-32B-Instruct',
      vision: 'Qwen/Qwen2.5-VL-7B-Instruct',
      simple: 'Qwen/Qwen2.5-7B-Instruct',
      coding: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      whisper: 'whisper-1'
    };
  }

  classifyTask(prompt, hasImage = false) {
    if (hasImage) {
      return 'vision';
    }

    // Only route to vision when explicitly referencing the screen, screenshot, or display visual state
    if (/\b(?:on\s+(?:my\s+)?screen|in\s+(?:this\s+)?screenshot|what\s+is\s+on\s+screen|look\s+at\s+(?:my\s+)?screen|see\s+(?:my\s+)?screen|capture\s+screen|screen\s+capture)\b/i.test(prompt)) {
      return 'vision';
    }

    const trimmed = prompt.trim();

    // 0. Direct Windows CLI & PowerShell Commands (Verify first!)
    if (this.isWindowsCommand(trimmed)) {
      return 'fastpath_cmd';
    }

    // 1. Media & Volume Controls (0ms Fast-Path)
    if (/^(?:volume\s+(?:up|down|max|min)|increase\s+volume|decrease\s+volume|lower\s+volume|louder|mute|unmute|pause|play|play\s+pause|next\s+track|next\s+song|skip\s+song|previous\s+track|previous\s+song|lock\s+(?:screen|pc|workstation|computer))$/i.test(trimmed)) {
      return 'fastpath_media';
    }

    // 2. Direct Spotify Search & Play (Local App)
    if (/^(?:(?:open\s+)?spotify\s+(?:and\s+)?(?:search|play)\s+|play\s+(?:song\s+)?.+?\s+(?:on\s+)?spotify)/i.test(trimmed)) {
      return 'fastpath_spotify';
    }

    // 3. Master Directive: Web Task Routing via FahOS Unified Browser (94% Large-Screen)
    const BROWSER_TASK_SIGNALS = [
      /\b(?:search|look\s+up|find|play|check|get|read|navigate|fetch)\s+.*?\s+(?:on|in|using|from)\s+(?:youtube|yt|google|amazon|wikipedia|reddit|github|twitter|x|linkedin|spotify|medium|stackoverflow|web|internet)\b/i,
      /^(?:open|launch|go\s+to)\s+(?:youtube|yt|google|amazon|wikipedia|reddit|github)\b/i,
      /^(?:open|launch)\s+(?:youtube|yt|google|amazon|wikipedia|reddit|github)\s+(?:and\s+)?(?:search|look\s+up|find|play)\s+(.+)$/i,
      /^(?:search|google|look\s+up|browse)\s+(?:for\s+|about\s+)?(.+)$/i,
      /\b(?:youtube|yt)\s+(?:search|play)\s+(.+)$/i,
      /\b(?:wikipedia|wiki)\s+(?:search|summary)\s+(.+)$/i,
      /\b(?:amazon)\s+(?:search|find|price)\s+(.+)$/i,
      /\b(?:https?:\/\/|[a-z0-9\-\.]+\.(?:com|org|net|io|co|in|dev|ai))\b/i,
      /\b(?:on\s+(?:the\s+)?(?:web|internet|google|youtube|wikipedia|amazon|reddit|github))\b/i
    ];

    if (BROWSER_TASK_SIGNALS.some(pattern => pattern.test(trimmed))) {
      return 'fastpath_browsertask';
    }

    // Informational / Explanatory queries must never trigger action fast-paths
    const isInformational = /^(?:tell\s+me|tell\s+us|what\s+is|what\s+are|what\s+was|how\s+to|how\s+do|how\s+does|why\s+is|why\s+are|explain|who\s+is|who\s+was|describe|define|teach\s+me|can\s+you\s+explain)\b/i.test(trimmed);

    if (!isInformational) {
      // 4. Notepad Quick Note
      if (/^(?:open\s+notepad\s+and\s+(?:write|note\s+down)\s+|take\s+a\s+note\s+(?:saying\s+|that\s+)?|write\s+note\s+).+$/i.test(trimmed)) {
        return 'fastpath_note';
      }

      // 5. WhatsApp Message
      if (this.extractWhatsAppMessage(trimmed)) {
        return 'fastpath_whatsapp';
      }

      // 6. Create File or Folder
      if (/^(?:can\s+you\s+)?(?:create|make|add|new)\s+(?:a\s+)?(?:file|folder|directory)\s+(?:named|called)?\s*.+$/i.test(trimmed)) {
        return 'fastpath_create';
      }

      // 7. Safe Delete File or Folder (Recycle Bin)
      if (/^(?:delete|remove|trash)\s+(?:the\s+)?(?:file|folder|directory)?\s*.+$/i.test(trimmed)) {
        return 'fastpath_delete';
      }

      // 8. Compose Email Deep-Link
      if (this.extractEmailCompose(trimmed)) {
        return 'fastpath_email';
      }

      // 9. Close Application
      if (/^(?:close|quit|exit|terminate|kill)(?:\s+(?:the\s+)?app)?\s+([a-zA-Z0-9_\s\-\.]+)$/i.test(trimmed)) {
        return 'fastpath_close';
      }

      // 10. Open App, Directory, or Local File
      if (/^(?:open|launch|start|run|go\s+to|show|view)(?:\s+(?:the|folder|directory|app|file))?\s+([a-zA-Z0-9_\s\-\.\:\\\/]+)$/i.test(trimmed)) {
        return 'fastpath_app';
      }
    }

    if (/code|script|python|javascript|func|bug|error|powershell|cmd|build|create/i.test(prompt)) {
      return 'coding';
    }
    const words = trimmed.split(/\s+/);
    if (words.length <= 8 && !/how|why|explain|plan|steps/i.test(prompt)) {
      return 'simple';
    }
    return 'complex';
  }

  extractWhatsAppMessage(rawText) {
    let text = String(rawText || '').trim().replace(/[\.\?!,;]+$/, '').trim();
    if (!text) return null;

    // Ignore informational queries (e.g. "what is whatsapp")
    if (/^(?:tell\s+me|what\s+is|how\s+to|explain)\b/i.test(text)) return null;

    // Has explicit whatsapp mention?
    const hasExplicitWhatsApp = /what?ts?app/i.test(text);

    // Clean optional trailing platform indicators e.g. "send hi to akhil on whatsapp"
    let cleanText = text.replace(/\s+(?:on|via|in)\s+what?ts?app$/i, '').trim();

    const waPrefix = '^(?:(?:start|open|then|in|go\\s+to)\\s+what?ts?app\\s+(?:and\\s+)?)';

    // Pattern 1: open whatsapp and send <msg> to <contact> (or "send <msg> to <contact> on whatsapp")
    if (hasExplicitWhatsApp) {
      let m = cleanText.match(new RegExp(`(?:${waPrefix})?send\\s+(?:a\\s+)?(?:what?ts?app\\s+)?(?:message|msg|text)?\\s*([a-zA-Z0-9_\\s\\+]+?)\\s+to\\s+([a-zA-Z0-9_\\s\\+]+)$`, 'i'));
      if (m && m[1] && m[2]) return { message: m[1].trim(), contact: m[2].trim() };

      // Pattern 2: open whatsapp and send to <contact> <msg>
      m = cleanText.match(new RegExp(`(?:${waPrefix})?send\\s+(?:a\\s+)?(?:message|msg|text\\s+)?to\\s+([a-zA-Z0-9_\\s\\+]+?)(?:\\s+(?:saying|that|with|texting)\\s+|\\s+)(.+)$`, 'i'));
      if (m && m[1] && m[2]) return { contact: m[1].trim(), message: m[2].trim() };

      // Pattern 3: whatsapp <contact> saying <msg>
      m = cleanText.match(/^what?ts?app\s+([a-zA-Z0-9_\+]+)(?:\s+(?:saying|that|with|texting)\s+|\s*:\s*|\s+)(.+)$/i);
      if (m && m[1] && m[2]) return { contact: m[1].trim(), message: m[2].trim() };

      // Pattern 4: just open whatsapp and send message (empty contact / message)
      if (/^(?:(?:open|launch|start)\s+what?ts?app(?:\s+(?:and\s+)?send\s+(?:a\s+)?message)?|what?ts?app)$/i.test(text)) {
        return { contact: '', message: '' };
      }
    }

    return null;
  }

  extractEmailCompose(rawText) {
    let text = String(rawText || '').trim().replace(/[\.\?!,;]+$/, '').trim();
    if (!text) return null;

    if (/^(?:tell\s+me|what\s+is|how\s+to|explain)\b/i.test(text)) return null;

    const mailPrefix = '^(?:(?:start|open|go\\s+to|launch|in)\\s+(?:gmail|mail|email)\\s+(?:and\\s+)?)?';

    // Pattern: (open gmail and)? (compose/send/write) email to <target> about <details>
    let m = text.match(new RegExp(`${mailPrefix}(?:compose|send|write|draft)\\s+(?:an?\\s+)?(?:email|mail|message)?\\s*(?:to\\s+)?([a-zA-Z0-9_\\s\\.\\+@]+?)(?:\\s+(?:about|subject|saying|with|body)\\s+(.+))?$`, 'i'));
    if (m && m[1] && !/^(gmail|email|mail)$/i.test(m[1].trim())) {
      return { target: m[1].trim(), details: m[2] ? m[2].trim() : '' };
    }

    return null;
  }

  isWindowsCommand(prompt) {
    const trimmed = String(prompt || '').trim();

    // 1. Explicit command execution prefix: "run <cmd>", "execute <cmd>", "exec <cmd>"
    if (/^(?:run|execute|exec)\s+(?:command\s+)?([a-zA-Z0-9_\-\.\/\\:\s\$\|\&><\*\"]+)$/i.test(trimmed)) {
      const target = trimmed.replace(/^(?:run|execute|exec)\s+(?:command\s+)?/i, '').trim();
      const isSimpleApp = /^(?:notepad|calc|calculator|chrome|browser|code|vscode|explorer|files|paint|mspaint|terminal|cmd|powershell|taskmgr|settings|spotify|whatsapp)$/i.test(target);
      if (!isSimpleApp) {
        return true;
      }
    }

    // 2. Direct Windows CLI commands or PowerShell cmdlets
    const DIRECT_CLI = /^(?:ipconfig|systeminfo|tasklist|whoami|hostname|netstat|tracert|nslookup|dir|tree|ver|cls|route|arp|driverquery|taskkill|get-process|get-service|get-childitem|get-command|get-date|get-computerinfo|get-help|get-history|get-host|get-location|get-volume|test-connection|test-netconnection)(?:\s+.*)?$/i;

    return DIRECT_CLI.test(trimmed);
  }

  selectModel(taskType = 'complex') {
    return this.models[taskType] || this.models.complex;
  }

  async executeTask(taskType, messages, tools = null) {
    const selectedModel = this.selectModel(taskType);
    console.log(`[Model Router] Selected Model: ${selectedModel} for Task Category: ${taskType}`);

    if (taskType === 'vision') {
      const visionModels = [
        'Qwen/Qwen2.5-VL-7B-Instruct',
        'Qwen/Qwen2.5-VL-3B-Instruct',
        'meta-llama/Llama-3.2-11B-Vision-Instruct'
      ];
      let lastVisionErr = null;

      for (const visionModel of visionModels) {
        try {
          console.log(`[Model Router Vision Pool] Querying Vision Model: ${visionModel}...`);
          return await this.client.chatCompletion({
            model: visionModel,
            messages,
            tools
          });
        } catch (err) {
          lastVisionErr = err;
          console.warn(`[Model Router Vision Pool] ${visionModel} failed (${err.message}). Retrying next vision model in 1500ms...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      console.warn(`[Model Router Vision Pool] All vision models are at capacity on Featherless (${lastVisionErr?.message}). Auto-falling back to High-Accuracy Text Model Qwen/Qwen2.5-32B-Instruct...`);

      // Strip image_url payload so text model processes user prompt seamlessly
      const cleanMessages = messages.map(m => {
        if (Array.isArray(m.content)) {
          const textObj = m.content.find(c => c.type === 'text');
          let userPrompt = textObj ? textObj.text : 'Analyze context';
          userPrompt = userPrompt.replace(/^System Instruction:[\s\S]*?\n\nUser Question:\s*/i, '');
          return { role: m.role || 'user', content: userPrompt };
        }
        return m;
      });

      try {
        const textResponse = await this.client.chatCompletion({
          model: 'Qwen/Qwen2.5-32B-Instruct',
          messages: cleanMessages,
          tools
        });

        const textContent = textResponse.content || '';
        return {
          ...textResponse,
          content: `> ℹ️ *Note: Vision GPU servers are temporarily at capacity on Featherless. Answering based on query text via Qwen2.5-32B.* \n\n${textContent}`
        };
      } catch (fallbackErr) {
        throw new Error(`Featherless API Service Busy (${fallbackErr.message || lastVisionErr?.message}). Please try again in a few seconds.`);
      }
    }

    try {
      return await this.client.chatCompletion({
        model: selectedModel,
        messages,
        tools
      });
    } catch (err) {
      console.warn(`[Model Router] Primary model ${selectedModel} failed (${err.message}). Retrying with fast model Qwen/Qwen2.5-7B-Instruct after 1500ms delay...`);
      await new Promise(resolve => setTimeout(resolve, 1500));

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
