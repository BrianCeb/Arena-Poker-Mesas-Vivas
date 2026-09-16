import prisma from "../lib/prisma";
import { AppError } from "../lib/errors";

// ── JUGADOR ───────────────────────────────────────────────────

export async function joinWaitingList(tableId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVA") {
    throw new AppError(403, "Tu cuenta no está habilitada para anotarte.");
  }

  const table = await prisma.casinoTable.findUnique({ where: { id: tableId } });
  if (!table || table.deletedAt) {
    throw new AppError(404, "Mesa no encontrada.");
  }
  if (table.status !== "ABIERTA") {
    throw new AppError(409, "Esta mesa no está abierta en este momento.");
  }

  // Chequeo previo, solo para dar un mensaje claro. La garantía real de
  // que no haya dos inscripciones activas la da el índice único parcial
  // de la base — ver el catch de P2002 más abajo, que cubre el caso de
  // que dos requests casi simultáneas pasen este chequeo a la vez
  // (doble click, dos pestañas abiertas).
  const existingActive = await prisma.waitingListEntry.findFirst({
    where: { userId, status: { in: ["ANOTADO", "SENTADO"] } },
    include: { table: true },
  });
  if (existingActive) {
    throw new AppError(
      409,
      `Ya estás anotado en ${existingActive.table.name}. Retirate primero para anotarte en otra mesa.`
    );
  }

  try {
    const entry = await prisma.waitingListEntry.create({
      data: { userId, tableId, status: "ANOTADO", origin: "APP" },
    });
    return entry;
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "Ya estás anotado en otra mesa.");
    }
    throw err;
  }
}

export async function leaveWaitingList(userId: string) {
  // No pedimos tableId: por la regla de "una sola mesa a la vez", alcanza
  // con buscar la inscripción activa del usuario, sea cual sea la mesa.
  const entry = await prisma.waitingListEntry.findFirst({
    where: { userId, status: { in: ["ANOTADO", "SENTADO"] } },
  });
  if (!entry) {
    throw new AppError(404, "No tenés ninguna inscripción activa.");
  }

  await prisma.waitingListEntry.update({
    where: { id: entry.id },
    data: { status: "RETIRADO", leftAt: new Date() },
  });

  return { message: "Te retiraste de la lista." };
}

export async function getMyEntry(userId: string) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { userId, status: { in: ["ANOTADO", "SENTADO"] } },
    include: { table: true },
  });
  return entry; // null si no tiene ninguna — el frontend lo maneja
}

// ── PERSONAL DEL CASINO ──────────────────────────────────────

export async function seatFromWaitingList(entryId: string, actorId: string) {
  const entry = await prisma.waitingListEntry.findUnique({
    where: { id: entryId },
    include: { table: true },
  });
  if (!entry || entry.status !== "ANOTADO") {
    throw new AppError(404, "Inscripción no encontrada o ya no está en espera.");
  }

  const seatedCount = await prisma.waitingListEntry.count({
    where: { tableId: entry.tableId, status: "SENTADO" },
  });
  if (seatedCount >= entry.table.capacity) {
    throw new AppError(409, "La mesa no tiene lugar disponible.");
  }

  await prisma.$transaction([
    prisma.waitingListEntry.update({
      where: { id: entryId },
      data: { status: "SENTADO", seatedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: "PLAYER_SEATED_FROM_WAITING_LIST",
        entityType: "WaitingListEntry",
        entityId: entryId,
        newState: { tableId: entry.tableId, tableName: entry.table.name },
      },
    }),
  ]);

  return { message: "Jugador sentado correctamente." };
}

export async function removeEntry(entryId: string, actorId: string, reason?: string) {
  const entry = await prisma.waitingListEntry.findUnique({ where: { id: entryId } });
  if (!entry || !["ANOTADO", "SENTADO"].includes(entry.status)) {
    throw new AppError(404, "Inscripción no encontrada o ya no está activa.");
  }

  await prisma.$transaction([
    prisma.waitingListEntry.update({
      where: { id: entryId },
      data: {
        status: "CANCELADO_ADMIN",
        leftAt: new Date(),
        cancelledBy: actorId,
        cancelReason: reason || null,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: entry.status === "SENTADO" ? "PLAYER_REMOVED_FROM_TABLE" : "ENTRY_REMOVED_FROM_WAITING_LIST",
        entityType: "WaitingListEntry",
        entityId: entryId,
        previousState: { status: entry.status },
        newState: { status: "CANCELADO_ADMIN", reason: reason || null },
      },
    }),
  ]);

  return { message: "Inscripción removida." };
}

export async function seatWalkin(tableId: string, targetUserId: string, actorId: string) {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser || targetUser.status !== "ACTIVA") {
    throw new AppError(400, "El jugador no existe o su cuenta no está habilitada.");
  }

  const table = await prisma.casinoTable.findUnique({ where: { id: tableId } });
  if (!table || table.deletedAt) {
    throw new AppError(404, "Mesa no encontrada.");
  }

  const existingActive = await prisma.waitingListEntry.findFirst({
    where: { userId: targetUserId, status: { in: ["ANOTADO", "SENTADO"] } },
  });
  if (existingActive) {
    throw new AppError(409, "Ese jugador ya tiene una inscripción activa en otra mesa.");
  }

  const seatedCount = await prisma.waitingListEntry.count({
    where: { tableId, status: "SENTADO" },
  });
  if (seatedCount >= table.capacity) {
    throw new AppError(409, "La mesa no tiene lugar disponible.");
  }

  try {
    const entry = await prisma.waitingListEntry.create({
      data: {
        userId: targetUserId,
        tableId,
        status: "SENTADO",
        origin: "MANUAL_STAFF",
        seatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "PLAYER_SEATED_WALKIN",
        entityType: "WaitingListEntry",
        entityId: entry.id,
        newState: { userId: targetUserId, tableId, tableName: table.name },
      },
    });

    return entry;
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "Ese jugador ya tiene una inscripción activa en otra mesa.");
    }
    throw err;
  }
}