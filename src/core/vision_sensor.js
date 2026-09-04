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
          return match[1].trim();
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

    const payload = {
      system_instruction: {
        parts: [{
          text: systemPrompt || 'You are FahOS Vision Assistant. Inspect the attached image carefully and answer the user\'s question directly based on what is shown on screen. Focus on the actual content (text, code, data, errors, diagrams) rather than describing UI layout or chrome.'
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
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'
    ];

    for (const endpoint of modelEndpoints) {
      const modelName = endpoint.split('/models/')[1]?.split(':')[0];
      for (let attempt = 1; attempt <= 3; attempt++) {
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
            if ((response.status === 503 || response.status === 429) && attempt < 3) {
              await new Promise(r => setTimeout(r, 1500));
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
          if (attempt < 3) {
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
