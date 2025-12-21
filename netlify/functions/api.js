export async function handler(event) {
  const req = JSON.parse(event.body || "{}");

  // 1️⃣ Project aniqlash
  const project = PROJECTS[req.project];
  if (!project) return err("Unknown project");

  // 2️⃣ Auth
  if (project.auth.required) {
    if (!checkAuth(req.auth, project.auth)) {
      return err("Auth failed");
    }
  }

  // 3️⃣ Permission
  if (!checkPermission(req.entity, req.action, project)) {
    return err("Forbidden");
  }

  // 4️⃣ DB adapter
  const db = await getDB(project.database);

  // 5️⃣ UNIVERSAL CRUD
  const result = await db[req.action](
    project.collections[req.entity],
    req.data
  );

  return ok(result);
}
