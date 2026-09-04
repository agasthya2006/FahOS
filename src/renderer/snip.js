document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('snip-canvas');
  const ctx = canvas.getContext('2d');
  const dimBadge = document.getElementById('dim-badge');
  const snipToolbar = document.getElementById('snip-toolbar');
  const btnConfirm = document.getElementById('btn-confirm-snip');
  const btnCancel = document.getElementById('btn-cancel-snip');

  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let selectedRect = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawMask();
  }

  function drawMask() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function drawSelection(x, y, w, h) {
    drawMask();

    if (w > 0 && h > 0) {
      // Clear cutout window
      ctx.clearRect(x, y, w, h);

      // Outer accent border
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    selectedRect = null;

    snipToolbar.style.display = 'none';
    dimBadge.style.display = 'none';
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    drawSelection(x, y, w, h);

    if (w > 10 && h > 10) {
      dimBadge.textContent = `${w} × ${h}`;
      dimBadge.style.left = `${x}px`;
      dimBadge.style.top = `${Math.max(10, y - 26)}px`;
      dimBadge.style.display = 'block';
    } else {
      dimBadge.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    if (w > 15 && h > 15) {
      selectedRect = { x, y, width: w, height: h };

      // Position floating toolbar below selection
      const toolbarLeft = Math.max(10, Math.min(window.innerWidth - 190, x + w - 180));
      const toolbarTop = Math.min(window.innerHeight - 50, y + h + 10);

      snipToolbar.style.left = `${toolbarLeft}px`;
      snipToolbar.style.top = `${toolbarTop}px`;
      snipToolbar.style.display = 'flex';
    } else {
      selectedRect = null;
      snipToolbar.style.display = 'none';
      dimBadge.style.display = 'none';
      drawMask();
    }
  });

  function confirmSnip() {
    if (selectedRect && window.fahosAPI) {
      window.fahosAPI.confirmSnip(selectedRect);
    } else {
      cancelSnip();
    }
  }

  function cancelSnip() {
    if (window.fahosAPI) {
      window.fahosAPI.cancelSnip();
    }
  }

  btnConfirm.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmSnip();
  });

  btnCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelSnip();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmSnip();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelSnip();
    }
  });
});
