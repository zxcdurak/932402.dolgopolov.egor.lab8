function notFound(req, res) {
  res.status(404).json({ error: "Страница не найдена." });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || error.statusCode || 500;
  let message = error.message;
  if (status >= 500) {
    console.error(error);
    message = "Внутренняя ошибка сервера.";
  } else if (error.type === "entity.parse.failed") {
    message = "Проверьте формат JSON в запросе.";
  } else if (error.type === "entity.too.large") {
    message = "Запрос слишком большой.";
  }

  res.status(status).json({ error: message, field: error.field });
}

module.exports = { notFound, errorHandler };
