// Almacenamiento simple en memoria (en producción usarías una DB)
const users = [];

exports.handler = async (event) => {
  const path = event.path.replace("/.netlify/functions/user", "");

  switch (event.httpMethod) {
    case "GET":
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users })
      };

    case "POST":
      try {
        const { name, email, password } = JSON.parse(event.body);
        if (!name || !email || !password) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Campos requeridos: name, email, password" })
          };
        }

        const exists = users.find(u => u.email === email);
        if (exists) {
          return {
            statusCode: 409,
            body: JSON.stringify({ error: "El email ya está registrado" })
          };
        }

        const newUser = { id: users.length + 1, name, email, password, createdAt: new Date().toISOString() };
        users.push(newUser);

        return {
          statusCode: 201,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true, user: { id: newUser.id, name, email } })
        };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
      }

    default:
      return { statusCode: 405, body: "Method Not Allowed" };
  }
};
