import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Roles base del sistema (jugador no tiene rol explícito, es el default)
  const roleNames = ["OPERADOR", "SUPERVISOR", "ADMIN"];
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Roles verificados: ${roleNames.join(", ")}`);

  // ── Súper usuario inicial ──
  // Decisión: arrancamos con un solo usuario ADMIN (vos) en vez de la
  // jerarquía completa Operador/Supervisor — se reparte más adelante
  // cuando el casino sume personal.
  const adminEmail = "briancebrero@gmail.com";
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!adminUser) {
    console.log(
      `No se encontró un usuario con email ${adminEmail} — no se asignó rol ADMIN ni se crearon las mesas. Registrate primero y volvé a correr "npm run seed".`
    );
  } else {
    const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
    if (adminRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
        update: {},
        create: { userId: adminUser.id, roleId: adminRole.id },
      });
      console.log(`Rol ADMIN asignado a ${adminEmail}.`);
    }

    // Las 3 mesas fijas del casino — no hay alta libre de mesas nuevas,
    // así que las cargamos acá una sola vez en vez de por un endpoint.
    const existingTables = await prisma.casinoTable.count();
    if (existingTables === 0) {
      const tableSeeds = [
        { name: "Mesa 1", gameType: "Texas Hold'em", smallBlind: 25, bigBlind: 50, minBuyIn: 2000, maxBuyIn: 10000, capacity: 9, minPlayersToStart: 4 },
        { name: "Mesa 2", gameType: "Texas Hold'em", smallBlind: 50, bigBlind: 100, minBuyIn: 5000, maxBuyIn: 20000, capacity: 9, minPlayersToStart: 4 },
        { name: "Mesa 3", gameType: "Omaha", smallBlind: 100, bigBlind: 200, minBuyIn: 10000, maxBuyIn: 40000, capacity: 9, minPlayersToStart: 4 },
      ];
      for (const t of tableSeeds) {
        await prisma.casinoTable.create({ data: { ...t, createdBy: adminUser.id } });
      }
      console.log("3 mesas creadas.");
    } else {
      console.log("Ya hay mesas cargadas, no se crearon nuevas.");
    }
  }

  // Versión inicial de Términos y Condiciones — placeholder hasta que el
  // casino provea el texto real. El registro de usuarios depende de que
  // exista una versión marcada como vigente (isCurrent: true).
  const existingCurrent = await prisma.termsVersion.findFirst({
    where: { isCurrent: true },
  });

  if (!existingCurrent) {
    await prisma.termsVersion.create({
      data: {
        versionLabel: "v0-placeholder",
        content:
          "Texto de Términos y Condiciones pendiente de definir por el casino. " +
          "Este es un contenido temporal para desarrollo.",
        isCurrent: true,
      },
    });
    console.log("Versión placeholder de T&C creada.");
  } else {
    console.log("Ya existe una versión vigente de T&C, no se creó otra.");
  }

  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });