const collection = "/api/contacts";

async function request(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Не удалось связаться с сервером. Попробуйте ещё раз.");
  }

  if (response.status === 204) return;
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    const error = new Error(body?.error || "Не удалось обработать ответ сервера.");
    error.field = body?.field;
    throw error;
  }
  return body;
}

export function getContacts({ q, letter, page, limit }, signal) {
  const params = new URLSearchParams({ page, limit });
  if (q) params.set("q", q);
  if (letter) params.set("letter", letter);
  return request(`${collection}?${params}`, { signal });
}

export function saveContact(id, contact) {
  return request(id ? `${collection}/${id}` : collection, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });
}

export function deleteContact(id) {
  return request(`${collection}/${id}`, { method: "DELETE" });
}
