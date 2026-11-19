const express = require("express");
const contacts = require("../models/contacts");
const { paginateContacts } = require("../models/contact-list");
const { positiveInteger, parseListQuery, validateContact } = require("../validators/contacts");

const router = express.Router();
const missingContact = { error: "Контакт не найден." };

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.param("id", (req, res, next, value) => {
  req.contactId = positiveInteger(value, "id");
  next();
});

router.get("/", (req, res) => {
  const query = parseListQuery(req.query);
  res.json(paginateContacts(contacts.list(), query));
});

router.get("/:id", (req, res) => {
  const contact = contacts.get(req.contactId);
  if (!contact) return res.status(404).json(missingContact);
  res.json(contact);
});

router.post("/", (req, res) => {
  const contact = contacts.create(validateContact(req.body));
  res.status(201).location(`/api/contacts/${contact.id}`).json(contact);
});

router.put("/:id", (req, res) => {
  const contact = contacts.update(req.contactId, validateContact(req.body));
  if (!contact) return res.status(404).json(missingContact);
  res.json(contact);
});

router.delete("/:id", (req, res) => {
  if (!contacts.remove(req.contactId)) return res.status(404).json(missingContact);
  res.status(204).end();
});

module.exports = router;
