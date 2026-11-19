import { getContacts, saveContact, deleteContact } from "./api.js";

const byId = (id) => document.getElementById(id);
const elements = {
  search: byId("search"),
  alphabet: byId("alphabet"),
  status: byId("results-status"),
  empty: byId("empty-message"),
  loadError: byId("load-error"),
  loadErrorMessage: byId("load-error-message"),
  retry: byId("retry"),
  change: byId("change-message"),
  deleteError: byId("delete-error"),
  groups: byId("contact-groups"),
  pagination: byId("pagination"),
  previous: byId("previous-page"),
  next: byId("next-page"),
  pageNumber: byId("page-number"),
  add: byId("add-contact"),
  dialog: byId("contact-dialog"),
  dialogTitle: byId("dialog-title"),
  form: byId("contact-form"),
  fields: byId("contact-fields"),
  formError: byId("form-error"),
  cancel: byId("cancel-edit"),
  save: byId("save-contact"),
};

const fields = {
  full_name: byId("full-name"),
  phone: byId("phone"),
  email: byId("email"),
  notes: byId("notes"),
};
const state = { q: "", letter: "", page: 1, limit: 9, totalPages: 0 };
const deleting = new Set();
let listRequest;
let searchTimer;
let editedId;
let dialogOpener;
let saving = false;

function showMessage(element, message = "") {
  element.textContent = message;
  element.hidden = !message;
}

function button(label, className) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.textContent = label;
  return control;
}

function renderAlphabet(letters) {
  const active = document.activeElement;
  const focusLetter = elements.alphabet.contains(active) ? active.dataset.letter : undefined;
  const buttons = ["", ...letters].map((letter) => {
    const control = button(letter === "#" ? "#" : letter || "Все", "filter-button");
    if (letter === "#") control.setAttribute("aria-label", "# — прочие символы");
    control.dataset.letter = letter;
    control.setAttribute("aria-pressed", String(letter === state.letter));
    return control;
  });

  elements.alphabet.replaceChildren(...buttons);
  if (focusLetter !== undefined) (buttons.find((item) => item.dataset.letter === focusLetter) || buttons[0]).focus();
}

function addDetail(details, label, value, href) {
  if (!value) return;
  const row = document.createElement("div");
  const name = document.createElement("dt");
  const content = document.createElement("dd");
  name.textContent = label;
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = value;
    content.append(link);
  } else {
    content.textContent = value;
  }
  row.append(name, content);
  details.append(row);
}

function renderCard(contact) {
  const item = document.createElement("li");
  const card = document.createElement("article");
  card.className = "contact-card";

  const header = document.createElement("header");
  header.className = "card-heading";
  const monogram = document.createElement("span");
  monogram.className = "monogram";
  monogram.setAttribute("aria-hidden", "true");
  monogram.textContent = contact.full_name.normalize("NFC").split(/\s+/).slice(0, 2)
    .map((part) => [...part][0]).join("").toUpperCase();
  const title = document.createElement("h3");
  title.textContent = contact.full_name;
  header.append(monogram, title);
  card.append(header);

  const details = document.createElement("dl");
  details.className = "contact-details";
  if (contact.phone) {
    const prefix = contact.phone.startsWith("+") ? "+" : "";
    const number = contact.phone.replace(/\D/g, "");
    addDetail(details, "Телефон", contact.phone, `tel:${prefix}${number}`);
  }
  if (contact.email) {
    const address = encodeURIComponent(contact.email).replace("%40", "@");
    addDetail(details, "Email", contact.email, `mailto:${address}`);
  }
  addDetail(details, "Заметки", contact.notes);
  if (details.childElementCount) card.append(details);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const edit = button("Изменить", "secondary");
  edit.dataset.editId = String(contact.id);
  edit.setAttribute("aria-label", `Изменить ${contact.full_name}`);
  edit.addEventListener("click", () => openEditor(contact, edit));
  const remove = button("Удалить", "delete-button");
  remove.dataset.deleteId = String(contact.id);
  remove.setAttribute("aria-label", `Удалить ${contact.full_name}`);
  if (deleting.has(contact.id)) remove.setAttribute("aria-disabled", "true");
  remove.addEventListener("click", () => removeContact(contact));
  actions.append(edit, remove);
  card.append(actions);
  item.append(card);
  return item;
}

function renderGroups(contacts) {
  const active = document.activeElement;
  const editId = active.dataset.editId;
  const deleteId = active.dataset.deleteId;
  const groups = new Map();
  for (const contact of contacts) {
    if (!groups.has(contact.initial)) groups.set(contact.initial, []);
    groups.get(contact.initial).push(contact);
  }

  const fragment = document.createDocumentFragment();
  for (const [letter, members] of groups) {
    const section = document.createElement("section");
    const title = document.createElement("h2");
    title.className = "group-title";
    title.textContent = letter === "#" ? "# — прочие" : letter;
    const list = document.createElement("ul");
    list.className = "contact-grid";
    list.setAttribute("role", "list");
    for (const contact of members) list.append(renderCard(contact));
    section.append(title, list);
    fragment.append(section);
  }

  elements.groups.replaceChildren(fragment);
  if (editId || deleteId) {
    const selector = editId ? `[data-edit-id="${editId}"]` : `[data-delete-id="${deleteId}"]`;
    (elements.groups.querySelector(selector) || elements.add).focus();
  }
}

function renderPagination() {
  const active = document.activeElement;
  const hasFocus = elements.pagination.contains(active);
  elements.pagination.hidden = state.totalPages < 2;
  elements.previous.disabled = state.page <= 1;
  elements.next.disabled = state.page >= state.totalPages;
  elements.pageNumber.textContent = `Страница ${state.page} из ${state.totalPages}`;
  if (hasFocus && (elements.pagination.hidden || active.disabled)) {
    const nextFocus = elements.pagination.hidden ? elements.search :
      (elements.next.disabled ? elements.previous : elements.next);
    nextFocus.focus();
  }
}

async function loadContacts() {
  clearTimeout(searchTimer);
  listRequest?.abort();
  const controller = new AbortController();
  listRequest = controller;

  elements.groups.setAttribute("aria-busy", "true");
  elements.status.textContent = "Загрузка контактов…";
  elements.loadError.hidden = true;
  elements.empty.hidden = true;

  try {
    const result = await getContacts(state, controller.signal);
    if (controller.signal.aborted) return;

    if (state.letter && !result.letters.includes(state.letter)) {
      state.letter = "";
      state.page = 1;
      return loadContacts();
    }

    const lastPage = Math.max(1, result.totalPages);
    if (state.page > lastPage) {
      state.page = lastPage;
      return loadContacts();
    }

    state.totalPages = result.totalPages;
    renderAlphabet(result.letters);
    renderGroups(result.data);
    renderPagination();
    elements.status.textContent = `Найдено контактов: ${result.total}`;
    if (!result.total) {
      showMessage(elements.empty, state.q ? "По этому запросу ничего не найдено." : "Пока нет контактов. Добавьте первый контакт.");
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    elements.status.textContent = "";
    elements.loadError.hidden = false;
    elements.loadErrorMessage.textContent = error.message;
  } finally {
    if (listRequest === controller && !controller.signal.aborted) {
      listRequest = undefined;
      elements.groups.setAttribute("aria-busy", "false");
    }
  }
}

function clearFieldError(field) {
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
  showMessage(byId(`${field.id}-error`));
}

function showFormError(message, name) {
  if (name && Object.hasOwn(fields, name)) {
    const field = fields[name];
    const hint = byId(`${field.id}-error`);
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", hint.id);
    showMessage(hint, message);
    field.focus();
  } else {
    showMessage(elements.formError, message);
  }
}

function openEditor(contact, opener) {
  if (elements.dialog.open) return;
  dialogOpener = opener;
  editedId = contact?.id;
  elements.form.reset();
  showMessage(elements.formError);
  showMessage(elements.change);
  for (const [name, field] of Object.entries(fields)) {
    clearFieldError(field);
    field.value = contact?.[name] ?? "";
  }
  elements.dialogTitle.textContent = editedId ? "Редактирование контакта" : "Новый контакт";
  elements.save.textContent = editedId ? "Сохранить" : "Добавить";
  elements.dialog.showModal();
  fields.full_name.focus();
}

function setSaving(isSaving) {
  saving = isSaving;
  elements.fields.disabled = isSaving;
  elements.save.disabled = isSaving;
  elements.cancel.disabled = isSaving;
  elements.save.textContent = isSaving ? "Сохранение…" : (editedId ? "Сохранить" : "Добавить");
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saving) return;
  showMessage(elements.formError);
  for (const field of Object.values(fields)) clearFieldError(field);
  const payload = Object.fromEntries(new FormData(elements.form));
  for (const key of Object.keys(payload)) payload[key] = payload[key].trim();

  if (!payload.full_name) return showFormError("Введите имя контакта.", "full_name");
  if (payload.phone && (!/^[\d+() -]+$/.test(payload.phone) || !/\d/.test(payload.phone))) {
    return showFormError("Введите телефон цифрами. Можно использовать +, пробелы, скобки и дефисы.", "phone");
  }
  if (payload.email && (fields.email.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))) {
    return showFormError("Введите email в формате name@example.com.", "email");
  }

  setSaving(true);
  try {
    await saveContact(editedId, payload);
  } catch (error) {
    setSaving(false);
    return showFormError(error.message, error.field);
  }
  setSaving(false);
  elements.dialog.close();
  showMessage(elements.change, editedId ? "Контакт обновлён." : "Контакт добавлен.");
  await loadContacts();
});

async function removeContact(contact) {
  if (deleting.has(contact.id) || !window.confirm(`Удалить контакт «${contact.full_name}»?`)) return;
  deleting.add(contact.id);
  const selector = `[data-delete-id="${contact.id}"]`;
  elements.groups.querySelector(selector)?.setAttribute("aria-disabled", "true");
  showMessage(elements.deleteError);
  showMessage(elements.change);
  try {
    await deleteContact(contact.id);
    showMessage(elements.change, "Контакт удалён.");
    await loadContacts();
  } catch (error) {
    showMessage(elements.deleteError, error.message);
  } finally {
    deleting.delete(contact.id);
    elements.groups.querySelector(selector)?.removeAttribute("aria-disabled");
  }
}

elements.add.addEventListener("click", () => openEditor(null, elements.add));
elements.cancel.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("cancel", (event) => {
  if (saving) event.preventDefault();
});
elements.dialog.addEventListener("close", () => {
  if (elements.dialog.open) return;
  const editId = dialogOpener?.dataset.editId;
  const replacement = editId ? elements.groups.querySelector(`[data-edit-id="${editId}"]`) : null;
  (dialogOpener?.isConnected ? dialogOpener : replacement || elements.add).focus();
});
for (const field of Object.values(fields)) {
  field.addEventListener("input", () => clearFieldError(field));
}

elements.search.addEventListener("input", () => {
  state.q = elements.search.value.trim();
  state.letter = "";
  state.page = 1;
  state.totalPages = 0;
  renderPagination();
  showMessage(elements.change);
  listRequest?.abort();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadContacts, 250);
});

elements.alphabet.addEventListener("click", (event) => {
  const control = event.target.closest("button[data-letter]");
  if (!control || control.dataset.letter === state.letter) return;
  state.letter = control.dataset.letter;
  state.page = 1;
  showMessage(elements.change);
  loadContacts();
});

function changePage(step) {
  const page = state.page + step;
  if (page < 1 || page > state.totalPages) return;
  state.page = page;
  loadContacts();
}

elements.previous.addEventListener("click", () => changePage(-1));
elements.next.addEventListener("click", () => changePage(1));
elements.retry.addEventListener("click", () => {
  elements.search.focus();
  loadContacts();
});

loadContacts();
