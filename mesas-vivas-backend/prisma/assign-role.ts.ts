import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_ROLES = ["OPERADOR", "SUPERVISOR", "ADMIN"];

function printUsage() {
  console.log("Uso:");
  console.log("  npx tsx prisma/assign-role.ts <email> <ROL>            # asigna el rol");
  console.log("  npx tsx prisma/assign-role.ts <email> <ROL> --remove   # quita el rol");
  console.log(`Roles válidos: ${VALID_ROLES.join(", ")}`);
}

async function main() {
  const [, , email, roleNameRaw, flag] = process.argv;

  if (!email || !roleNameRaw) {
    printUsage();
    process.exit(1);
  }

  const roleName = roleNameRaw.toUpperCase();
  if (!VALID_ROLES.includes(roleName)) {
    console.log(`Rol inválido: "${roleNameRaw}".`);
    printUsage();
    process.exit(1);
  }

  const remove = flag === "--remove";

  // La persona tiene que existir como usuario ya registrado (con su
  // cuenta de jugador normal, vía /auth/register): un "empleado" acá
  // no es más que un User al que además le asignamos un Role.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(
      `No se encontró ningún usuario con el email "${email}". Esa persona tiene que registrarse primero en la app (como jugador, con el formulario normal) antes de poder asignarle un rol de empleado.`
    );
    process.exit(1);
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    // No debería pasar si ya corriste "npm run seed" alguna vez.
    console.log(`El rol "${roleName}" no existe en la base. Corré "npm run seed" primero.`);
    process.exit(1);
  }

  if (remove) {
    const deleted = await prisma.userRole.deleteMany({
      where: { userId: user.id, roleId: role.id },
    });
    if (deleted.count === 0) {
      console.log(`${user.firstName} ${user.lastName} (${user.email}) no tenía el rol ${roleName}. No se hizo ningún cambio.`);
    } else {
      console.log(`Listo: se le quitó el rol ${roleName} a ${user.firstName} ${user.lastName} (${user.email}).`);
    }
    return;
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`Listo: ${user.firstName} ${user.lastName} (${user.email}) ahora tiene el rol ${roleName}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });