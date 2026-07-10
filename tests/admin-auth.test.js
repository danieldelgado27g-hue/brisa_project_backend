const { verifyRole, requireAuthWithRole } = require("../utils/admin");

describe("verifyRole", () => {
  const mockUser = { id: 1, email: "test@test.com", role: "user" };

  it("debe permitir acceso con rol correcto", () => {
    const result = verifyRole({ ...mockUser, role: 'admin' }, ['admin']);
    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe('admin');
  });

  it("debe permitir acceso con uno de los roles permitidos", () => {
    const result = verifyRole(
      { ...mockUser, role: 'dermatologist' },
      ['admin', 'dermatologist']
    );
    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
  });

  it("debe denegar acceso con rol incorrecto", () => {
    const result = verifyRole({ ...mockUser, role: 'user' }, ['admin']);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Acceso denegado/);
    expect(result.error).toMatch(/admin/);
  });

  it("debe denegar acceso sin rol", () => {
    const result = verifyRole({ id: 1, email: "test@test.com" }, ['admin']);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/sin rol definido/);
  });

  it("debe denegar sin usuario", () => {
    const result = verifyRole(null, ['admin']);
    expect(result.error).toBeDefined();
    expect(result.error).toBe('Usuario no proporcionado');
  });

  it("deve permitir roles múltiples", () => {
    const allowedRoles = ['admin', 'dermatologist', 'premium'];

    // Test con admin
    let result = verifyRole({ ...mockUser, role: 'admin' }, allowedRoles);
    expect(result.error).toBeUndefined();

    // Test con dermatologist
    result = verifyRole({ ...mockUser, role: 'dermatologist' }, allowedRoles);
    expect(result.error).toBeUndefined();

    // Test con premium
    result = verifyRole({ ...mockUser, role: 'premium' }, allowedRoles);
    expect(result.error).toBeUndefined();
  });

  it("debe denegar rol no incluido en lista permitida", () => {
    const result = verifyRole(
      { ...mockUser, role: 'user' },
      ['admin', 'dermatologist']
    );
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Acceso denegado/);
  });
});

describe("requireAuthWithRole", () => {
  it("debe retornar 401 sin usuario en body", () => {
    const event = {
      body: JSON.stringify({}),
      headers: {}
    };

    const result = requireAuthWithRole(event, ['admin']);
    expect(result.status).toBe(401);
    expect(result.error).toBeDefined();
  });

  it("debe retornar 403 con role incorrecto", () => {
    const event = {
      body: JSON.stringify({
        user: { id: 1, email: "test@test.com", role: 'user' }
      }),
      headers: {}
    };

    const result = requireAuthWithRole(event, ['admin']);
    expect(result.status).toBe(403);
    expect(result.error).toBeDefined();
  });

  it("debe permitir con role correcto", () => {
    const event = {
      body: JSON.stringify({
        user: { id: 1, email: "admin@test.com", role: 'admin' }
      }),
      headers: {}
    };

    const result = requireAuthWithRole(event, ['admin']);
    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user.role).toBe('admin');
  });

  it("deve permitir con uno de los roles permitidos", () => {
    const event = {
      body: JSON.stringify({
        user: { id: 1, email: "dr@test.com", role: 'dermatologist' }
      }),
      headers: {}
    };

    const result = requireAuthWithRole(event, ['admin', 'dermatologist']);
    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
  });
});
