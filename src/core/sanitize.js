'use strict';
// FahOS - Input Sanitization & Security Validation Utilities

/**
 * Escapes a string for safe inclusion in a PowerShell single-quoted string.
 * In PowerShell, single-quoted strings ('...') are strictly literal —
 * variables ($var), backticks (`), and subexpressions ($(...)) are NOT expanded.
 * The only escape sequence is doubling single quotes (' -> '').
 *
 * @param {string} input - Raw string argument to sanitize
 * @returns {string} - Escaped string safe to enclose in single quotes
 */
function escapePowerShellSingleQuotes(input) {
  if (typeof input !== 'string') return '';
  const cleaned = input.replace(/[\0\r]/g, '');
  return cleaned.replace(/'/g, "''");
}

/**
 * Wraps an argument in PowerShell single quotes after escaping single quotes.
 * Safe for use in PowerShell commands.
 *
 * @param {string} input
 * @returns {string} - e.g. 'safe''arg'
 */
function sanitizePowerShellArg(input) {
  return `'${escapePowerShellSingleQuotes(String(input || ''))}'`;
}

/**
 * Escapes special characters for safe inclusion in HTML/DOM to prevent XSS.
 *
 * @param {string} str - Raw text
 * @returns {string} - HTML entity encoded string
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and normalizes file/folder names to prevent directory traversal
 * and illegal filename characters on Windows.
 *
 * @param {string} name - Raw filename or directory name
 * @returns {string} - Sanitized safe name
 */
function sanitizeFileName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    .replace(/\.{2,}/g, '') // remove consecutive dots to block .. traversal
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
}

module.exports = {
  escapePowerShellSingleQuotes,
  sanitizePowerShellArg,
  escapeHTML,
  sanitizeFileName
};
