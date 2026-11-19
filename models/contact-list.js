const alphabet = [..."АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ#"];
const letterOrder = new Map(alphabet.map((letter, index) => [letter, index]));
const collator = new Intl.Collator("ru", { sensitivity: "base" });

function initialOf(name) {
  const initial = name.trimStart().normalize("NFC")[0]?.toUpperCase();
  return letterOrder.has(initial) ? initial : "#";
}

function normalizeName(name) {
  return name.normalize("NFC").toLocaleLowerCase("ru");
}

function digits(value) {
  return value.replace(/\D/g, "");
}

function paginateContacts(contacts, { q, page, limit, letter }) {
  const nameQuery = normalizeName(q);
  const phoneQuery = /^[\d+() -]+$/.test(q) ? digits(q) : "";
  const initials = new Set();
  const matches = [];

  for (const contact of contacts) {
    const matchesName = normalizeName(contact.full_name).includes(nameQuery);
    const matchesPhone = phoneQuery && contact.phone && digits(contact.phone).includes(phoneQuery);
    if (!matchesName && !matchesPhone) continue;

    const initial = initialOf(contact.full_name);
    initials.add(initial);
    if (!letter || initial === letter) matches.push({ ...contact, initial });
  }

  matches.sort((a, b) => letterOrder.get(a.initial) - letterOrder.get(b.initial)
    || collator.compare(a.full_name, b.full_name)
    || a.id - b.id);

  const offset = (page - 1) * limit;
  return {
    data: matches.slice(offset, offset + limit),
    total: matches.length,
    page,
    limit,
    totalPages: Math.ceil(matches.length / limit),
    letters: alphabet.filter((initial) => initials.has(initial)),
  };
}

module.exports = { alphabet, paginateContacts };
