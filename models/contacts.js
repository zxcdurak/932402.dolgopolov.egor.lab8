const db = require("../db/database");

const columns = "id, full_name, phone, email, notes";
const selectAll = db.prepare(`SELECT ${columns} FROM contacts`);
const selectById = db.prepare(`SELECT ${columns} FROM contacts WHERE id = ?`);
const insert = db.prepare(`
  INSERT INTO contacts (full_name, phone, email, notes)
  VALUES (@full_name, @phone, @email, @notes)
  RETURNING ${columns}
`);
const updateById = db.prepare(`
  UPDATE contacts SET full_name = @full_name, phone = @phone, email = @email, notes = @notes
  WHERE id = @id
  RETURNING ${columns}
`);
const deleteById = db.prepare("DELETE FROM contacts WHERE id = ?");

module.exports = {
  list: () => selectAll.all(),
  get: (id) => selectById.get(id),
  create: (contact) => insert.get(contact),
  update: (id, contact) => updateById.get({ id, ...contact }),
  remove: (id) => deleteById.run(id).changes > 0,
};
