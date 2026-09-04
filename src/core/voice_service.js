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
          return match[1].trim();
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

    // 2. High-Accuracy Audio Transcription via Gemini 3.5 Flash Audio
    if (this.geminiApiKey) {
      try {
        console.log('[VoiceService] Transcribing audio with Gemini 3.5 Flash...');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${this.geminiApiKey}`;

        const payload = {
          contents: [{
            parts: [
              {
                text: 'You are an accurate English speech transcriber. Transcribe all spoken words in this audio verbatim. STRICT: Return ONLY the exact spoken English transcription. If silent or unintelligible, return an empty string. Do NOT add preamble or quotes.'
              },
              {
                inlineData: {
                  mimeType: mimeType.split(';')[0] || 'audio/webm',
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
          if (candidateText && !/silent|unintelligible|no speech/i.test(candidateText)) {
            console.log('[VoiceService Gemini Audio] Raw Transcription:', candidateText);
            return candidateText;
          }
        } else {
          console.warn(`[VoiceService] Gemini Audio responded with ${res.status}`);
        }
      } catch (err) {
        console.warn('[VoiceService Gemini Audio Error]:', err.message);
      }
    }

    return '';
  }

  /**
   * Refines raw speech with Featherless AI (Qwen2.5-7B) to remove fillers, stutters, and fix tech jargon
   * @param {string} rawSpeechText
   */
  async refineWithFeatherless(rawSpeechText) {
    if (!rawSpeechText || !rawSpeechText.trim()) {
      return '';
    }

    const trimmed = rawSpeechText.trim();

    try {
      console.log('[VoiceService] Refining voice transcript with Featherless AI (Qwen2.5-7B)...');
      const message = await this.featherlessClient.chatCompletion({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          {
            role: 'system',
            content: `You are an expert voice command refiner for the FahOS AI assistant.
Your task is to take raw, messy speech audio transcriptions and convert them into a clean, accurate prompt or Windows OS command.

STRICT RULES:
1. Strip all vocal hesitation, repetitions, and filler words ("um", "uh", "ah", "like", "you know", "er", "so yeah").
2. Correct common speech recognition misspellings and technical terms (e.g. "power shell" -> "PowerShell", "git commit minus m" -> "git commit -m", "npm run dev" -> "npm run dev", "vs code" -> "VS Code", "get child item" -> "Get-ChildItem").
3. Preserve the user's exact query or automation intent.
4. DO NOT answer the question. DO NOT add conversational chit-chat, notes, or explanations.
5. Output ONLY the refined plain text string without quotes.`
          },
          {
            role: 'user',
            content: trimmed
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      });

      const refined = message?.content ? message.content.trim().replace(/^["']|["']$/g, '') : trimmed;
      console.log('[VoiceService] Featherless Refined Result:', refined);
      return refined || trimmed;
    } catch (err) {
      console.warn('[VoiceService Featherless Refinement Error]:', err.message);
      return trimmed;
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
