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
    if (hasImage || /screen|image|screenshot|look|see|vision|window/i.test(prompt)) {
      return 'vision';
    }

    const trimmed = prompt.trim();

    // Informational / Explanatory queries must never trigger fast-path actions
    const isInformational = /^(?:tell\s+me|tell\s+us|what\s+is|what\s+are|what\s+was|how\s+to|how\s+do|how\s+does|why\s+is|why\s+are|explain|who\s+is|who\s+was|describe|define|teach\s+me|can\s+you\s+explain)\b/i.test(trimmed);

    if (!isInformational) {
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

      // 4. Notepad Quick Note
      if (/^(?:open\s+notepad\s+and\s+(?:write|note\s+down)\s+|take\s+a\s+note\s+(?:saying\s+|that\s+)?|write\s+note\s+).+$/i.test(trimmed)) {
        return 'fastpath_note';
      }

      // 5. WhatsApp Message
      if (/^(?:(?:open\s+)?whatsapp\s+(?:and\s+)?(?:send\s+(?:a\s+)?message\s+)?|send\s+(?:a\s+)?(?:whatsapp\s+)?message\s+(?:saying\s+|that\s+|to\s+say\s+)?).+$/i.test(trimmed)) {
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
      if (/^(?:compose\s+(?:an?\s+)?email|send\s+(?:an?\s+)?email|email)\s+(?:to\s+)?.+$/i.test(trimmed)) {
        return 'fastpath_email';
      }

      // 9. Master Directive: Web Task Routing via FahOS Unified Browser
      const BROWSER_TASK_SIGNALS = [
        /\b(?:search|look\s+up|find|play|check|get|read|navigate|fetch)\s+.*?\s+(?:on|in|using|from)\s+(?:youtube|yt|google|amazon|wikipedia|reddit|github|twitter|x|linkedin|spotify|medium|stackoverflow)\b/i,
        /^(?:open|launch)\s+(?:youtube|yt|google|amazon|wikipedia|reddit|github)\s+(?:and\s+)?(?:search|look\s+up|find|play)\s+(.+)$/i,
        /^(?:search|google|look\s+up)\s+(?:for\s+)?(.+)$/i,
        /\b(?:youtube|yt)\s+(?:search|play)\s+(.+)$/i,
        /\b(?:wikipedia|wiki)\s+(?:search|summary)\s+(.+)$/i,
        /\b(?:amazon)\s+(?:search|find|price)\s+(.+)$/i,
        /\b(?:and\s+(?:tell|show|find|get|search|look|check|read|navigate|fetch|go|click|type|enter|fill)|tell\s+me|find\s+out|how\s+many|what\s+is|what'?s|look\s+up|check\s+for|read\s+about)\b/i
      ];

      if (BROWSER_TASK_SIGNALS.some(pattern => pattern.test(trimmed))) {
        return 'fastpath_browsertask';
      }

      // 10. General Web Search
      if (/^(?:search\s+(?:google|web|for)?\s+.+|(?:google|search)\s+.+)$/i.test(trimmed)) {
        return 'fastpath_browsertask';
      }

      // 11. Close Application
      if (/^(?:close|quit|exit|terminate|kill)(?:\s+(?:the\s+)?app)?\s+([a-zA-Z0-9_\s\-\.]+)$/i.test(trimmed)) {
        return 'fastpath_close';
      }

      // 12. Open App, Directory, or Local File
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
