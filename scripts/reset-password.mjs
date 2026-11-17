// Cambia la contraseña de un usuario de Numo.
// Uso:  node scripts/reset-password.mjs            → muestra los mails registrados
//       node scripts/reset-password.mjs tu@mail.com → pide la contraseña nueva y la guarda
import "dotenv/config";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
const db = new pkg.PrismaClient();

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  const users = await db.user.findMany({ select: { email: true, name: true } });
  console.log("Usuarios registrados:");
  for (const u of users) console.log(" -", u.email, `(${u.name})`);
  console.log("\nCorré de nuevo con el mail:  node scripts/reset-password.mjs tu@mail.com");
  await db.$disconnect(); process.exit(0);
}
const user = await db.user.findUnique({ where: { email } });
if (!user) { console.log("No existe un usuario con ese mail. Corré sin mail para ver la lista."); await db.$disconnect(); process.exit(1); }

// Pide la contraseña sin mostrarla en pantalla
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl._writeToOutput = (s) => { if (s.includes("Contraseña")) rl.output.write(s); };
const pass = await new Promise((r) => rl.question("Contraseña nueva (mínimo 8 caracteres): ", (a) => { rl.close(); console.log(); r(a); }));
if (pass.length < 8) { console.log("Tiene que tener al menos 8 caracteres."); await db.$disconnect(); process.exit(1); }
await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pass, 10) } });
console.log(`Listo: ${email} ya puede entrar con la contraseña nueva.`);
await db.$disconnect();
