'use strict';
// FahOS - Unified Windows OS, PowerShell Automation & System Engine
// Single source of truth for all desktop automation, system controls, and app integrations.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { exec } = require('child_process');

let shell = null;
try {
  shell = require('electron').shell;
} catch (_) {}

const contactsService = require('../contacts/contactsService');
const { sanitizePowerShellArg, sanitizeFileName, escapePowerShellSingleQuotes } = require('../../../core/sanitize');

// ==================== 🛡️ 3-TIER PERMISSION SYSTEM ====================
const PERMISSION_TIERS = {
  SAFE: 'SAFE',           // 🟢 Executes immediately
  CONFIRM: 'CONFIRM',     // 🟡 Requires visual preview
  DANGEROUS: 'DANGEROUS'  // 🔴 Requires explicit user confirmation
};

// ==================== 📂 DIRECTORY RESOLVER ====================
function getExistingFolderPath(folderName) {
  const home = os.homedir();
  const oneDrive = process.env.OneDrive || process.env.ONEDRIVE;
  
  const candidates = [];
  if (oneDrive) {
    candidates.push(path.join(oneDrive, folderName));
  }
  candidates.push(path.join(home, folderName));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(home, folderName);
}

const DIRECTORIES = [
  { name: 'Desktop', aliases: ['desktop', 'desk', 'screen'], get path() { return getExistingFolderPath('Desktop'); } },
  { name: 'Downloads', aliases: ['downloads', 'download', 'down'], get path() { return getExistingFolderPath('Downloads'); } },
  { name: 'Documents', aliases: ['documents', 'document', 'docs', 'doc', 'my documents'], get path() { return getExistingFolderPath('Documents'); } },
  { name: 'Pictures', aliases: ['pictures', 'picture', 'photos', 'photo', 'images', 'image', 'pics', 'my pictures'], get path() { return getExistingFolderPath('Pictures'); } },
  { name: 'Music', aliases: ['music', 'songs', 'audio', 'my music'], get path() { return getExistingFolderPath('Music'); } },
  { name: 'Videos', aliases: ['videos', 'video', 'movies', 'movie', 'my videos'], get path() { return getExistingFolderPath('Videos'); } }
];

function levenshtein(a, b) {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const m = [];
  for (let i = 0; i <= al; i++) m[i] = [i];
  for (let j = 0; j <= bl; j++) m[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + cost
      );
    }
  }
  return m[al][bl];
}

function resolveDirectory(rawName) {
  if (!rawName) return null;
  const clean = String(rawName).trim().toLowerCase()
    .replace(/^(?:open|go\s+to|show|view|folder|directory)\s+/i, '')
    .replace(/\s+(?:folder|directory)$/i, '')
    .trim();

  for (const dir of DIRECTORIES) {
    if (dir.aliases.includes(clean) || dir.name.toLowerCase() === clean) {
      return dir;
    }
  }

  for (const dir of DIRECTORIES) {
    if (dir.aliases.some(alias => clean.includes(alias) || alias.includes(clean))) {
      return dir;
    }
  }

  for (const dir of DIRECTORIES) {
    for (const alias of dir.aliases) {
      if (levenshtein(clean, alias) <= 2) {
        return dir;
      }
    }
  }

  return null;
}

// ==================== 📱 APPLICATION RESOLVER ====================
const KNOWN_APPS = [
  { id: 'notepad', name: 'Notepad', aliases: ['notepad', 'notes', 'text editor', 'txt'], command: 'notepad.exe' },
  { id: 'calculator', name: 'Calculator', aliases: ['calculator', 'calc', 'math'], command: 'calc.exe' },
  { id: 'explorer', name: 'File Explorer', aliases: ['explorer', 'files', 'file manager', 'my pc', 'this pc'], command: 'explorer.exe' },
  { id: 'chrome', name: 'Google Chrome', aliases: ['chrome', 'google chrome', 'browser', 'google'], command: 'chrome.exe' },
  { id: 'edge', name: 'Microsoft Edge', aliases: ['edge', 'msedge', 'microsoft edge'], command: 'msedge.exe' },
  { id: 'cmd', name: 'Command Prompt', aliases: ['cmd', 'command prompt', 'terminal', 'dos'], command: 'cmd.exe' },
  { id: 'powershell', name: 'PowerShell', aliases: ['powershell', 'ps', 'posh'], command: 'powershell.exe' },
  { id: 'paint', name: 'Paint', aliases: ['paint', 'mspaint', 'drawing'], command: 'mspaint.exe' },
  { id: 'taskmgr', name: 'Task Manager', aliases: ['task manager', 'taskmgr', 'processes'], command: 'taskmgr.exe' },
  { id: 'settings', name: 'Windows Settings', aliases: ['settings', 'windows settings', 'control panel', 'config'], command: 'ms-settings:' },
  { id: 'spotify', name: 'Spotify', aliases: ['spotify', 'music app'], command: 'spotify:' },
  { id: 'vscode', name: 'Visual Studio Code', aliases: ['vscode', 'code', 'vs code'], command: 'code.cmd' },
  { id: 'whatsapp', name: 'WhatsApp', aliases: ['whatsapp', 'wa'], command: 'whatsapp:' },
  { id: 'wordpad', name: 'WordPad', aliases: ['wordpad', 'write'], command: 'write.exe' },
  { id: 'snipping', name: 'Snipping Tool', aliases: ['snipping tool', 'snip', 'snippingtool'], command: 'snippingtool.exe' },
  { id: 'camera', name: 'Camera', aliases: ['camera', 'webcam'], command: 'microsoft.windows.camera:' }
];

function resolveApp(rawName) {
  if (!rawName) return null;
  const clean = String(rawName).trim().toLowerCase()
    .replace(/^(?:open|launch|start|run|app)\s+/i, '')
    .replace(/\s+(?:app|application)$/i, '')
    .trim();

  for (const app of KNOWN_APPS) {
    if (app.aliases.includes(clean) || app.name.toLowerCase() === clean || app.id === clean) {
      return app;
    }
  }

  for (const app of KNOWN_APPS) {
    if (app.aliases.some(alias => clean.startsWith(alias) || clean.endsWith(alias))) {
      return app;
    }
  }

  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      const maxDist = alias.length <= 4 ? 1 : 2;
      if (levenshtein(clean, alias) <= maxDist) {
        return app;
      }
    }
  }

  return null;
}

// ==================== 🌐 WEB APPLICATION RESOLVER ====================
const WEB_APPS = [
  { id: 'youtube', name: 'YouTube', aliases: ['youtube', 'yt'], url: 'https://www.youtube.com' },
  { id: 'gmail', name: 'Gmail', aliases: ['gmail', 'google mail', 'email', 'inbox'], url: 'https://mail.google.com' },
  { id: 'google', name: 'Google', aliases: ['google', 'google search'], url: 'https://www.google.com' },
  { id: 'github', name: 'GitHub', aliases: ['github', 'git hub'], url: 'https://github.com' },
  { id: 'reddit', name: 'Reddit', aliases: ['reddit'], url: 'https://www.reddit.com' },
  { id: 'twitter', name: 'X / Twitter', aliases: ['twitter', 'x', 'x.com', 'tweets'], url: 'https://x.com' },
  { id: 'linkedin', name: 'LinkedIn', aliases: ['linkedin', 'linked in'], url: 'https://www.linkedin.com' },
  { id: 'amazon', name: 'Amazon', aliases: ['amazon', 'shopping'], url: 'https://www.amazon.com' },
  { id: 'netflix', name: 'Netflix', aliases: ['netflix'], url: 'https://www.netflix.com' },
  { id: 'chatgpt', name: 'ChatGPT', aliases: ['chatgpt', 'chat gpt', 'openai'], url: 'https://chatgpt.com' },
  { id: 'claude', name: 'Claude', aliases: ['claude', 'anthropic'], url: 'https://claude.ai' },
  { id: 'notion', name: 'Notion', aliases: ['notion'], url: 'https://www.notion.so' },
  { id: 'figma', name: 'Figma', aliases: ['figma'], url: 'https://www.figma.com' },
  { id: 'discord', name: 'Discord Web', aliases: ['discord web', 'discord online'], url: 'https://discord.com/app' },
  { id: 'maps', name: 'Google Maps', aliases: ['google maps', 'maps', 'location'], url: 'https://maps.google.com' },
  { id: 'drive', name: 'Google Drive', aliases: ['google drive', 'gdrive', 'drive'], url: 'https://drive.google.com' },
  { id: 'docs', name: 'Google Docs', aliases: ['google docs', 'gdocs', 'docs'], url: 'https://docs.google.com' },
  { id: 'sheets', name: 'Google Sheets', aliases: ['google sheets', 'gsheets', 'sheets'], url: 'https://sheets.google.com' },
  { id: 'canva', name: 'Canva', aliases: ['canva'], url: 'https://www.canva.com' },
  { id: 'wikipedia', name: 'Wikipedia', aliases: ['wikipedia', 'wiki'], url: 'https://www.wikipedia.org' }
];

function resolveWebAppOrUrl(rawTarget) {
  if (!rawTarget) return null;
  const clean = String(rawTarget).trim().toLowerCase()
    .replace(/^(?:open|go\s+to|launch|visit|view|show|browse)\s+/i, '')
    .replace(/\s+(?:website|site|web|app|online)$/i, '')
    .trim();

  if (/^https?:\/\//i.test(clean)) {
    return { name: clean, url: clean };
  }
  if (/^[a-zA-Z0-9_\-\.]+\.(com|org|net|io|co|in|dev|ai|app|me|edu|gov)(\/.*)?$/i.test(clean)) {
    return { name: clean, url: `https://${clean}` };
  }

  for (const web of WEB_APPS) {
    if (web.aliases.includes(clean) || web.name.toLowerCase() === clean || web.id === clean) {
      return web;
    }
  }

  for (const web of WEB_APPS) {
    if (web.aliases.some(alias => clean.includes(alias) || alias.includes(clean))) {
      return web;
    }
  }

  return null;
}

// ==================== ⚡ CORE POWERSHELL COMMAND EXECUTOR ====================
function runPowerShell(cmd) {
  return new Promise((resolve) => {
    const trimmed = String(cmd || '').trim();
    console.log(`[FahOS System Engine] Executing: ${trimmed.slice(0, 120)}`);

    // Web URL launch: Open via Electron shell or default browser
    if (/^start\s+https?:\/\//i.test(trimmed)) {
      const rawUrl = trimmed.replace(/^start\s+/i, '').replace(/^["']|["']$/g, '').trim();
      try {
        if (shell && shell.openExternal) {
          shell.openExternal(rawUrl).then(() => {
            resolve({ ok: true, output: rawUrl });
          }).catch((err) => {
            resolve({ ok: false, error: err.message });
          });
          return;
        }
      } catch (_) {}

      const safeUrlArg = sanitizePowerShellArg(rawUrl);
      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process ${safeUrlArg}"`;
      exec(psCommand, (err, stdout) => {
        resolve({ ok: !err, output: stdout ? stdout.trim() : rawUrl });
      });
      return;
    }

    // App or Directory launch via Start-Process
    if (!trimmed.includes('\n') && /^start\s+/i.test(trimmed)) {
      const rawTarget = trimmed.replace(/^start\s+/i, '').replace(/^["']|["']$/g, '').trim();
      const resolvedDir = resolveDirectory(rawTarget);

      if (resolvedDir && resolvedDir.path) {
        try {
          if (shell && shell.openPath) {
            shell.openPath(resolvedDir.path).then(() => resolve({ ok: true, output: resolvedDir.path }));
            return;
          }
        } catch (_) {}
      }

      const safeTarget = sanitizePowerShellArg(rawTarget);
      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process ${safeTarget}"`;
      exec(psCommand, (err, stdout) => resolve({ ok: !err, output: stdout ? stdout.trim() : '' }));
      return;
    }

    // Single-line direct PowerShell execution
    if (!trimmed.includes('\n')) {
      const psCommand = /^powershell(\.exe)?\s+/i.test(trimmed)
        ? trimmed
        : `powershell.exe -NoProfile -NonInteractive -Command "${trimmed.replace(/"/g, '`"')}"`;

      exec(psCommand, (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, error: stderr ? stderr.trim() : err.message, output: stdout ? stdout.trim() : '' });
        } else {
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
      return;
    }

    // Multi-line script execution via temporary file
    const tempFile = path.join(os.tmpdir(), `fahos_action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.ps1`);
    try {
      fs.writeFileSync(tempFile, trimmed, 'utf8');
      const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`;
      exec(psCommand, (err, stdout, stderr) => {
        try { fs.unlinkSync(tempFile); } catch (_) {}
        if (err) {
          resolve({ ok: false, error: stderr ? stderr.trim() : err.message, output: stdout ? stdout.trim() : '' });
        } else {
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
    } catch (writeErr) {
      resolve({ ok: false, error: writeErr.message });
    }
  });
}

// ==================== 🔍 LOCAL FILE & FOLDER FINDER ====================
function findLocalFileOrFolder(query) {
  const norm = String(query || '').trim().toLowerCase();
  const searchDirs = [
    { name: 'Desktop', path: getExistingFolderPath('Desktop') },
    { name: 'Downloads', path: getExistingFolderPath('Downloads') },
    { name: 'Documents', path: getExistingFolderPath('Documents') }
  ];

  for (const dir of searchDirs) {
    try {
      if (!fs.existsSync(dir.path)) continue;
      const entries = fs.readdirSync(dir.path, { withFileTypes: true });

      for (const entry of entries) {
        const entryName = entry.name.toLowerCase();
        const baseName = path.parse(entry.name).name.toLowerCase();

        if (entryName === norm || baseName === norm) {
          return {
            found: true,
            path: path.join(dir.path, entry.name),
            name: entry.name,
            isFolder: entry.isDirectory(),
            container: dir.name
          };
        }
      }

      for (const entry of entries) {
        const entryName = entry.name.toLowerCase();
        const baseName = path.parse(entry.name).name.toLowerCase();

        if (entryName.includes(norm) || norm.includes(baseName)) {
          return {
            found: true,
            path: path.join(dir.path, entry.name),
            name: entry.name,
            isFolder: entry.isDirectory(),
            container: dir.name
          };
        }
      }
    } catch (_) {}
  }
  return null;
}

// ==================== 🚀 UNIFIED ITEM VERIFIER & OPENER ====================
async function verifyAndOpenItem(query) {
  const norm = String(query || '').trim();

  // Phase 1: Check known Windows directory
  const dir = resolveDirectory(norm);
  if (dir) {
    if (shell && shell.openPath) {
      await shell.openPath(dir.path);
    } else {
      await runPowerShell(`start "${dir.path}"`);
    }
    return {
      ok: true,
      type: 'directory',
      name: dir.name,
      path: dir.path,
      description: `Opened your **${dir.name}** folder.`
    };
  }

  // Phase 2: Check known Windows application
  const app = resolveApp(norm);
  if (app) {
    if (app.command.startsWith('ms-settings:') || app.command.endsWith(':')) {
      await runPowerShell(`start ${app.command}`);
    } else {
      await runPowerShell(`start ${app.command}`);
    }
    return {
      ok: true,
      type: 'app',
      name: app.name,
      command: app.command,
      description: `Launched **${app.name}**.`
    };
  }

  // Phase 3: Check local files and folders
  const localItem = findLocalFileOrFolder(norm);
  if (localItem) {
    if (shell && shell.openPath) {
      await shell.openPath(localItem.path);
    } else {
      await runPowerShell(`start "${localItem.path}"`);
    }
    const itemType = localItem.isFolder ? 'folder' : 'file';
    return {
      ok: true,
      type: itemType,
      name: localItem.name,
      path: localItem.path,
      description: `Opened ${itemType} **${localItem.name}** from your **${localItem.container}**.`
    };
  }

  // Phase 4: Check Web application or URL
  const webMatch = resolveWebAppOrUrl(norm);
  if (webMatch) {
    if (shell && shell.openExternal) {
      await shell.openExternal(webMatch.url);
    } else {
      await runPowerShell(`start "${webMatch.url}"`);
    }
    return {
      ok: true,
      type: 'web',
      name: webMatch.name,
      url: webMatch.url,
      description: `Opened **${webMatch.name}** in your browser.`
    };
  }

  return {
    ok: false,
    notFound: true,
    name: norm,
    description: `Could not find application, folder, or file **"${norm}"** on your Windows system, nor is it a recognized web application.\n\n💡 *Tip: If you'd like to search for it online, ask "Search ${norm} on Google".*`
  };
}

// ==================== 🛑 APPLICATION CLOSER ====================
async function closeApp(appName) {
  const norm = String(appName || '').trim().replace(/[\.\?!,;]+$/, '');
  const app = resolveApp(norm);
  let targetExe = norm;
  let label = norm;

  if (app) {
    label = app.name;
    if (app.command && app.command.endsWith('.exe')) {
      targetExe = app.command;
    } else if (app.command && app.command.endsWith('.cmd')) {
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
      : `taskkill /F /IM "${targetExe.replace(/"/g, '')}" 2>&1`;

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
          ok: false,
          notFound: true,
          name: label,
          description: `**${label}** is not currently running.`
        });
      } else {
        resolve({
          ok: !err,
          name: label,
          description: !err ? `Closed **${label}**.` : `Failed to close **${label}**: ${output.trim()}`
        });
      }
    });
  });
}

// ==================== 🎛️ SYSTEM HARDWARE & MEDIA CONTROLS ====================
async function systemControl({ action }) {
  const act = String(action || '').toLowerCase().trim();
  let script = '';
  let desc = '';

  switch (act) {
    case 'volume_up':
    case 'increase_volume':
    case 'volume up':
    case 'louder':
      script = '$w = New-Object -ComObject WScript.Shell; for ($i=0; $i -lt 5; $i++) { $w.SendKeys([char]175) }';
      desc = '🔊 Volume increased by 10%.';
      break;
    case 'volume_down':
    case 'decrease_volume':
    case 'volume down':
    case 'lower_volume':
    case 'quieter':
      script = '$w = New-Object -ComObject WScript.Shell; for ($i=0; $i -lt 5; $i++) { $w.SendKeys([char]174) }';
      desc = '🔉 Volume decreased by 10%.';
      break;
    case 'mute':
    case 'unmute':
    case 'toggle_mute':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]173)';
      desc = '🔇 Audio mute state toggled.';
      break;
    case 'play_pause':
    case 'pause':
    case 'play':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]179)';
      desc = '⏯️ Media playback toggled (Play/Pause).';
      break;
    case 'next_track':
    case 'next song':
    case 'next':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]176)';
      desc = '⏭️ Skipped to next media track.';
      break;
    case 'prev_track':
    case 'previous song':
    case 'previous':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]177)';
      desc = '⏮️ Skipped to previous media track.';
      break;
    case 'lock':
    case 'lock pc':
    case 'lock screen':
    case 'lock workstation':
      script = 'rundll32.exe user32.dll,LockWorkStation';
      desc = '🔒 Windows workstation locked.';
      break;
    default:
      script = 'Write-Host "Unrecognized system command"';
      desc = `Triggered system action: ${act}`;
  }

  const res = await runPowerShell(script);
  return {
    ok: res.ok,
    app: 'Windows System',
    command: script,
    description: desc
  };
}

// ==================== 🌐 WEB & YOUTUBE SEARCH ====================
function getFirstYouTubeVideoUrl(query) {
  return new Promise((resolve) => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    https.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          resolve(`https://www.youtube.com/watch?v=${match[1]}`);
        } else {
          resolve(searchUrl);
        }
      });
    }).on('error', () => {
      resolve(searchUrl);
    });
  });
}

async function webSearch({ engine = 'google', query }) {
  const q = String(query || '').trim();
  let targetUrl = '';
  let label = 'Google Search';

  if (engine === 'youtube') {
    targetUrl = await getFirstYouTubeVideoUrl(q);
    label = 'YouTube';
  } else {
    targetUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    label = 'Google Search';
  }

  if (shell && shell.openExternal) {
    await shell.openExternal(targetUrl);
  } else {
    await runPowerShell(`start ${targetUrl}`);
  }

  return {
    ok: true,
    app: label,
    command: `start ${targetUrl}`,
    description: `Opened **${label}** for: _"${q}"_.`
  };
}

// ==================== 🎵 SPOTIFY SEARCH ====================
async function spotifySearch({ query }) {
  const q = String(query || '').trim();
  const uri = `spotify:search:${encodeURIComponent(q)}`;
  const res = await runPowerShell(`start ${uri}`);
  return {
    ok: res.ok,
    app: 'Spotify',
    command: `start ${uri}`,
    description: `Opened **Spotify** searching for: _"${q}"_`
  };
}

// ==================== 📝 NOTEPAD QUICK NOTE ====================
async function notepadWrite({ content }) {
  const text = String(content || '').trim();
  const notesPath = path.join(getExistingFolderPath('Desktop'), 'FahOS_Notes.txt');

  try {
    const timestamp = new Date().toLocaleString();
    const entry = `\n--- Note added on ${timestamp} ---\n${text}\n`;
    fs.appendFileSync(notesPath, entry, 'utf8');

    if (shell && shell.openPath) {
      await shell.openPath(notesPath);
    } else {
      await runPowerShell(`start notepad.exe ${sanitizePowerShellArg(notesPath)}`);
    }

    return {
      ok: true,
      app: 'Notepad',
      path: notesPath,
      description: `Saved note to Desktop and opened in **Notepad**: _"${text}"_`
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      description: `Failed to write note: ${err.message}`
    };
  }
}

// ==================== 📁 SAFE FILE & FOLDER CREATOR ====================
async function createFileOrFolder({ name, targetFolder = 'Desktop', isFolder = false, content = '' }) {
  const rawName = String(name || '').trim();
  const safeName = sanitizeFileName(rawName);

  if (!safeName) {
    return {
      ok: false,
      description: 'Invalid file or folder name specified.'
    };
  }

  const resolvedDir = resolveDirectory(targetFolder) || {
    name: 'Desktop',
    path: getExistingFolderPath('Desktop')
  };

  let finalName = safeName;
  if (!isFolder && !path.extname(finalName)) {
    finalName += '.txt';
  }

  const destinationPath = path.join(resolvedDir.path, finalName);

  try {
    if (isFolder) {
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
      }
    } else {
      fs.writeFileSync(destinationPath, content || '', 'utf8');
    }

    const safeDestArg = sanitizePowerShellArg(destinationPath);
    const revealCmd = `powershell.exe -NoProfile -NonInteractive -Command "explorer.exe /select,${safeDestArg}"`;
    runPowerShell(revealCmd).catch(() => {});

    const typeLabel = isFolder ? 'folder' : 'file';
    return {
      ok: true,
      path: destinationPath,
      name: finalName,
      folder: resolvedDir.name,
      isFolder,
      description: `Successfully created ${typeLabel} **${finalName}** in your **${resolvedDir.name}** folder.`
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      description: `Could not create ${isFolder ? 'folder' : 'file'}: ${err.message}`
    };
  }
}

// ==================== 🗑️ SAFE FILE & FOLDER DELETER (RECYCLE BIN) ====================
async function deleteFileOrFolder({ name, targetFolder = '', confirmed = false }) {
  const safeName = sanitizeFileName(name);
  if (!safeName) {
    return { ok: false, description: 'Invalid item name provided for deletion.' };
  }

  const resolvedDir = targetFolder ? resolveDirectory(targetFolder) : null;
  const baseDir = resolvedDir ? resolvedDir.path : getExistingFolderPath('Desktop');
  const targetPath = path.join(baseDir, safeName);

  // Require explicit confirmation for safety
  if (!confirmed) {
    return {
      ok: true,
      requiresConfirmation: true,
      tier: PERMISSION_TIERS.DANGEROUS,
      itemPath: targetPath,
      itemName: safeName,
      description: `Targeting **${safeName}** for removal to Recycle Bin at \`${targetPath}\`. Please confirm deletion.`
    };
  }

  if (!fs.existsSync(targetPath)) {
    return {
      ok: false,
      notFound: true,
      description: `Item **${safeName}** does not exist at \`${targetPath}\`.`
    };
  }

  // Safe delete via Microsoft.VisualBasic Recycle Bin API with sanitized argument
  const safeTargetArg = sanitizePowerShellArg(targetPath);
  const psScript = `
    Add-Type -AssemblyName Microsoft.VisualBasic
    if (Test-Path -Path ${safeTargetArg} -PathType Container) {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(${safeTargetArg}, 'OnlyErrorDialogs', 'SendToRecycleBin')
    } else {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(${safeTargetArg}, 'OnlyErrorDialogs', 'SendToRecycleBin')
    }
  `;

  const res = await runPowerShell(psScript);
  return {
    ok: res.ok,
    description: res.ok
      ? `Moved **${safeName}** safely to the Windows Recycle Bin.`
      : `Failed to delete **${safeName}**.`
  };
}

// ==================== ✉️ EMAIL COMPOSER (GMAIL DEEP LINK) ====================
async function composeEmail(target, subject = '', body = '') {
  const contact = contactsService.getPhoneForContact(target);
  const emailAddress = (contact && contact.email) ? contact.email : target;

  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailAddress)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    if (shell && shell.openExternal) {
      await shell.openExternal(url);
    } else {
      await runPowerShell(`start "${url}"`);
    }
  } catch (_) {
    await runPowerShell(`start "${url}"`);
  }

  return {
    ok: true,
    command: `Gmail: "${emailAddress}"`,
    description: `Opened Gmail compose window for **${emailAddress}**.`
  };
}

// ==================== 💬 WHATSAPP DEEP LINK & UI AUTOMATION ====================
async function openWhatsAppChat(contactName, message = '') {
  const contact = contactsService.getPhoneForContact(contactName);
  if (contact && contact.phone) {
    const url = `whatsapp://send?phone=${contact.phone}${message ? '&text=' + encodeURIComponent(message) : ''}`;
    try {
      if (shell && shell.openExternal) {
        await shell.openExternal(url);
      } else {
        await runPowerShell(`start "${url}"`);
      }
    } catch (_) {
      await runPowerShell(`start "${url}"`);
    }
    return {
      ok: true,
      description: `Opened WhatsApp chat with **${contact.displayName}**${message ? ' with message: "' + message + '"' : ''}.`
    };
  }

  // If phone number is directly provided
  if (/^\+?\d+$/.test(contactName.replace(/[\s\-\(\)]/g, ''))) {
    const cleanPhone = contactsService.normalizePhone(contactName);
    const url = `whatsapp://send?phone=${cleanPhone}${message ? '&text=' + encodeURIComponent(message) : ''}`;
    try {
      if (shell && shell.openExternal) {
        await shell.openExternal(url);
      } else {
        await runPowerShell(`start "${url}"`);
      }
    } catch (_) {
      await runPowerShell(`start "${url}"`);
    }
    return { ok: true, description: `Opened WhatsApp chat with **${cleanPhone}**.` };
  }

  // WScript UI Automation Fallback for WhatsApp Desktop App
  const escapedContact = escapePowerShellSingleQuotes(contactName);
  const psScript = `
    $ws = New-Object -ComObject WScript.Shell
    $ws.AppActivate('WhatsApp')
    Start-Sleep -Milliseconds 400
    $ws.SendKeys('^f')
    Start-Sleep -Milliseconds 300
    $ws.SendKeys('${escapedContact}')
    Start-Sleep -Milliseconds 600
    $ws.SendKeys('{ENTER}')
  `;
  const res = await runPowerShell(psScript);
  return { ok: res.ok, description: `Opened WhatsApp and searched for **${contactName}**.` };
}

async function sendWhatsAppMessage({ text, phone = '' }) {
  const msg = String(text || '').trim();
  let deepLink = 'whatsapp://';
  if (phone) {
    deepLink = `whatsapp://send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
  } else if (msg) {
    deepLink = `whatsapp://send?text=${encodeURIComponent(msg)}`;
  }
  const cmd = `start "${deepLink}"`;
  const res = await runPowerShell(cmd);
  return {
    ok: res.ok,
    app: 'WhatsApp',
    command: cmd,
    description: `Opened **WhatsApp** with prepared message: _"${msg}"_`
  };
}

// Backward-compatible openApp / openDirectory aliases
async function openApp(appName) {
  return verifyAndOpenItem(appName);
}

async function openDirectory(dirName) {
  return verifyAndOpenItem(dirName);
}

module.exports = {
  runPowerShell,
  KNOWN_APPS,
  DIRECTORIES,
  WEB_APPS,
  PERMISSION_TIERS,
  resolveApp,
  resolveDirectory,
  resolveWebAppOrUrl,
  verifyAndOpenItem,
  openApp,
  openDirectory,
  closeApp,
  systemControl,
  webSearch,
  spotifySearch,
  notepadWrite,
  createFileOrFolder,
  deleteFileOrFolder,
  findLocalFileOrFolder,
  composeEmail,
  openWhatsAppChat,
  sendWhatsAppMessage
};
