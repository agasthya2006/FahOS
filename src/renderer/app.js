document.addEventListener('DOMContentLoaded', () => {
  const cmdInput = document.getElementById('cmd-input');
  const btnSend = document.getElementById('btn-send');
  const btnClose = document.getElementById('btn-close');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnSnip = document.getElementById('btn-snip');
  const statusPill = document.getElementById('status-pill');

  function updateStatus(text, color = '#3B82F6') {
    if (!statusPill) return;
    const textEl = statusPill.querySelector('.status-text');
    const dotEl = statusPill.querySelector('.status-dot');
    if (textEl) textEl.textContent = text;
    if (dotEl) dotEl.style.color = color;
  }

  function handleSend() {
    const text = cmdInput.value.trim();
    if (!text) return;

    updateStatus('Initializing agent backend...', '#3B82F6');

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

  btnSend.addEventListener('click', handleSend);

  if (window.fahosAPI) {
    btnClose.addEventListener('click', () => window.fahosAPI.closeHUD());
    btnMinimize.addEventListener('click', () => window.fahosAPI.minimizeHUD());
    btnSnip.addEventListener('click', () => {
      updateStatus('Screen Snip Active', '#F59E0B');
    });

    window.fahosAPI.onFocusInput(() => {
      cmdInput.focus();
    });

    window.fahosAPI.onAgentStatusUpdate((event, statusText) => {
      updateStatus(statusText, '#3B82F6');
    });

    window.fahosAPI.onAgentResponse((event, result) => {
      if (result && result.success) {
        updateStatus('✦ FahOS Ready', '#10B981');
      } else {
        updateStatus(`Error: ${result.error || 'Failed'}`, '#EF4444');
      }
    });
  }
});
