document.addEventListener('DOMContentLoaded', () => {
  const cmdInput = document.getElementById('cmd-input');
  const btnSend = document.getElementById('btn-send');
  const btnClose = document.getElementById('btn-close');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnSnip = document.getElementById('btn-snip');
  const btnWeb = document.getElementById('btn-web');
  const btnReset = document.getElementById('btn-reset');
  const badgeMic = document.getElementById('badge-mic');
  const statusPill = document.getElementById('status-pill');
  const resizeHandle = document.getElementById('resize-handle');
  const responseContainer = document.getElementById('response-container');

  let isListening = false;
  let isResizing = false;
  let startY = 0;
  let startHeight = 265;

  function updateStatus(text, color = '#10B981') {
    if (!statusPill) return;
    const textEl = statusPill.querySelector('.status-text');
    const dotEl = statusPill.querySelector('.status-dot');
    if (textEl) textEl.textContent = text;
    if (dotEl) dotEl.style.color = color;
  }

  // 1. Esc Key to immediately dismiss window
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (window.fahosAPI) {
        window.fahosAPI.closeHUD();
      }
    }
  });

  // 2. Mic Badge & Speech-to-Text Recognition Handler
  let recognition = null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (cmdInput) {
        cmdInput.value = transcript;
      }
    };

    recognition.onerror = (event) => {
      console.warn('[Speech Recognition Error]:', event.error);
      stopListening();
      updateStatus(`Mic Error: ${event.error}`, '#EF4444');
    };

    recognition.onend = () => {
      if (isListening) {
        stopListening();
        if (cmdInput && cmdInput.value.trim().length > 0) {
          handleSend();
        }
      }
    };
  }

  function startListening() {
    isListening = true;
    if (badgeMic) {
      badgeMic.classList.add('is-listening');
      const mutedEl = badgeMic.querySelector('.mic-content-muted');
      const listeningEl = badgeMic.querySelector('.mic-content-listening');
      if (mutedEl) mutedEl.style.display = 'none';
      if (listeningEl) listeningEl.style.display = 'flex';
    }
    updateStatus('FahOS is listening...', '#EF4444');
    if (recognition) {
      try { recognition.start(); } catch (e) {}
    }
  }

  function stopListening() {
    isListening = false;
    if (badgeMic) {
      badgeMic.classList.remove('is-listening');
      const mutedEl = badgeMic.querySelector('.mic-content-muted');
      const listeningEl = badgeMic.querySelector('.mic-content-listening');
      if (mutedEl) mutedEl.style.display = 'inline';
      if (listeningEl) listeningEl.style.display = 'none';
    }
    updateStatus('FahOS is active', '#10B981');
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
  }

  if (badgeMic) {
    badgeMic.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isListening) {
        startListening();
      } else {
        stopListening();
      }
    });
  }

  // 3. Command Sending Logic
  function handleSend(overrideText) {
    const text = (overrideText || cmdInput.value).trim();
    if (!text) return;

    updateStatus('FahOS is active (Processing...)', '#0EA5E9');

    if (window.fahosAPI) {
      window.fahosAPI.sendMessage(text);
    }
    cmdInput.value = '';
  }

  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  });

  btnSend.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSend();
  });

  // 4. Header Control Buttons
  if (window.fahosAPI) {
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      window.fahosAPI.closeHUD();
    });

    btnMinimize.addEventListener('click', (e) => {
      e.stopPropagation();
      window.fahosAPI.minimizeHUD();
    });

    btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      if (responseContainer) responseContainer.style.display = 'none';
      window.fahosAPI.resetHUDSize();
      updateStatus('FahOS is active (Reset 265px)', '#10B981');
    });

    btnSnip.addEventListener('click', (e) => {
      e.stopPropagation();
      updateStatus('FahOS is active (Screen Snip)', '#F59E0B');
    });

    btnWeb.addEventListener('click', (e) => {
      e.stopPropagation();
      updateStatus('FahOS is active (Web Search)', '#38BDF8');
    });

    window.fahosAPI.onFocusInput(() => {
      cmdInput.focus();
    });

    window.fahosAPI.onAgentStatusUpdate((event, statusText) => {
      updateStatus(`FahOS is active: ${statusText}`, '#0EA5E9');
    });

    window.fahosAPI.onAgentResponse((event, result) => {
      if (result && result.success && responseContainer) {
        responseContainer.style.display = 'flex';

        const actionTree = document.getElementById('action-tree');
        if (actionTree) {
          const rawAnswer = result.answerText || (result.plan ? result.plan.summary : 'Response received.');
          const formattedText = rawAnswer
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');

          actionTree.innerHTML = `
            <div class="ai-reply-text">
              ${formattedText}
            </div>
          `;
        }

        // Dynamically auto-expand window height based on response content
        const contentHeight = Math.min(650, Math.max(265, 160 + responseContainer.scrollHeight));
        window.fahosAPI.resizeHUDHeight(contentHeight);

        updateStatus('✓ Done ✓', '#10B981');
      } else {
        const errDetail = (result && result.error) ? result.error : 'Inference Error';
        updateStatus(`FahOS is active (Error: ${errDetail})`, '#EF4444');
      }
    });
  }

  // 5. Draggable Bottom Resize Handle Logic
  if (resizeHandle && window.fahosAPI) {
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startY = e.clientY;
      startHeight = window.innerHeight;

      document.body.style.cursor = 'ns-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dy = e.clientY - startY;
      const newHeight = Math.min(920, Math.max(200, startHeight + dy));
      window.fahosAPI.resizeHUDHeight(newHeight);
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    });
  }
});
