const { alphabet } = require("../models/contact-list");

function badRequest(message, field) {
  return Object.assign(new Error(message), { status: 400, field });
}

function positiveInteger(value, field, max = Number.MAX_SAFE_INTEGER) {
  const message = `Недопустимое значение параметра ${field}.`;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw badRequest(message);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw badRequest(message);
  return number;
}

function parseListQuery(query) {
  const page = query.page === undefined ? 1 : positiveInteger(query.page, "page");
  const limit = query.limit === undefined ? 10 : positiveInteger(query.limit, "limit", 100);
  if (!Number.isSafeInteger(page * limit)) throw badRequest("Номер страницы слишком большой.");
  if (query.q !== undefined && typeof query.q !== "string") throw badRequest("Ожидается строка поиска.");
  const q = (query.q || "").trim().slice(0, 100);

  let letter = "";
  if (query.letter !== undefined) {
    const message = "Укажите одну букву алфавита или #.";
    if (typeof query.letter !== "string") throw badRequest(message);
    letter = query.letter.trim().normalize("NFC").toUpperCase();
    if (!alphabet.includes(letter)) throw badRequest(message);
  }
  return { q, page, limit, letter };
}

function readText(body, field, label, limit) {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest(`Поле «${label}» должно содержать текст.`, field);

  const text = value.trim();
  if (text.length > limit) {
    throw badRequest(`Максимальная длина поля «${label}» — ${limit} символов.`, field);
  }
  return text || null;
}

function validateContact(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Ожидается объект JSON с данными контакта.");
  }

  const full_name = readText(body, "full_name", "Имя", 100);
  if (!full_name) throw badRequest("Введите имя контакта.", "full_name");

  const phone = readText(body, "phone", "Телефон", 30);
  if (phone && (!/^[\d+() -]+$/.test(phone) || !/\d/.test(phone))) {
    throw badRequest("Введите телефон цифрами. Можно использовать +, пробелы, скобки и дефисы.", "phone");
  }

  const email = readText(body, "email", "Email", 100);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("Введите email в формате name@example.com.", "email");
  }

  const notes = readText(body, "notes", "Заметки", 1000);
  return { full_name, phone, email, notes };
}

module.exports = { positiveInteger, parseListQuery, validateContact };
