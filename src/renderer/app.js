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

  // 5. Speech-to-Text Recognition Handler
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
      if (promptInput) {
        promptInput.value = transcript;
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
        if (promptInput && promptInput.value.trim().length > 0) {
          handleSend();
        }
      }
    };
  }

  function startListening() {
    isListening = true;
    if (micIconBtn) micIconBtn.classList.add('active');
    if (micBtn) micBtn.classList.add('active');
    if (micStatus) micStatus.textContent = 'Listening';
    updateStatus('FahOS is listening...', '#EF4444', '🎙️');
    if (recognition) {
      try { recognition.start(); } catch (e) {}
    }
  }

  function stopListening() {
    isListening = false;
    if (micIconBtn) micIconBtn.classList.remove('active');
    if (micBtn) micBtn.classList.remove('active');
    if (micStatus) micStatus.textContent = 'Muted';
    updateStatus('FahOS Ready', '#38BDF8', '✦');
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
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
    if (attachedImagePill) attachedImagePill.classList.add('hidden');
    if (attachedThumbImg) attachedThumbImg.src = '';
  }

  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSnipAttachment();
      if (promptInput) promptInput.focus();
      updateStatus('FahOS Ready', '#38BDF8');
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
        window.fahosAPI.resetHUDSize();
        updateStatus('FahOS Ready', '#38BDF8');
      });
    }

    if (openBrowserBtn) {
      openBrowserBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (promptInput && promptInput.value.trim()) {
          window.fahosAPI.sendMessage(`search ${promptInput.value.trim()}`);
        } else {
          window.fahosAPI.sendMessage('search Google');
        }
      });
    }

    window.fahosAPI.onFocusInput(() => {
      if (promptInput) promptInput.focus();
    });

    window.fahosAPI.onTriggerSnip(() => {
      window.fahosAPI.startSnip();
    });

    window.fahosAPI.onSnipCaptured((event, dataUrl) => {
      currentSnipImage = dataUrl;
      if (attachedThumbImg) attachedThumbImg.src = dataUrl;
      if (attachedImagePill) attachedImagePill.classList.remove('hidden');
      if (promptInput) promptInput.focus();
      updateStatus('✂ Screen Snip Attached (Ready to Ask)', '#38BDF8');
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
        const errDetail = (result && result.error) ? result.error : 'Service temporarily busy';
        if (actionTree) {
          actionTree.innerHTML = `
            <div class="error-card">
              <div class="error-header">
                <span class="error-icon">⚠️</span>
                <span class="error-title">Service Temporarily Busy</span>
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
          <div class="history-ai-answer">${formattedA}</div>
        </div>
      `;
    }).join('');

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

  // 13. Window Dragging
  let isDraggingWindow = false;
  let dragStartX = 0;
  let dragStartY = 0;

  if (widget && window.fahosAPI) {
    widget.addEventListener('mousedown', (e) => {
      if (e.target.closest('input, textarea, button, .icon-btn, .droplet-item, .send-btn, .bottom-resize-handle, .remove-image-btn, code, blockquote, .table-wrapper')) {
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

