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

  let currentSnipImage = null;
  const snipPreviewContainer = document.getElementById('snip-preview-container');
  const snipThumbnail = document.getElementById('snip-thumbnail');
  const btnRemoveSnip = document.getElementById('btn-remove-snip');

  function clearSnipAttachment() {
    currentSnipImage = null;
    if (snipPreviewContainer) snipPreviewContainer.style.display = 'none';
    if (snipThumbnail) snipThumbnail.src = '';
  }

  if (btnRemoveSnip) {
    btnRemoveSnip.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSnipAttachment();
      cmdInput.focus();
      updateStatus('FahOS is active', '#10B981');
    });
  }

  // 3. Command Sending Logic
  function handleSend(overrideText) {
    const text = (overrideText || cmdInput.value).trim();
    if (!text && !currentSnipImage) return;

    const queryText = text || (currentSnipImage ? 'Inspect this screen capture image carefully and explain what is shown on screen.' : '');

    updateStatus('FahOS is thinking...', '#38BDF8');

    if (responseContainer) {
      responseContainer.style.display = 'flex';
      const actionTree = document.getElementById('action-tree');
      if (actionTree) {
        actionTree.innerHTML = `
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
        window.fahosAPI.resizeHUDHeight(265);
      }
    }

    if (window.fahosAPI) {
      window.fahosAPI.sendMessage(queryText, currentSnipImage);
    }

    clearSnipAttachment();
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

  function parseMarkdownToHTML(md) {
    if (!md) return '';
    let html = md.trim();

    // 1. Extract Code Blocks into placeholders
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      codeBlocks.push(code.trim());
      return `%%%CODEBLOCK${codeBlocks.length - 1}%%%`;
    });

    // 2. Extract & Parse Tables into placeholders
    const tableBlocks = [];

    // 2a. ASCII Box / Grid Tables (+-----+-----+ / |---|---|)
    const asciiTableRegex = /((?:\+[----+=\s]+\+\r?\n)(?:[|+][^\n]+\r?\n)*\+?[----+=\s]+\+?)/g;
    html = html.replace(asciiTableRegex, (match) => {
      const lines = match.trim().split(/\r?\n/);
      const dataLines = lines.filter(l => l.trim().startsWith('|'));
      if (dataLines.length === 0) return match;

      let tableHtml = '<div class="table-wrapper"><table class="md-table">';
      dataLines.forEach((line, index) => {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (index === 0) {
          tableHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
      });
      tableHtml += '</tbody></table></div>';
      tableBlocks.push(tableHtml);
      return `\n\n%%%TABLEBLOCK${tableBlocks.length - 1}%%%\n\n`;
    });

    // 2b. Markdown Pipe Tables (| ... |)
    const pipeTableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
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

    // 3. Escape HTML outside code blocks and tables
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 4. Blockquotes
    html = html.replace(/^\s*&gt;\s+(.*)$/gim, '<blockquote class="md-blockquote">$1</blockquote>');

    // 5. Inline Code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // 6. Headings (from h6 to h1 so longest match takes precedence)
    html = html.replace(/^###### (.*$)/gim, '<h6 class="md-h6">$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5 class="md-h5">$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

    // 7. Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // 8. Lists (supporting hyphen -, asterisk *, bullet •)
    html = html.replace(/^\s*[-*•]\s+(.*)$/gim, '<li class="md-list-item">$1</li>');
    html = html.replace(/(<li class="md-list-item">.*<\/li>\s*)+/g, '<ul class="md-list">$&</ul>');

    html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li class="md-num-item">$1</li>');
    html = html.replace(/(<li class="md-num-item">.*<\/li>\s*)+/g, '<ol class="md-num-list">$&</ol>');

    // 9. Line Breaks & Paragraph Gaps
    html = html.replace(/\n\n/g, '<div class="md-p-gap"></div>');
    html = html.replace(/\n/g, '<br/>');

    // 10. Restore Table Blocks
    html = html.replace(/%%%TABLEBLOCK(\d+)%%%/g, (match, index) => {
      return tableBlocks[index];
    });

    // 11. Restore Code Blocks
    html = html.replace(/%%%CODEBLOCK(\d+)%%%/g, (match, index) => {
      const rawCode = codeBlocks[index];
      const escapedCode = rawCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<div class="code-block-wrapper"><pre><code>${escapedCode}</code></pre></div>`;
    });

    return html;
  }

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
      window.fahosAPI.resetHUDSize();
      updateStatus('FahOS is active', '#10B981');
    });

    btnSnip.addEventListener('click', (e) => {
      e.stopPropagation();
      window.fahosAPI.startSnip();
    });

    window.fahosAPI.onTriggerSnip(() => {
      window.fahosAPI.startSnip();
    });

    window.fahosAPI.onSnipCaptured((event, dataUrl) => {
      currentSnipImage = dataUrl;
      if (snipThumbnail) snipThumbnail.src = dataUrl;
      if (snipPreviewContainer) snipPreviewContainer.style.display = 'block';
      cmdInput.focus();
      updateStatus('✂ Screen Snip Attached (Ready to Ask)', '#38BDF8');
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
          const formattedHTML = parseMarkdownToHTML(rawAnswer);

          actionTree.innerHTML = `
            <div class="ai-reply-text">
              ${formattedHTML}
            </div>
          `;
        }

        // Dynamically auto-expand window height based on response content up to 850px max
        setTimeout(() => {
          const scrollH = responseContainer.scrollHeight;
          const targetHeight = Math.min(850, Math.max(265, 140 + scrollH));
          window.fahosAPI.resizeHUDHeight(targetHeight);
        }, 30);

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
