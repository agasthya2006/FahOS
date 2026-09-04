'use strict';
// FahOS - Native Windows OS & PowerShell Automation Agent
// Executes verified, auditable PowerShell & Shell commands for deep desktop actions.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { exec } = require('child_process');

function runPowerShell(cmd) {
  return new Promise((resolve) => {
    const trimmed = String(cmd || '').trim();
    console.log(`[FahOS OS Agent] Executing Windows Shell Automation: ${trimmed.slice(0, 120)}`);

    if (/^start\s+https?:\/\//i.test(trimmed)) {
      const rawUrl = trimmed.replace(/^start\s+/i, '').replace(/^""\s+/, '').replace(/^["']|["']$/g, '');
      try {
        const { shell } = require('electron');
        if (shell && shell.openExternal) {
          shell.openExternal(rawUrl).then(() => {
            resolve({ ok: true, output: rawUrl });
          }).catch((err) => {
            resolve({ ok: false, error: err.message });
          });
          return;
        }
      } catch (_) {}

      const psCommand = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${rawUrl}'"`;
      exec(psCommand, (err, stdout) => {
        if (err) {
          resolve({ ok: false, error: err.message });
        } else {
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
      return;
    }

    if (!trimmed.includes('\n')) {
      const psCommand = /^powershell(\.exe)?\s+/i.test(trimmed)
        ? trimmed
        : `powershell.exe -NoProfile -NonInteractive -Command "${trimmed.replace(/"/g, '`"')}"`;
      exec(psCommand, (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, error: stderr || err.message, output: stdout ? stdout.trim() : '' });
        } else {
          resolve({ ok: true, output: stdout ? stdout.trim() : '' });
        }
      });
      return;
    }

    const tempFile = path.join(os.tmpdir(), `fahos_action_${Date.now()}.ps1`);
    fs.writeFileSync(tempFile, trimmed, 'utf8');

    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`;
    exec(psCommand, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (_) {}
      if (err) {
        resolve({ ok: false, error: stderr || err.message, output: stdout ? stdout.trim() : '' });
      } else {
        resolve({ ok: true, output: stdout ? stdout.trim() : '' });
      }
    });
  });
}

function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

const KNOWN_APPS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    protocol: 'whatsapp:',
    aliases: ['whatsapp', 'whattsapp', 'whatapp', 'watsapp', 'watsap', 'whatsap', 'whatsup', 'whtasapp', 'wtsp', 'watsp', 'wtsapp', 'whatssapp']
  },
  {
    id: 'spotify',
    name: 'Spotify',
    protocol: 'spotify:',
    aliases: ['spotify', 'spotfy', 'spotifiy', 'spotfiy', 'spoty', 'spotifi', 'spotif']
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    command: 'chrome',
    url: 'https://www.google.com',
    aliases: ['chrome', 'crome', 'chome', 'crom', 'chrom', 'google chrome', 'browser', 'web browser', 'internet']
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    command: 'msedge',
    aliases: ['edge', 'msedge', 'microsoft edge']
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    command: 'code',
    aliases: ['vscode', 'vs code', 'code', 'visual studio code', 'vs-code', 'editor']
  },
  {
    id: 'calculator',
    name: 'Calculator',
    protocol: 'calculator:',
    command: 'calc.exe',
    aliases: ['calculator', 'calc', 'calculater', 'calclator', 'caluculator', 'calcy', 'calcilator', 'math']
  },
  {
    id: 'notepad',
    name: 'Notepad',
    command: 'notepad.exe',
    aliases: ['notepad', 'notpad', 'notespad', 'notes', 'note pad', 'text editor']
  },
  {
    id: 'explorer',
    name: 'File Explorer',
    command: 'explorer.exe',
    aliases: ['explorer', 'files', 'file explorer', 'filemanager', 'file manager', 'my computer', 'this pc', 'folders']
  },
  {
    id: 'settings',
    name: 'Windows Settings',
    protocol: 'ms-settings:',
    aliases: ['settings', 'setings', 'setting', 'control panel', 'windows settings', 'preferences']
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    aliases: ['youtube', 'ytube', 'you tube', 'yt']
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    aliases: ['gmail', 'g-mail', 'g mail', 'google mail', 'mail', 'email']
  },
  {
    id: 'terminal',
    name: 'Windows Terminal',
    command: 'wt.exe',
    aliases: ['terminal', 'wt', 'windows terminal', 'console']
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    command: 'cmd.exe',
    aliases: ['cmd', 'command prompt', 'prompt']
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    command: 'powershell.exe',
    aliases: ['powershell', 'powershel', 'posh']
  },
  {
    id: 'camera',
    name: 'Camera',
    protocol: 'microsoft.windows.camera:',
    aliases: ['camera', 'camra', 'cam', 'webcam']
  },
  {
    id: 'paint',
    name: 'Paint',
    command: 'mspaint.exe',
    aliases: ['paint', 'mspaint', 'drawing']
  },
  {
    id: 'taskmgr',
    name: 'Task Manager',
    command: 'taskmgr.exe',
    aliases: ['task manager', 'taskmanager', 'taskmgr', 'tasks']
  }
];

function getExistingFolderPath(folderName) {
  const home = os.homedir();
  const oneDrive = process.env.OneDrive || path.join(home, 'OneDrive');
  const candidate1 = path.join(oneDrive, folderName);
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(home, folderName);
  if (fs.existsSync(candidate2)) return candidate2;
  return candidate1;
}

const DIRECTORIES = [
  {
    id: 'downloads',
    name: 'Downloads',
    getPath: () => getExistingFolderPath('Downloads'),
    aliases: ['downloads', 'download', 'downlod', 'downloads folder', 'download folder']
  },
  {
    id: 'desktop',
    name: 'Desktop',
    getPath: () => getExistingFolderPath('Desktop'),
    aliases: ['desktop', 'dekstop', 'desktp', 'desktop folder']
  },
  {
    id: 'documents',
    name: 'Documents',
    getPath: () => getExistingFolderPath('Documents'),
    aliases: ['documents', 'document', 'docs', 'docments', 'documents folder', 'my documents']
  },
  {
    id: 'pictures',
    name: 'Pictures',
    getPath: () => getExistingFolderPath('Pictures'),
    aliases: ['pictures', 'picture', 'photos', 'images', 'pics', 'pictures folder', 'my pictures']
  },
  {
    id: 'music',
    name: 'Music',
    getPath: () => getExistingFolderPath('Music'),
    aliases: ['music', 'songs', 'audio', 'music folder', 'my music']
  },
  {
    id: 'videos',
    name: 'Videos',
    getPath: () => getExistingFolderPath('Videos'),
    aliases: ['videos', 'video', 'movies', 'videos folder', 'my videos']
  }
];

function resolveDirectory(rawName) {
  let norm = String(rawName || '').toLowerCase().trim().replace(/[\.\?!,;]+$/, '').trim();
  if (!norm) return null;

  norm = norm.replace(/^(?:open|start|go\s+to|show|view)\s+(?:files\s+and\s+(?:open\s+)?)?/i, '').trim();
  norm = norm.replace(/^(?:the\s+)?/i, '').trim();

  if (/^[a-zA-Z]:[\\\/]/.test(norm)) {
    return { name: norm, path: norm };
  }

  for (const d of DIRECTORIES) {
    if (d.id === norm || d.aliases.includes(norm)) {
      return { name: d.name, path: d.getPath() };
    }
  }

  for (const d of DIRECTORIES) {
    for (const alias of d.aliases) {
      if (norm.includes(alias) || alias.includes(norm)) {
        return { name: d.name, path: d.getPath() };
      }
    }
  }

  for (const d of DIRECTORIES) {
    for (const alias of d.aliases) {
      if (levenshtein(norm, alias) <= 2) {
        return { name: d.name, path: d.getPath() };
      }
    }
  }

  return null;
}

function resolveApp(rawName) {
  const norm = String(rawName || '').toLowerCase().trim().replace(/[\.\?!,;]+$/, '');
  if (!norm) return null;

  for (const app of KNOWN_APPS) {
    if (app.id === norm || app.aliases.includes(norm)) {
      return app;
    }
  }

  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      if (alias.startsWith(norm) || (norm.length >= 4 && alias.includes(norm))) {
        return app;
      }
    }
  }

  let bestMatch = null;
  let minDistance = Infinity;
  for (const app of KNOWN_APPS) {
    for (const alias of app.aliases) {
      const dist = levenshtein(norm, alias);
      const maxAllowedDist = alias.length > 5 ? 2 : 1;
      if (dist <= maxAllowedDist && dist < minDistance) {
        minDistance = dist;
        bestMatch = app;
      }
    }
  }

  return bestMatch;
}

// 1. Open Desktop Application
async function openApp(appName) {
  const norm = String(appName || '').trim().replace(/[\.\?!,;]+$/, '');
  const app = resolveApp(norm);
  let target = '';
  let label = norm;

  if (app) {
    label = app.name;
    target = app.protocol || app.url || app.command;
  } else {
    target = norm;
  }

  const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${target}'"`;
  const res = await runPowerShell(psCmd);
  return {
    ok: res.ok,
    app: label,
    command: psCmd,
    description: `Launched **${label}**.`
  };
}

// 2. Open Directory in File Explorer
async function openDirectory(dirNameOrPath) {
  const norm = String(dirNameOrPath || '').trim();
  const resolved = resolveDirectory(norm);
  const targetPath = resolved ? resolved.path : norm;
  const label = resolved ? resolved.name : path.basename(targetPath) || targetPath;

  try {
    const { shell } = require('electron');
    if (shell && shell.openPath) {
      const errMsg = await shell.openPath(targetPath);
      if (!errMsg) {
        return {
          ok: true,
          app: 'File Explorer',
          command: `explorer.exe "${targetPath}"`,
          description: `Opened **${label}** folder in File Explorer.`
        };
      }
    }
  } catch (_) {}

  const psCmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process explorer.exe -ArgumentList '${targetPath}'"`;
  const res = await runPowerShell(psCmd);
  return {
    ok: res.ok,
    app: 'File Explorer',
    command: psCmd,
    description: `Opened **${label}** folder in File Explorer.`
  };
}

// 3. Native Windows System & Media Controls
async function systemControl({ action }) {
  const act = String(action || '').toLowerCase().trim();
  let script = '';
  let desc = '';

  switch (act) {
    case 'volume_up':
    case 'volume up':
    case 'louder':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]175)';
      desc = '🔊 Volume increased.';
      break;
    case 'volume_down':
    case 'volume down':
    case 'lower volume':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]174)';
      desc = '🔉 Volume decreased.';
      break;
    case 'mute':
    case 'unmute':
      script = '(New-Object -ComObject WScript.Shell).SendKeys([char]173)';
      desc = '🔇 Audio mute/unmute toggled.';
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

// 4. Web and YouTube Search
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

  const cmd = `start ${targetUrl}`;
  const res = await runPowerShell(cmd);
  return {
    ok: res.ok,
    app: label,
    command: cmd,
    description: `Opened **${label}** for: _"${q}"_.`
  };
}

// 5. Spotify Search & Play
async function spotifySearch({ query }) {
  const q = String(query || '').trim();
  const cmd = `start spotify:search:${encodeURIComponent(q)}`;
  const res = await runPowerShell(cmd);
  return {
    ok: res.ok,
    app: 'Spotify',
    command: cmd,
    description: `Opened **Spotify** searching for track/artist: _"${q}"_`
  };
}

// 6. WhatsApp Message / Protocol
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

// 7. Notepad Quick Note
async function notepadWrite({ content }) {
  const text = String(content || '').trim();
  const script = `$p = "$env:USERPROFILE\\Desktop\\FahOS_Notes.txt"; Add-Content -Path $p -Value "${text.replace(/"/g, '`"')}"; Start-Process "notepad.exe" $p`;
  const res = await runPowerShell(script);
  return {
    ok: res.ok,
    app: 'Notepad',
    command: script,
    description: `Saved note to Desktop and opened in **Notepad**: _"${text}"_`
  };
}

// 8. Create File or Folder
async function createFileOrFolder({ name, targetFolder = 'Desktop', isFolder = false, content = '' }) {
  const rawName = String(name || '').trim();
  const rawFolder = String(targetFolder || 'Desktop').trim();

  let targetDir = getExistingFolderPath('Desktop');
  let folderDisplayName = 'Desktop';

  const resolvedDir = resolveDirectory(rawFolder);
  if (resolvedDir && resolvedDir.path && fs.existsSync(resolvedDir.path)) {
    targetDir = resolvedDir.path;
    folderDisplayName = resolvedDir.name;
  } else if (fs.existsSync(rawFolder)) {
    targetDir = rawFolder;
    folderDisplayName = path.basename(rawFolder);
  }

  let finalName = rawName;
  if (!isFolder && !path.extname(finalName)) {
    finalName += '.txt';
  }

  const destinationPath = path.join(targetDir, finalName);

  try {
    if (isFolder) {
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
      }
    } else {
      fs.writeFileSync(destinationPath, content || '', 'utf8');
    }

    const revealCmd = `powershell.exe -NoProfile -NonInteractive -Command "explorer.exe /select,'${destinationPath}'"`;
    runPowerShell(revealCmd).catch(() => {});

    return {
      ok: true,
      path: destinationPath,
      name: finalName,
      folder: folderDisplayName,
      isFolder,
      command: `Create ${isFolder ? 'Folder' : 'File'}: "${destinationPath}"`,
      description: `Successfully created ${isFolder ? 'folder' : 'file'} **${finalName}** in your **${folderDisplayName}** folder.`
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      description: `Could not create ${isFolder ? 'folder' : 'file'}: ${err.message}`
    };
  }
}

// 9. Scan for Local Files or Folders
function findLocalFileOrFolder(searchTerm) {
  const norm = String(searchTerm || '').toLowerCase().trim().replace(/[\.\?!,;]+$/, '').trim();
  if (!norm) return null;

  const searchRoots = [
    getExistingFolderPath('Desktop'),
    getExistingFolderPath('Downloads'),
    getExistingFolderPath('Documents'),
    getExistingFolderPath('Pictures'),
    getExistingFolderPath('Videos'),
    getExistingFolderPath('Music')
  ];

  const matched = [];

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    try {
      const items = fs.readdirSync(root, { withFileTypes: true });
      for (const item of items) {
        const itemName = item.name.toLowerCase();
        const fullPath = path.join(root, item.name);

        if (itemName === norm || path.parse(itemName).name.toLowerCase() === norm) {
          return {
            name: item.name,
            path: fullPath,
            isDirectory: item.isDirectory(),
            confidence: 1.0,
            location: path.basename(root)
          };
        }

        if (norm.length >= 3 && itemName.length >= 3) {
          if (itemName.includes(norm)) {
            matched.push({
              name: item.name,
              path: fullPath,
              isDirectory: item.isDirectory(),
              confidence: 0.8,
              location: path.basename(root)
            });
          }
        }
      }
    } catch (_) {}
  }

  if (matched.length > 0) {
    matched.sort((a, b) => b.confidence - a.confidence);
    return matched[0];
  }

  return null;
}

// 10. Verify and Open Any Item (Observe-Plan-Verify)
async function verifyAndOpenItem(query) {
  const norm = String(query || '').trim().replace(/[\.\?!,;]+$/, '').trim();

  const dirMatch = resolveDirectory(norm);
  if (dirMatch && dirMatch.path && fs.existsSync(dirMatch.path)) {
    const openRes = await openDirectory(dirMatch.path);
    return {
      ok: true,
      type: 'directory',
      name: dirMatch.name,
      path: dirMatch.path,
      command: openRes.command,
      description: `Opened **${dirMatch.name}** folder in File Explorer.`
    };
  }

  const appMatch = resolveApp(norm);
  if (appMatch) {
    const appRes = await openApp(norm);
    return {
      ok: appRes.ok,
      type: 'app',
      name: appMatch.name,
      command: appRes.command,
      description: `Launched **${appMatch.name}**.`
    };
  }

  const fileMatch = findLocalFileOrFolder(norm);
  if (fileMatch && fileMatch.path) {
    let opened = false;
    let cmd = '';
    try {
      const { shell } = require('electron');
      if (shell && shell.openPath) {
        const err = await shell.openPath(fileMatch.path);
        if (!err) {
          opened = true;
          cmd = `explorer.exe "${fileMatch.path}"`;
        }
      }
    } catch (_) {}

    if (!opened) {
      cmd = `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${fileMatch.path}'"`;
      const psRes = await runPowerShell(cmd);
      opened = psRes.ok;
    }

    return {
      ok: opened,
      type: fileMatch.isDirectory ? 'folder' : 'file',
      name: fileMatch.name,
      path: fileMatch.path,
      command: cmd,
      description: `Opened ${fileMatch.isDirectory ? 'folder' : 'file'} **${fileMatch.name}** (_${fileMatch.location}_).`
    };
  }

  // 4. If NOT found in Windows environment, Check Browser / Web App
  const webMatch = modularSystem.resolveWebAppOrUrl ? modularSystem.resolveWebAppOrUrl(norm) : null;
  if (webMatch) {
    const res = await runPowerShell(`start "${webMatch.url}"`);
    return {
      ok: res.ok,
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

// Modular Windows OS & PowerShell Automation Engine integration
const modularSystem = require('../main/features/system/systemActions');

module.exports = {
  runPowerShell,
  KNOWN_APPS,
  DIRECTORIES,
  resolveApp,
  resolveDirectory,
  openApp,
  openDirectory,
  systemControl,
  webSearch,
  spotifySearch,
  sendWhatsAppMessage,
  notepadWrite,
  createFileOrFolder,
  findLocalFileOrFolder,
  verifyAndOpenItem,
  closeApp: modularSystem.closeApp,
  resolveWebAppOrUrl: modularSystem.resolveWebAppOrUrl,
  WEB_APPS: modularSystem.WEB_APPS,
  deleteFileOrFolder: modularSystem.deleteFileOrFolder,
  composeEmail: modularSystem.composeEmail,
  openWhatsAppChat: modularSystem.openWhatsAppChat,
  PERMISSION_TIERS: modularSystem.PERMISSION_TIERS
};
