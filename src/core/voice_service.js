'use strict';

const fs = require('fs');
const path = require('path');
const FeatherlessClient = require('./featherless');

class VoiceService {
  constructor() {
    this.featherlessClient = new FeatherlessClient();
    this.geminiApiKey = process.env.GEMINI_API_KEY || this.loadKeyFromEnv('GEMINI_API_KEY');
    this.groqApiKey = process.env.GROQ_API_KEY || this.loadKeyFromEnv('GROQ_API_KEY');
  }

  loadKeyFromEnv(varName) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(new RegExp(`${varName}\\s*=\\s*(.*)`));
        if (match && match[1]) {
          return match[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {
      console.warn(`[VoiceService] Could not read ${varName} from .env:`, e.message);
    }
    return null;
  }

  /**
   * Transcribes raw audio using Groq Whisper Large-v3 or Gemini 3.5 Flash Audio
   * @param {string} audioBase64 - Base64 encoded audio bytes
   * @param {string} mimeType - e.g. 'audio/webm' or 'audio/wav'
   */
  async transcribeAudio(audioBase64, mimeType = 'audio/webm') {
    if (!audioBase64 || audioBase64.length < 50) {
      return '';
    }

    // 1. Primary: Groq Whisper Large-v3-Turbo if key is present
    if (this.groqApiKey) {
      try {
        console.log('[VoiceService] Transcribing with Groq Whisper Large-v3-Turbo...');
        const buffer = Buffer.from(audioBase64, 'base64');
        const formData = new FormData();
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), 'voice.webm');
        formData.append('language', 'en');
        formData.append('temperature', '0.0');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`
          },
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.text?.trim() || '';
          if (text) {
            console.log('[VoiceService Whisper] Raw Transcription:', text);
            return text;
          }
        } else {
          console.warn(`[VoiceService] Groq Whisper responded with ${res.status}`);
        }
      } catch (err) {
        console.warn('[VoiceService Groq Whisper Error]:', err.message);
      }
    }

    // 2. High-Accuracy Audio Transcription via Gemini 3.5 / 3.6 Flash Audio
    if (this.geminiApiKey) {
      const endpoints = [
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'
      ];

      for (const endpoint of endpoints) {
        try {
          const modelName = endpoint.split('/models/')[1]?.split(':')[0];
          console.log(`[VoiceService] Transcribing audio with ${modelName}...`);
          const url = `${endpoint}?key=${this.geminiApiKey}`;

          const payload = {
            contents: [{
              parts: [
                {
                  text: 'You are an accurate audio speech transcriber. Listen to the English speech in this audio and return ONLY the verbatim spoken words. If the audio has no speech or only silence/noise, respond with: NO_SPEECH. Never add quotes or conversational commentary.'
                },
                {
                  inlineData: {
                    mimeType: mimeType ? mimeType.split(';')[0] : 'audio/wav',
                    data: audioBase64
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 256
            }
          };

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const data = await res.json();
            const candidateText = data?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text?.trim() || '';
            if (candidateText && !/^(?:NO_SPEECH|silent|unintelligible|none|no speech)$/i.test(candidateText)) {
              console.log(`[VoiceService ${modelName}] Raw Transcription:`, candidateText);
              return candidateText;
            }
            if (/NO_SPEECH/i.test(candidateText)) {
              console.log(`[VoiceService ${modelName}] Detected silence / no speech in audio.`);
              return '';
            }
          } else {
            console.warn(`[VoiceService ${modelName}] responded with status ${res.status}`);
          }
        } catch (err) {
          console.warn('[VoiceService Gemini Audio Notice]:', err.message);
        }
      }
    }

    return '';
  }

  /**
   * Refines raw speech with Featherless AI (Qwen2.5-7B) to remove fillers, stutters, and fix tech jargon.
   * STRICT: Acts ONLY as a transcript cleaner/formatter. Never answers questions.
   * @param {string} rawSpeechText
   */
  async refineWithFeatherless(rawSpeechText) {
    if (!rawSpeechText || !rawSpeechText.trim()) {
      return '';
    }

    let cleaned = rawSpeechText.trim();

    // Fast deterministic normalization of common vocal fillers and tech terms
    cleaned = cleaned
      .replace(/^(?:(?:um|uh|er|ah|like|you know|so yeah)\s+)+/i, '')
      .replace(/\s+(?:(?:um|uh|er|ah|like|you know|so yeah)\s+)+/gi, ' ')
      .replace(/\bpower\s*shell\b/gi, 'PowerShell')
      .replace(/\bvs\s*code\b/gi, 'VS Code')
      .replace(/\bgit commit minus m\b/gi, 'git commit -m')
      .replace(/\bget child item\b/gi, 'Get-ChildItem')
      .replace(/\bnpm run dev\b/gi, 'npm run dev');

    // Detect if input is an informational or conversational question
    const isQuestion = /^(?:what|who|where|when|why|how|which|whose|whom|is|are|can|could|do|does|did|will|would|should|tell\s+me|explain)\b/i.test(cleaned);

    try {
      console.log('[VoiceService] Refining voice transcript with Featherless AI (Qwen2.5-7B)...');

      const fewShotPrompt = `You are an automated voice transcript cleaner. Your ONLY role is text normalization and correcting audio transcription slips.

ABSOLUTE CRITICAL RULES:
1. NEVER ANSWER ANY QUESTION.
2. NEVER PROVIDE DEFINITIONS, FACTS, OR EXPLANATIONS.
3. If the input is a question (e.g. "What is the full form of WHO"), your output MUST BE THE EXACT SAME QUESTION: "What is the full form of WHO?".
4. If the input is a command (e.g. "open notepad"), output the cleaned command: "Open Notepad".
5. Output ONLY the verbatim cleaned spoken text without quotes or preamble.

Examples:
Raw: um what is the full form of who
Cleaned: What is the full form of WHO?

Raw: who is the prime minister of india
Cleaned: Who is the Prime Minister of India?

Raw: open power shell and check git status
Cleaned: Open PowerShell and check git status

Raw: tell me about quantum computing
Cleaned: Tell me about quantum computing

Raw: ${cleaned}
Cleaned:`;

      const message = await this.featherlessClient.chatCompletion({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          {
            role: 'user',
            content: fewShotPrompt
          }
        ],
        temperature: 0.0,
        max_tokens: 100
      });

      let refined = message?.content ? message.content.trim().replace(/^["']|["']$/g, '').replace(/^Cleaned:\s*/i, '') : cleaned;

      // Question Guardrail: If user asked a question, but refiner returned an answer instead of a question
      const refinedIsQuestion = /^(?:what|who|where|when|why|how|which|whose|whom|is|are|can|could|do|does|did|will|would|should|tell\s+me|explain)\b/i.test(refined);
      if (isQuestion && !refinedIsQuestion) {
        console.warn(`[VoiceService] Refiner attempted to answer question ('${refined}') instead of preserving it. Keeping clean question: '${cleaned}'`);
        return cleaned;
      }

      console.log('[VoiceService] Featherless Refined Result:', refined);
      return refined || cleaned;
    } catch (err) {
      console.warn('[VoiceService Featherless Refinement Error]:', err.message);
      return cleaned;
    }
  }

  /**
   * End-to-end Option 2 pipeline:
   * 1. Audio buffer -> Acoustic Transcription (Whisper / Gemini)
   * 2. Raw Text -> Featherless AI Smart Command Refiner
   */
  async processVoiceInput(audioBase64, mimeType, speechFallback = '') {
    let rawText = '';

    if (audioBase64) {
      rawText = await this.transcribeAudio(audioBase64, mimeType);
    }

    // Fallback to browser's live speech text if acoustic audio capture was empty
    if (!rawText || rawText.length < 2) {
      rawText = speechFallback ? speechFallback.trim() : '';
    }

    if (!rawText) {
      return { ok: false, error: 'No audible speech detected.' };
    }

    // Pass through Featherless AI for 99% accuracy polish
    const polishedText = await this.refineWithFeatherless(rawText);

    return {
      ok: true,
      rawText,
      refinedText: polishedText
    };
  }
}

module.exports = new VoiceService();
