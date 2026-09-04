'use strict';
// Modular Windows OS & PowerShell Automation Engine

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// ==================== 🛡️ 3-TIER PERMISSION SYSTEM ====================
const PERMISSION_TIERS = {
  SAFE: 'SAFE',           // 🟢 Executes immediately
  CONFIRM: 'CONFIRM',     // 🟡 Requires visual preview
  DANGEROUS: 'DANGEROUS'  // 🔴 Requires explicit user confirmation
};

// 1. Core PowerShell & Shell Command Executor
function runPowerShell(cmd) {
  return new Promise((resolve) => {
    const trimmed = String(cmd || '').trim();
    console.log(`[System Actions] Running PowerShell: ${trimmed}`);

    // Web URL launch: Open via default browser
    if (/^start\s+https?:\/\//i.test(trimmed)) {
      const rawUrl = trimmed.replace(/^start\s+/i, '').replace(/^["']|["']$/g, '');
      try {
        const { shell } = require('electron');
        if (shell && shell.openExternal) {
          shell.openExternal(rawUrl);
          return resolve({ ok: true, output: rawUrl });
        }
      } catch (_) {}
      
      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${rawUrl}'"`;
      exec(psCommand, (err) => resolve({ ok: !err, output: rawUrl }));
      return;
    }

    // Direct PowerShell execution
    if (/^powershell(\.exe)?\s+/i.test(trimmed)) {
      exec(trimmed, (err, stdout) => resolve({ ok: !err, output: stdout ? stdout.trim() : '' }));
      return;
    }

    // App or Directory launch via Start-Process
    if (!trimmed.includes('\n') && /^start\s+/i.test(trimmed)) {
      const rawTarget = trimmed.replace(/^start\s+/i, '').replace(/^["']|["']$/g, '').trim();
      const resolvedDir = resolveDirectory(rawTarget);
      
      if (resolvedDir && resolvedDir.path) {
        try {
          const { shell } = require('electron');
          if (shell && shell.openPath) {
            shell.openPath(resolvedDir.path).then(() => resolve({ ok: true, output: resolvedDir.path }));
            return;
          }
        } catch (_) {}
      }

      const resolved = resolveApp(rawTarget);
      const finalTarget = resolved ? (resolved.protocol || resolved.command) : rawTarget;
      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${finalTarget}'"`;
      exec(psCommand, (err, stdout) => resolve({ ok: !err, output: stdout ? stdout.trim() : '' }));
      return;
    }

    // Execute multi-step automation scripts via temporary .ps1 script
    const tempFile = path.join(os.tmpdir(), `action_${Date.now()}.ps1`);
    fs.writeFileSync(tempFile, trimmed, 'utf8');

    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`;
    exec(psCommand, (err, stdout) => {
      try { fs.unlinkSync(tempFile); } catch (_) {}
      resolve({ ok: !err, output: stdout ? stdout.trim() : '' });
    });
  });
}

// 2. Fuzzy App Name Resolver & Dictionary
function resolveApp(appName) {
  const clean = String(appName || '').toLowerCase().trim();
  const APP_MAP = {
    calculator: { name: 'Calculator', command: 'calc.exe' },
    calc: { name: 'Calculator', command: 'calc.exe' },
    notepad: { name: 'Notepad', command: 'notepad.exe' },
    chrome: { name: 'Google Chrome', command: 'chrome.exe' },
    browser: { name: 'Google Chrome', command: 'chrome.exe' },
    vscode: { name: 'Visual Studio Code', command: 'code.cmd' },
    code: { name: 'Visual Studio Code', command: 'code.cmd' },
    spotify: { name: 'Spotify', protocol: 'spotify:' },
    whatsapp: { name: 'WhatsApp', protocol: 'whatsapp:' },
    mspaint: { name: 'Paint', command: 'mspaint.exe' },
    paint: { name: 'Paint', command: 'mspaint.exe' },
    cmd: { name: 'Command Prompt', command: 'cmd.exe' },
    terminal: { name: 'Windows Terminal', command: 'wt.exe' },
    explorer: { name: 'File Explorer', command: 'explorer.exe' },
    files: { name: 'File Explorer', command: 'explorer.exe' },
    'file explorer': { name: 'File Explorer', command: 'explorer.exe' },
    folders: { name: 'File Explorer', command: 'explorer.exe' }
  };

  if (APP_MAP[clean]) return APP_MAP[clean];
  
  // Fuzzy match fallback
  for (const key in APP_MAP) {
    if (clean.includes(key)) return APP_MAP[key];
  }
  return null;
}

// 3. Windows Directory & Folder Resolver
function resolveDirectory(targetName) {
  const clean = String(targetName || '').toLowerCase().trim();
  const home = os.homedir();
  
  const SPECIAL_FOLDERS = {
    desktop: path.join(home, 'Desktop'),
    downloads: path.join(home, 'Downloads'),
    documents: path.join(home, 'Documents'),
    pictures: path.join(home, 'Pictures'),
    music: path.join(home, 'Music'),
    videos: path.join(home, 'Videos')
  };

  for (const key in SPECIAL_FOLDERS) {
    if (clean === key || clean.includes(key)) {
      return { name: key.charAt(0).toUpperCase() + key.slice(1), path: SPECIAL_FOLDERS[key] };
    }
  }
  return null;
}

// 3.5. Web Applications & Common Sites Directory
const WEB_APPS = {
  youtube: { name: 'YouTube', url: 'https://www.youtube.com' },
  google: { name: 'Google', url: 'https://www.google.com' },
  github: { name: 'GitHub', url: 'https://github.com' },
  twitter: { name: 'X / Twitter', url: 'https://x.com' },
  x: { name: 'X', url: 'https://x.com' },
  reddit: { name: 'Reddit', url: 'https://www.reddit.com' },
  linkedin: { name: 'LinkedIn', url: 'https://www.linkedin.com' },
  netflix: { name: 'Netflix', url: 'https://www.netflix.com' },
  amazon: { name: 'Amazon', url: 'https://www.amazon.com' },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com' },
  openai: { name: 'OpenAI', url: 'https://chatgpt.com' },
  claude: { name: 'Claude AI', url: 'https://claude.ai' },
  gemini: { name: 'Google Gemini', url: 'https://gemini.google.com' },
  wikipedia: { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
  gmail: { name: 'Gmail', url: 'https://mail.google.com' },
  drive: { name: 'Google Drive', url: 'https://drive.google.com' },
  maps: { name: 'Google Maps', url: 'https://maps.google.com' },
  docs: { name: 'Google Docs', url: 'https://docs.google.com' },
  sheets: { name: 'Google Sheets', url: 'https://sheets.google.com' },
  instagram: { name: 'Instagram', url: 'https://www.instagram.com' },
  facebook: { name: 'Facebook', url: 'https://www.facebook.com' },
  figma: { name: 'Figma', url: 'https://www.figma.com' },
  notion: { name: 'Notion', url: 'https://www.notion.so' },
  canva: { name: 'Canva', url: 'https://www.canva.com' },
  stackoverflow: { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
  medium: { name: 'Medium', url: 'https://medium.com' },
  twitch: { name: 'Twitch', url: 'https://www.twitch.tv' },
  pinterest: { name: 'Pinterest', url: 'https://www.pinterest.com' },
  huggingface: { name: 'Hugging Face', url: 'https://huggingface.co' },
  kaggle: { name: 'Kaggle', url: 'https://www.kaggle.com' },
  coursera: { name: 'Coursera', url: 'https://www.coursera.org' },
  udemy: { name: 'Udemy', url: 'https://www.udemy.com' },
  dropbox: { name: 'Dropbox', url: 'https://www.dropbox.com' },
  web: { name: 'Google Search', url: 'https://www.google.com' }
};

function resolveWebAppOrUrl(targetInput) {
  const clean = String(targetInput || '').trim();
  const lower = clean.toLowerCase().replace(/^(?:the\s+|website\s+|site\s+)/i, '').trim();

  // Direct URL (http:// or https://)
  if (/^https?:\/\//i.test(clean)) {
    return { name: clean, url: clean };
  }

  // Domain syntax (e.g. github.com, reddit.com, news.ycombinator.com)
  if (/^[a-zA-Z0-9\-\.]+\.(?:com|org|net|io|ai|dev|app|in|co|uk|edu|gov|xyz|me)(?:[\/?#].*)?$/i.test(lower)) {
    return { name: lower, url: `https://${lower}` };
  }

  // Exact match in web apps
  if (WEB_APPS[lower]) return WEB_APPS[lower];

  // Whole word or significant prefix match in web apps
  for (const key in WEB_APPS) {
    if (key.length >= 4 && lower.includes(key)) {
      return WEB_APPS[key];
    }
    // Whole word match (e.g. "open x" or "x")
    const wordBoundaryRegex = new RegExp(`(?:^|\\s)${key}(?:\\s|$)`, 'i');
    if (wordBoundaryRegex.test(lower)) {
      return WEB_APPS[key];
    }
  }

  return null;
}

// 4. Combined Observe-Plan-Verify Item Launcher (Apps, Files & Directories)
async function verifyAndOpenItem(targetInput) {
  let rawTarget = String(targetInput || '').trim().replace(/[\.\?!,;]+$/, '').trim();
  rawTarget = rawTarget.replace(/^(?:the\s+|app\s+|folder\s+|directory\s+|file\s+|website\s+)/i, '').trim();

  // Phase 1: Verify Windows Environment (Directories/Folders)
  const resolvedDir = resolveDirectory(rawTarget);
  if (resolvedDir && fs.existsSync(resolvedDir.path)) {
    const res = await runPowerShell(`start "${resolvedDir.path}"`);
    return { ok: res.ok, type: 'directory', name: resolvedDir.name, description: `Opened **${resolvedDir.name}** directory in File Explorer.` };
  }

  if (fs.existsSync(rawTarget)) {
    try {
      const stats = fs.statSync(rawTarget);
      if (stats.isDirectory()) {
        const res = await runPowerShell(`start "${rawTarget}"`);
        return { ok: res.ok, type: 'directory', name: path.basename(rawTarget) || rawTarget, description: `Opened directory **${rawTarget}** in File Explorer.` };
      }
    } catch (_) {}
  }

  // Phase 1: Verify Windows Environment (Local Installed Applications)
  const resolvedApp = resolveApp(rawTarget);
  if (resolvedApp) {
    const targetCmd = resolvedApp.protocol || resolvedApp.command;
    const res = await runPowerShell(`start "${targetCmd}"`);
    return { ok: res.ok, type: 'app', name: resolvedApp.name, description: `Launched **${resolvedApp.name}**.` };
  }

  // Phase 2: If not in Windows environment, verify Web Application or Domain URL
  const resolvedWeb = resolveWebAppOrUrl(rawTarget);
  if (resolvedWeb) {
    const res = await runPowerShell(`start "${resolvedWeb.url}"`);
    return {
      ok: res.ok,
      type: 'web',
      name: resolvedWeb.name,
      url: resolvedWeb.url,
      description: `Opened **${resolvedWeb.name}** in your browser.`
    };
  }

  // Phase 3: Not openable in Windows or Web — inform the user clearly
  return {
    ok: false,
    notFound: true,
    name: rawTarget,
    description: `Could not find application, folder, or file **"${rawTarget}"** on your Windows system, nor is it a recognized web application.\n\n💡 *Tip: If you'd like to search for it online, ask "Search ${rawTarget} on Google".*`
  };
}

// 4.5. Clean Application Closer / Process Terminator
async function closeApp(appName) {
  const norm = String(appName || '').trim().replace(/[\.\?!,;]+$/, '');
  const app = resolveApp(norm);
  let targetExe = norm;
  let label = norm;

  if (app) {
    label = app.name;
    if (app.command) {
      targetExe = app.command.replace(/\.cmd$/i, '.exe');
    } else if (app.id === 'spotify') {
      targetExe = 'Spotify.exe';
    } else if (app.id === 'whatsapp') {
      targetExe = 'WhatsApp.exe';
    } else if (app.id === 'calculator') {
      targetExe = 'CalculatorApp.exe';
    }
  }

  if (!targetExe.endsWith('.exe')) {
    targetExe += '.exe';
  }

  return new Promise((resolve) => {
    const isCalc = label.toLowerCase().includes('calc');
    const killCmd = isCalc
      ? `taskkill /F /IM calc.exe /IM CalculatorApp.exe /IM Calculator.exe 2>&1`
      : `taskkill /F /IM "${targetExe}" 2>&1`;

    exec(killCmd, (err, stdout, stderr) => {
      const output = String(stdout || stderr || '');
      if (output.includes('SUCCESS') || output.includes('terminated')) {
        resolve({
          ok: true,
          name: label,
          description: `Closed **${label}**.`
        });
      } else if (output.includes('not found') || output.includes('ERROR:')) {
        resolve({
          ok: true,
          name: label,
          description: `**${label}** is not currently running.`
        });
      } else {
        resolve({
          ok: true,
          name: label,
          description: `Closed **${label}**.`
        });
      }
    });
  });
}

// 5. Safe File & Directory Creator
async function createFileOrFolder({ name, targetFolder = 'Desktop', isFolder = false }) {
  const resolvedDir = resolveDirectory(targetFolder) || { path: path.join(os.homedir(), 'Desktop') };
  const destPath = path.join(resolvedDir.path, name);

  const command = isFolder
    ? `New-Item -ItemType Directory -Path '${destPath}' -Force`
    : `New-Item -ItemType File -Path '${destPath}' -Force`;

  const res = await runPowerShell(command);
  const typeLabel = isFolder ? 'Folder' : 'File';
  
  return {
    ok: res.ok,
    command: command,
    description: res.ok
      ? `Created ${typeLabel} **${name}** inside \`${resolvedDir.path}\`.`
      : `Failed to create ${typeLabel} **${name}**.`
  };
}

// 6. Safe File & Directory Deleter (Sends to Windows Recycle Bin)
async function deleteFileOrFolder({ name, targetFolder = '', confirmed = false }) {
  const resolvedDir = targetFolder ? resolveDirectory(targetFolder) : null;
  const baseDir = resolvedDir ? resolvedDir.path : path.join(os.homedir(), 'Desktop');
  const targetPath = path.join(baseDir, name);

  // Require confirmation for destructive deletion (3-Tier Security Guard)
  if (!confirmed) {
    return {
      ok: true,
      requiresConfirmation: true,
      tier: PERMISSION_TIERS.DANGEROUS,
      itemPath: targetPath,
      itemName: name,
      description: `Targeting **${name}** for permanent removal at \`${targetPath}\`. Please confirm deletion.`
    };
  }

  // Safe delete via Microsoft.VisualBasic Recycle Bin API
  const psScript = `
    Add-Type -AssemblyName Microsoft.VisualBasic
    if (Test-Path -Path '${targetPath}' -PathType Container) {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${targetPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')
    } else {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${targetPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')
    }
  `;

  const res = await runPowerShell(psScript);
  return {
    ok: res.ok,
    description: res.ok
      ? `Moved **${name}** safely to the Windows Recycle Bin.`
      : `Failed to delete **${name}**.`
  };
}

// 7. Compose Email Deep-Link (Gmail Web)
async function composeEmail(target, subject = '', body = '') {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(target)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const res = await runPowerShell(`start "${url}"`);
  return {
    ok: res.ok,
    command: `Gmail: "${target}"`,
    description: `Opened Gmail compose window for **${target}**.`
  };
}

// 8. WhatsApp Deep-Link Chat Launcher
async function openWhatsAppChat(contactName, message = '') {
  // If contact phone is supplied, open direct whatsapp:// protocol link
  if (/^\+?\d+$/.test(contactName.replace(/\s+/g, ''))) {
    const cleanPhone = contactName.replace(/[^\d\+]/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}${message ? '&text=' + encodeURIComponent(message) : ''}`;
    const res = await runPowerShell(`start "${url}"`);
    return { ok: res.ok, description: `Opened WhatsApp chat with **${cleanPhone}**.` };
  }

  // Search WhatsApp UI via WScript keystrokes
  const psScript = `
    $ws = New-Object -ComObject WScript.Shell
    $ws.AppActivate('WhatsApp')
    Start-Sleep -Milliseconds 400
    $ws.SendKeys('^f')
    Start-Sleep -Milliseconds 300
    $ws.SendKeys('${contactName.replace(/'/g, "''")}')
    Start-Sleep -Milliseconds 600
    $ws.SendKeys('{ENTER}')
  `;
  const res = await runPowerShell(psScript);
  return { ok: res.ok, description: `Opened WhatsApp and searched for **${contactName}**.` };
}

module.exports = {
  runPowerShell,
  resolveApp,
  resolveDirectory,
  resolveWebAppOrUrl,
  WEB_APPS,
  verifyAndOpenItem,
  closeApp,
  createFileOrFolder,
  deleteFileOrFolder,
  composeEmail,
  openWhatsAppChat,
  PERMISSION_TIERS
};
