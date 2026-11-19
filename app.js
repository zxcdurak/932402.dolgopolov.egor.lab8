const path = require("node:path");
const express = require("express");
const db = require("./db/database");
const pagesRouter = require("./routes/pages");
const contactsRouter = require("./routes/contacts");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const host = "127.0.0.1";
const port = Number(process.env.PORT || 3001);

app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use(pagesRouter);
app.use("/api/contacts", express.json({ limit: "10kb" }), contactsRouter);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, host);
server.on("listening", () => console.log(`Адресная книга открыта на http://${host}:${server.address().port}`));
server.on("error", (error) => {
  console.error(error.message);
  db.close();
  process.exitCode = 1;
});

function close() {
  process.removeListener("SIGINT", close);
  process.removeListener("SIGTERM", close);
  server.close(() => db.close());
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
