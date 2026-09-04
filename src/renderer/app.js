document.addEventListener('DOMContentLoaded', () => {
  // DOM Element Selectors
  const widget = document.getElementById('widget');
  const promptInput = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');
  const micIconBtn = document.getElementById('micIconBtn');
  const micBtn = document.getElementById('micBtn');
  const micStatus = document.getElementById('micStatus');
  const closeBtn = document.getElementById('closeBtn');
  const resetSizeBtn = document.getElementById('resetSizeBtn');
  const openBrowserBtn = document.getElementById('openBrowserBtn');

  // Droplet Menu Elements
  const dropletMenuWrapper = document.getElementById('dropletMenuWrapper');
  const dropletTriggerBtn = document.getElementById('dropletTriggerBtn');
  const snipBtn = document.getElementById('snipBtn');
  const phonebookBtn = document.getElementById('phonebookBtn');
  const historyBtn = document.getElementById('historyBtn');

  // Views
  const chatView = document.getElementById('chatView');
  const historyView = document.getElementById('historyView');
  const historyBackBtn = document.getElementById('historyBackBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const historyCountBadge = document.getElementById('historyCountBadge');

  const phonebookView = document.getElementById('phonebookView');
  const phonebookBackBtn = document.getElementById('phonebookBackBtn');
  const phonebookList = document.getElementById('phonebookList');
  const phonebookCountBadge = document.getElementById('phonebookCountBadge');
  const contactNameInput = document.getElementById('contactNameInput');
  const contactPhoneInput = document.getElementById('contactPhoneInput');
  const contactEmailInput = document.getElementById('contactEmailInput');
  const saveContactBtn = document.getElementById('saveContactBtn');

  // Attached Snip Image Elements
  const attachedImagePill = document.getElementById('attachedImagePill');
  const attachedThumbImg = document.getElementById('attachedThumbImg');
  const removeImageBtn = document.getElementById('removeImageBtn');

  // Response & Status Elements
  const responseContainer = document.getElementById('responseContainer');
  const actionTree = document.getElementById('actionTree');
  const pillIcon = document.getElementById('pillIcon');
  const pillText = document.getElementById('pillText');
  const pillStatus = document.getElementById('pillStatus');
  const bottomResizeHandle = document.getElementById('bottomResizeHandle');

  let currentSnipImage = null;
  let lastUserPrompt = '';
  let isListening = false;
  let isResizing = false;
  let startY = 0;
  let startHeight = 265;

  // Status Pill Updater
  function updateStatus(text, badgeColor = '#38BDF8', icon = '✦') {
    if (pillText) pillText.textContent = text;
    if (pillIcon) pillIcon.textContent = icon;
    if (pillStatus) {
      pillStatus.textContent = '●';
      pillStatus.style.color = badgeColor;
    }
  }

  // View Switcher (Chat / History / Directory)
  function switchView(view) {
    if (dropletMenuWrapper) dropletMenuWrapper.classList.remove('open');

    if (view === 'history') {
      if (chatView) chatView.classList.add('hidden');
      if (phonebookView) phonebookView.classList.add('hidden');
      if (historyView) historyView.classList.remove('hidden');
      renderHistory();
    } else if (view === 'phonebook') {
      if (chatView) chatView.classList.add('hidden');
      if (historyView) historyView.classList.add('hidden');
      if (phonebookView) phonebookView.classList.remove('hidden');
      renderPhonebook();
    } else {
      if (historyView) historyView.classList.add('hidden');
      if (phonebookView) phonebookView.classList.add('hidden');
      if (chatView) chatView.classList.remove('hidden');
      if (promptInput) promptInput.focus();
    }
  }

  // 1. Esc Key to immediately dismiss window
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (historyView && !historyView.classList.contains('hidden')) {
        switchView('chat');
        return;
      }
      if (phonebookView && !phonebookView.classList.contains('hidden')) {
        switchView('chat');
        return;
      }
      if (window.fahosAPI) {
        window.fahosAPI.closeHUD();
      }
    }
  });

  // 2. Droplet Menu Speed-Dial Toggle (+ rotates to x)
  if (dropletTriggerBtn && dropletMenuWrapper) {
    dropletTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropletMenuWrapper.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropletMenuWrapper.contains(e.target)) {
        dropletMenuWrapper.classList.remove('open');
      }
    });
  }

  // 3. Screen Snip Button
  if (snipBtn && window.fahosAPI) {
    snipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropletMenuWrapper) dropletMenuWrapper.classList.remove('open');
      window.fahosAPI.startSnip();
    });
  }

  // 4. Directory & History View Buttons
  if (historyBtn) {
    historyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchView('history');
    });
  }
  if (historyBackBtn) {
    historyBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchView('chat');
    });
  }

  if (phonebookBtn) {
    phonebookBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchView('phonebook');
    });
  }
  if (phonebookBackBtn) {
    phonebookBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchView('chat');
    });
  }

  // 5. Option 2: High-Accuracy Voice Engine (16kHz PCM WAV Capture + Whisper/Gemini + Featherless AI Refiner)
  let mediaRecorder = null;
  let audioStream = null;
  let audioChunks = [];

  // Encode 16kHz mono Float32Array samples into standard 16-bit PCM WAV
  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Uint8Array(buffer);
  }

  async function startListening() {
    if (isListening) return;
    try {
      audioChunks = [];
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      mediaRecorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioStream) {
          audioStream.getTracks().forEach(t => t.stop());
          audioStream = null;
        }

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];

        if (audioBlob.size < 400) {
          updateStatus('Too short — speak longer', '#F59E0B', '⚠');
          if (micStatus) micStatus.textContent = 'Muted';
          setTimeout(() => updateStatus('FahOS Ready', '#38BDF8', '✦'), 2000);
          return;
        }

        updateStatus('Polishing with Featherless AI...', '#A855F7', '⚡');
        if (micStatus) micStatus.textContent = 'Polishing...';

        try {
          // Decode audio into 16kHz mono Float32 samples and convert to 16-bit PCM WAV
          const rawArrayBuffer = await audioBlob.arrayBuffer();
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioContextClass({ sampleRate: 16000 });
          const decoded = await audioCtx.decodeAudioData(rawArrayBuffer);
          const samples = decoded.getChannelData(0);
          const wavBytes = encodeWav(samples, 16000);
          audioCtx.close().catch(() => {});

          const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
          const reader = new FileReader();

          reader.onloadend = async () => {
            try {
              const dataUrl = reader.result;
              const base64Audio = (dataUrl && typeof dataUrl === 'string') ? dataUrl.split(',')[1] : null;

              if (!base64Audio) {
                throw new Error('Failed to encode audio to base64');
              }

              if (window.fahosAPI && window.fahosAPI.processVoiceInput) {
                const response = await window.fahosAPI.processVoiceInput({
                  audioBase64: base64Audio,
                  mimeType: 'audio/wav'
                });

                if (response && response.ok && response.refinedText) {
                  if (promptInput) {
                    promptInput.value = response.refinedText;
                    promptInput.focus();
                    promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
                  }
                  updateStatus('Review & press Enter to send', '#10B981', '✦');
                  setTimeout(() => {
                    updateStatus('FahOS Ready', '#38BDF8', '✦');
                  }, 3500);
                } else {
                  updateStatus('No speech detected — try again', '#F59E0B', '⚠');
                  setTimeout(() => updateStatus('FahOS Ready', '#38BDF8', '✦'), 2500);
                }
              }
            } catch (innerErr) {
              console.error('[Voice Callback Error]:', innerErr);
              updateStatus('Voice error — try again', '#EF4444', '✕');
              setTimeout(() => updateStatus('FahOS Ready', '#38BDF8', '✦'), 2500);
            } finally {
              if (micStatus) micStatus.textContent = 'Muted';
            }
          };

          reader.readAsDataURL(wavBlob);
        } catch (err) {
          console.error('[Voice Processing Error]:', err);
          updateStatus('Voice error', '#EF4444', '✕');
          if (micStatus) micStatus.textContent = 'Muted';
          setTimeout(() => updateStatus('FahOS Ready', '#38BDF8', '✦'), 2000);
        }
      };

      mediaRecorder.start(100);
      isListening = true;

      if (micIconBtn) micIconBtn.classList.add('active');
      if (micBtn) micBtn.classList.add('active');
      if (micStatus) micStatus.textContent = 'Listening';
      updateStatus('FahOS is listening...', '#EF4444', '🎙️');
    } catch (err) {
      console.error('[Microphone Access Error]:', err);
      updateStatus('Microphone denied', '#EF4444', '✕');
      isListening = false;
      if (micIconBtn) micIconBtn.classList.remove('active');
      if (micBtn) micBtn.classList.remove('active');
      if (micStatus) micStatus.textContent = 'Muted';
      setTimeout(() => updateStatus('FahOS Ready', '#38BDF8', '✦'), 2500);
    }
  }

  function stopListening() {
    if (!isListening) return;
    isListening = false;

    if (micIconBtn) micIconBtn.classList.remove('active');
    if (micBtn) micBtn.classList.remove('active');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  const toggleMic = (e) => {
    e.stopPropagation();
    if (!isListening) {
      startListening();
    } else {
      stopListening();
    }
  };

  if (micIconBtn) micIconBtn.addEventListener('click', toggleMic);
  if (micBtn) micBtn.addEventListener('click', toggleMic);

  // 6. Snip Attachment Controls
  function clearSnipAttachment() {
    currentSnipImage = null;
    if (attachedImagePill) {
      attachedImagePill.classList.add('hidden');
    }
    if (attachedThumbImg) {
      attachedThumbImg.src = '';
    }
    if (promptInput) {
      promptInput.placeholder = 'Type or speak, then press Enter or click Send...';
    }
    updateStatus('FahOS Ready', '#38BDF8', '✦');
  }

  function attachSnippedImage(dataUrl) {
    if (!dataUrl) return;
    currentSnipImage = dataUrl;
    if (attachedThumbImg) {
      attachedThumbImg.src = dataUrl;
    }
    if (attachedImagePill) {
      attachedImagePill.classList.remove('hidden');
    }
    if (promptInput) {
      promptInput.placeholder = 'Ask a question about this snip, or press Enter/Send...';
      promptInput.focus();
    }
    updateStatus('Region attached — add prompt & press Send', '#10B981', '✂');
  }

  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSnipAttachment();
      if (promptInput) promptInput.focus();
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 7. Command Sending Logic
  function handleSend(overrideText) {
    const text = (overrideText || promptInput.value).trim();
    if (!text && !currentSnipImage) return;

    const queryText = text || (currentSnipImage ? 'Inspect this screen capture snippet carefully and explain what is shown on screen.' : '');
    lastUserPrompt = queryText;

    updateStatus('FahOS is thinking...', '#38BDF8', '🧠');

    if (responseContainer && actionTree) {
      responseContainer.style.display = 'flex';
      actionTree.innerHTML = `
        <div class="user-query-card">
          <span class="user-query-icon">💬</span>
          <span class="user-query-text">${escapeHTML(lastUserPrompt)}</span>
        </div>
        <div class="thinking-box">
          <span class="thinking-icon">🧠</span>
          <span class="thinking-text">Thinking</span>
          <div class="thinking-dots">
            <span class="dot-anim"></span>
            <span class="dot-anim"></span>
            <span class="dot-anim"></span>
          </div>
        </div>
      `;
    }

    if (window.fahosAPI) {
      window.fahosAPI.sendMessage(queryText, currentSnipImage);
    }

    clearSnipAttachment();
    promptInput.value = '';
  }

  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSend();
    });
  }

  // 8. Markdown Parser
  function parseMarkdownToHTML(md) {
    if (!md) return '';
    let html = md.trim();

    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      codeBlocks.push(code.trim());
      return `%%%CODEBLOCK${codeBlocks.length - 1}%%%`;
    });

    const pipeTableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
    const tableBlocks = [];
    html = html.replace(pipeTableRegex, (match) => {
      const lines = match.trim().split(/\r?\n/).filter(line => line.trim().startsWith('|'));
      if (lines.length < 2) return match;

      let tableHtml = '<div class="table-wrapper"><table class="md-table">';
      let headerDone = false;

      lines.forEach((line) => {
        const isSeparator = /^\|?[\s:\-\|]+$/.test(line) && line.includes('-');
        if (isSeparator) return;

        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (!headerDone) {
          tableHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
          headerDone = true;
        } else {
          tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
      });

      tableHtml += '</tbody></table></div>';
      tableBlocks.push(tableHtml);
      return `\n\n%%%TABLEBLOCK${tableBlocks.length - 1}%%%\n\n`;
    });

    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/^\s*&gt;\s+(.*)$/gim, '<blockquote class="md-blockquote">$1</blockquote>');
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*•]\s+(.*)$/gim, '<li class="md-list-item">$1</li>');
    html = html.replace(/(<li class="md-list-item">.*<\/li>\s*)+/g, '<ul class="md-list">$&</ul>');
    html = html.replace(/\n\n/g, '<div class="md-p-gap"></div>');
    html = html.replace(/\n/g, '<br/>');

    html = html.replace(/%%%TABLEBLOCK(\d+)%%%/g, (match, index) => tableBlocks[index]);
    html = html.replace(/%%%CODEBLOCK(\d+)%%%/g, (match, index) => {
      const rawCode = codeBlocks[index];
      const escapedCode = rawCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="code-block-wrapper"><pre><code>${escapedCode}</code></pre></div>`;
    });

    return html;
  }

  // Resets the UI completely to open a fresh new chat session
  function resetToFreshChat() {
    stopListening();
    // 1. Clear text input
    if (promptInput) {
      promptInput.value = '';
      promptInput.placeholder = 'Type or speak, then press Enter or click Send...';
    }

    // 2. Hide and clear previous AI response
    if (responseContainer) {
      responseContainer.style.display = 'none';
    }
    if (actionTree) {
      actionTree.innerHTML = '';
    }

    // 3. Clear any attached screen snip image
    clearSnipAttachment();

    // 4. Return from History/Directory back to main Chat View
    switchView('chat');

    // 5. Reset status pill to ready
    updateStatus('FahOS Ready', '#38BDF8', '✦');

    // 6. Reset window height to initial default 265px
    if (window.fahosAPI && window.fahosAPI.resetHUDSize) {
      window.fahosAPI.resetHUDSize();
    }

    // 7. Focus cursor back into text input
    setTimeout(() => {
      if (promptInput) promptInput.focus();
    }, 50);
  }

  // 9. Window Header Controls
  if (window.fahosAPI) {
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.fahosAPI.closeHUD();
      });
    }

    if (resetSizeBtn) {
      resetSizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetToFreshChat();
      });
    }

    if (openBrowserBtn) {
      openBrowserBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.fahosAPI && window.fahosAPI.openBrowser) {
          const query = promptInput ? promptInput.value.trim() : '';
          if (query) {
            if (query.startsWith('http://') || query.startsWith('https://')) {
              window.fahosAPI.openBrowser(query);
            } else {
              window.fahosAPI.openBrowser(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            }
          } else {
            window.fahosAPI.openBrowser('https://www.google.com');
          }
        }
      });
    }

    window.fahosAPI.onAppear(() => {
      console.log('[FahOS UI] Reopened via Ctrl+Space — resetting to fresh chat session.');
      resetToFreshChat();
    });

    window.fahosAPI.onFocusInput(() => {
      if (promptInput) promptInput.focus();
    });

    window.fahosAPI.onTriggerSnip(() => {
      window.fahosAPI.startSnip();
    });

    window.fahosAPI.onSnipCaptured((event, dataUrl) => {
      attachSnippedImage(dataUrl);
    });

    window.fahosAPI.onAgentStatusUpdate((event, statusText) => {
      const cleanText = /model|gemini|featherless|qwen|llama|instruct|see:|understand:|plan:/i.test(statusText)
        ? 'FahOS is thinking...'
        : statusText;
      updateStatus(cleanText, '#0EA5E9');
    });

    window.fahosAPI.onAgentResponse((event, result) => {
      if (result && result.success && responseContainer) {
        responseContainer.style.display = 'flex';

        if (actionTree) {
          const rawAnswer = result.answerText || (result.plan ? result.plan.summary : 'Response received.');
          const formattedHTML = parseMarkdownToHTML(rawAnswer);

          actionTree.innerHTML = `
            <div class="user-query-card">
              <span class="user-query-icon">💬</span>
              <span class="user-query-text">${escapeHTML(lastUserPrompt)}</span>
            </div>
            <div class="ai-reply-text">
              ${formattedHTML}
            </div>
          `;

          // Save to local history
          saveHistoryItem(lastUserPrompt, rawAnswer);
        }

        updateStatus('✓ Done ✓', '#10B981');
      } else {
        const errDetail = (result && result.error) ? result.error : ((result && result.answerText) ? result.answerText : 'Service temporarily busy');
        const errTitle = (result && result.answerText && !result.error) ? 'Unable to Complete Request' : 'Service Temporarily Busy';
        if (actionTree) {
          actionTree.innerHTML = `
            <div class="error-card">
              <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span class="error-title">${errTitle}</span>
              </div>
              <div class="error-body">${errDetail}</div>
              <button class="retry-btn" id="btn-retry-query">🔄 Retry Query</button>
            </div>
          `;
          const btnRetry = document.getElementById('btn-retry-query');
          if (btnRetry) {
            btnRetry.addEventListener('click', (e) => {
              e.stopPropagation();
              handleSend(lastUserPrompt);
            });
          }
        }
        updateStatus('FahOS Error (Click Retry)', '#EF4444');
      }
    });
  }

  // 10. Local Storage History Management
  function getHistory() {
    try {
      const data = localStorage.getItem('fahos_history');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistoryItem(query, response) {
    if (!query && !response) return;
    try {
      const history = getHistory();
      history.unshift({
        query: String(query).trim(),
        response: String(response).trim(),
        timestamp: new Date().toISOString()
      });
      if (history.length > 100) history.length = 100;
      localStorage.setItem('fahos_history', JSON.stringify(history));
    } catch (_) {}
  }

  function renderHistory() {
    if (!historyList) return;
    const history = getHistory();
    if (historyCountBadge) historyCountBadge.textContent = history.length;

    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty"><div class="history-empty-title">No History Yet</div><div class="history-empty-desc">Your questions and answers are saved here.</div></div>';
      return;
    }

    historyList.innerHTML = history.map((item, idx) => {
      const formattedA = parseMarkdownToHTML(item.response);
      const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      // Check if the AI response is long (> 130 characters or multi-line)
      const isLong = item.response && (item.response.length > 130 || item.response.includes('\n'));
      const answerClass = isLong ? 'history-ai-answer collapsed' : 'history-ai-answer';
      const expandBtnHtml = isLong
        ? `<button class="history-expand-btn" data-idx="${idx}"><span>Show More ▾</span></button>`
        : '';

      return `
        <div class="history-card" data-idx="${idx}">
          <div class="history-card-top">
            <span class="history-time-badge">${timeStr}</span>
            <div class="history-card-actions">
              <button class="history-mini-btn copy-btn" data-text="${encodeURIComponent(item.response)}">Copy</button>
              <button class="history-mini-btn reuse-btn" data-query="${encodeURIComponent(item.query)}">Ask Again</button>
            </div>
          </div>
          <div class="history-user-query"><span class="history-role-tag">YOU</span><span>${escapeHTML(item.query)}</span></div>
          <div class="${answerClass}">${formattedA}</div>
          ${expandBtnHtml}
        </div>
      `;
    }).join('');

    // Attach click listener to all 'Show More' / 'Show Less' buttons
    historyList.querySelectorAll('.history-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.history-card');
        if (!card) return;
        const answerEl = card.querySelector('.history-ai-answer');
        if (!answerEl) return;

        const isCollapsed = answerEl.classList.contains('collapsed');
        if (isCollapsed) {
          answerEl.classList.remove('collapsed');
          btn.innerHTML = '<span>Show Less ▴</span>';
        } else {
          answerEl.classList.add('collapsed');
          btn.innerHTML = '<span>Show More ▾</span>';
        }
      });
    });

    historyList.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(decodeURIComponent(btn.getAttribute('data-text') || ''));
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });

    historyList.querySelectorAll('.reuse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const q = decodeURIComponent(btn.getAttribute('data-query') || '');
        switchView('chat');
        if (promptInput) {
          promptInput.value = q;
          promptInput.focus();
        }
      });
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem('fahos_history');
      renderHistory();
    });
  }

  // 11. Local Storage Directory Management
  function getContacts() {
    try {
      const data = localStorage.getItem('fahos_contacts');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  function saveContact(name, phone, email) {
    const contacts = getContacts();
    contacts.unshift({ name, phone, email });
    localStorage.setItem('fahos_contacts', JSON.stringify(contacts));
  }

  function renderPhonebook() {
    if (!phonebookList) return;
    const contacts = getContacts();
    if (phonebookCountBadge) phonebookCountBadge.textContent = contacts.length;

    if (contacts.length === 0) {
      phonebookList.innerHTML = '<div class="history-empty"><div class="history-empty-title">Directory is Empty</div><div class="history-empty-desc">Add contacts above to quickly chat or email.</div></div>';
      return;
    }

    phonebookList.innerHTML = contacts.map((c, idx) => {
      const phoneHtml = c.phone ? `<span class="contact-phone">${escapeHTML(c.phone)}</span>` : '';
      const emailHtml = c.email ? `<span class="contact-email">${escapeHTML(c.email)}</span>` : '';
      const chatBtn = c.phone ? `<button class="contact-btn chat-btn" data-phone="${c.phone}">Chat</button>` : '';
      const emailBtn = c.email ? `<button class="contact-btn email-btn" data-email="${c.email}">Email</button>` : '';

      return `
        <div class="phonebook-card">
          <div class="contact-info">
            <span class="contact-name">${escapeHTML(c.name)}</span>
            <div class="contact-meta">${phoneHtml}${emailHtml}</div>
          </div>
          <div class="contact-actions">${chatBtn}${emailBtn}</div>
        </div>
      `;
    }).join('');

    phonebookList.querySelectorAll('.chat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = btn.getAttribute('data-phone');
        window.open(`https://wa.me/${p.replace(/[^0-9]/g, '')}`, '_blank');
      });
    });

    phonebookList.querySelectorAll('.email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const em = btn.getAttribute('data-email');
        window.open(`mailto:${em}`, '_blank');
      });
    });
  }

  if (saveContactBtn) {
    saveContactBtn.addEventListener('click', () => {
      const name = (contactNameInput?.value || '').trim();
      const phone = (contactPhoneInput?.value || '').trim();
      const email = (contactEmailInput?.value || '').trim();
      if (!name) return;

      saveContact(name, phone, email);
      if (contactNameInput) contactNameInput.value = '';
      if (contactPhoneInput) contactPhoneInput.value = '';
      if (contactEmailInput) contactEmailInput.value = '';
      renderPhonebook();
    });
  }

  // 12. Draggable Bottom Resize Handle
  if (bottomResizeHandle && window.fahosAPI) {
    bottomResizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startY = e.screenY;
      startHeight = window.innerHeight;
      document.body.style.cursor = 'ns-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dy = e.screenY - startY;
      const newHeight = Math.min(920, Math.max(200, Math.round(startHeight + dy)));
      window.fahosAPI.resizeHUDHeight(newHeight);
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    });
  }

  // 13. Window Dragging (Strictly confined to widget header; never on UI body)
  let isDraggingWindow = false;
  let dragStartX = 0;
  let dragStartY = 0;
  const widgetHeader = document.querySelector('.widget-header');

  if (widgetHeader && window.fahosAPI) {
    widgetHeader.addEventListener('mousedown', (e) => {
      if (e.target.closest('input, textarea, button, .icon-btn, .droplet-item, .send-btn, .bottom-resize-handle, .remove-image-btn, .mic-icon-btn, .mic-toggle, .browser-icon-btn, .reset-size-btn, .close-icon')) {
        return;
      }
      isDraggingWindow = true;
      dragStartX = e.screenX;
      dragStartY = e.screenY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingWindow) return;
      const deltaX = e.screenX - dragStartX;
      const deltaY = e.screenY - dragStartY;
      dragStartX = e.screenX;
      dragStartY = e.screenY;
      window.fahosAPI.moveHUDBy(deltaX, deltaY);
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingWindow) {
        isDraggingWindow = false;
      }
    });
  }
});

