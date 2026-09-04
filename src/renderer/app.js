document.addEventListener('DOMContentLoaded', () => {
  const cmdInput = document.getElementById('cmd-input');
  const btnSend = document.getElementById('btn-send');
  const btnClose = document.getElementById('btn-close');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnSnip = document.getElementById('btn-snip');
  const statusPill = document.getElementById('status-pill');

  function handleSend() {
    const text = cmdInput.value.trim();
    if (!text) return;

    if (window.fahosAPI) {
      window.fahosAPI.sendMessage(text);
    }
    cmdInput.value = '';
    
    // Update status indicator transiently
    if (statusPill) {
      statusPill.querySelector('.status-text').textContent = 'FahOS Processing...';
      statusPill.querySelector('.status-dot').style.color = '#3B82F6';
    }
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
      if (statusPill) {
        statusPill.querySelector('.status-text').textContent = 'Screen Snip Active';
      }
    });

    window.fahosAPI.onFocusInput(() => {
      cmdInput.focus();
    });

    window.fahosAPI.onAgentResponse((event, responseMsg) => {
      if (statusPill) {
        statusPill.querySelector('.status-text').textContent = 'FahOS Ready';
        statusPill.querySelector('.status-dot').style.color = '#10B981';
      }
    });
  }
});
