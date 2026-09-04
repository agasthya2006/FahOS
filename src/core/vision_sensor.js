const fs = require('fs');
const path = require('path');

class VisionSensor {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || this.loadKeyFromEnvFile();
  }

  loadKeyFromEnvFile() {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
        if (match && match[1]) {
          return match[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {
      console.warn('[VisionSensor] Could not read .env file:', e.message);
    }
    return null;
  }

  async analyzeImage({ systemPrompt, userPrompt, imageBase64, mime = 'image/jpeg' }) {
    if (!imageBase64) return null;

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    if (!this.apiKey) {
      console.warn('[VisionSensor] No GEMINI_API_KEY configured in .env. Falling back to direct Featherless vision pool.');
      return null;
    }

    const effectivePrompt = userPrompt || 'Explain what is shown on this screen capture in detail.';

    const defaultVisionInstruction = `You are FahOS Vision Assistant. Always respond in fluent, natural English.
Your response MUST follow this clean, human-readable structure:
1. Begin with a clear, readable paragraph (2-4 sentences) explaining the main content, concept, or problem shown on screen.
2. If the topic is complex or has multiple components, follow up with clean bullet points (- **Key Point**: explanation).
3. NEVER output LaTeX math symbols, code-like dollar wrappers (like $\\mu$, $\\sigma^2$, or $$), or raw formula noise. Express all concepts, formulas, and numbers in plain, natural human words.
4. NEVER describe screen size, window dimensions, display resolution, UI coordinates, or interface layout unless specifically asked by the user. Focus strictly on the actual content shown.`;

    const payload = {
      system_instruction: {
        parts: [{
          text: systemPrompt || defaultVisionInstruction
        }]
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: effectivePrompt },
            {
              inline_data: {
                mime_type: mime,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    };

    const modelEndpoints = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent'
    ];

    for (const endpoint of modelEndpoints) {
      const modelName = endpoint.split('/models/')[1]?.split(':')[0];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[VisionSensor] Analyzing image directly via Gemini (${modelName}, attempt ${attempt})...`);
          const response = await fetch(`${endpoint}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errText = await response.text();
            console.warn(`[VisionSensor ${modelName} ${response.status}]:`, errText.slice(0, 200));
            // On 404 or 429, immediately break and switch to next model
            if (response.status === 404 || response.status === 429) {
              console.warn(`[VisionSensor] ${response.status} on ${modelName}, immediately switching to next model...`);
              break;
            }
            if (response.status === 503 && attempt < 2) {
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            break;
          }

          const data = await response.json();
          const answer = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
          if (answer) {
            console.log('[VisionSensor] Image analysis completed successfully!');
            return answer;
          }
        } catch (err) {
          console.warn(`[VisionSensor Error on ${modelName}, attempt ${attempt}]:`, err.message);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          break;
        }
      }
    }

    return null;
  }

  async extractVisualContext(imageBase64, userPrompt = '') {
    return this.analyzeImage({
      systemPrompt: 'Read and transcribe the actual content shown on this screen — all text, code, data, error messages. Focus only on what the user would want explained.',
      userPrompt,
      imageBase64
    });
  }
}

module.exports = VisionSensor;
