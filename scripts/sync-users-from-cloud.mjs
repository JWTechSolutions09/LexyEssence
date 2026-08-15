import { initDatabase, syncUsersFromCloudToLocal } from "../server/db.ts";

console.log("Sincronizando usuarios de Supabase a SQL Server local...\n");

try {
  await initDatabase();
  const count = await syncUsersFromCloudToLocal(true);
  if (count > 0) {
    console.log(`Listo: ${count} usuario(s). Usa el mismo usuario y contrasena que en la app web.`);
    process.exit(0);
  }
  console.log("No se copiaron usuarios. Verifica que existan en Supabase.");
  process.exit(1);
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
}
