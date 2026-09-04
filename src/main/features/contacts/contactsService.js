'use strict';
// Local-First WhatsApp & Phone Contacts Manager
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let contactsFilePath = null;

function getContactsPath() {
  if (contactsFilePath) return contactsFilePath;
  try {
    const userData = app ? app.getPath('userData') : path.join(process.env.APPDATA || '', 'FahOS');
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
    contactsFilePath = path.join(userData, 'fahos_contacts.json');
  } catch (e) {
    contactsFilePath = path.join(__dirname, '..', '..', 'fahos_contacts.json');
  }
  return contactsFilePath;
}

function loadContacts() {
  const p = getContactsPath();
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {}
  return {};
}

function saveContacts(contactsObj) {
  try {
    fs.writeFileSync(getContactsPath(), JSON.stringify(contactsObj, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

// Crucial: Sanitizes phone numbers for WhatsApp deep linking (e.g., "+91 96665 20789" -> "919666520789")
function normalizePhone(phone) {
  let cleaned = String(phone || '').replace(/[\s\-\(\)]/g, '').trim();
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.length === 10 && !cleaned.startsWith('91')) cleaned = '91' + cleaned;
  return cleaned;
}

function saveContact(name, phone, email = '') {
  const contacts = loadContacts();
  const key = normalizeName(name);
  const formattedPhone = phone ? normalizePhone(phone) : '';
  const formattedEmail = String(email || '').trim().toLowerCase();

  contacts[key] = {
    displayName: name.trim(),
    phone: formattedPhone,
    email: formattedEmail
  };
  saveContacts(contacts);
  return contacts[key];
}

function deleteContact(name) {
  const contacts = loadContacts();
  const target = normalizeName(name);
  for (const k in contacts) {
    if (k === target || normalizeName(contacts[k].displayName) === target) {
      delete contacts[k];
      saveContacts(contacts);
      return true;
    }
  }
  return false;
}

function getAllContacts() {
  return Object.values(loadContacts());
}

function getPhoneForContact(name) {
  const contacts = loadContacts();
  const target = normalizeName(name);
  for (const k in contacts) {
    if (k === target || normalizeName(contacts[k].displayName) === target) {
      return contacts[k];
    }
  }
  return null;
}

module.exports = { saveContact, deleteContact, getAllContacts, normalizePhone, getPhoneForContact, getContactByName: getPhoneForContact };
