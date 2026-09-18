import prisma from "../lib/prisma";
import { AppError } from "../lib/errors";
import { broadcastTablesChanged } from "../lib/realtime";

const RECENT_CASHOUT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas

function formatMinutesAgo(date: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "menos de un minuto";
  if (minutes === 1) return "1 minuto";
  return `${minutes} minutos`;
}

// Advertencia (no bloqueante) para el personal: esta persona cobró fichas
// hace menos de 2 horas, en cualquier mesa. No impide sentarla — es una
// decisión que queda en manos del supervisor.
async function checkRecentCashOutWarning(
  documentType: string,
  documentNumber: string
): Promise<string | null> {
  const recent = await prisma.waitingListEntry.findFirst({
    where: {
      documentType: documentType as any,
      documentNumber,
      status: "CANCELADO_ADMIN",
      cashOutAt: { gte: new Date(Date.now() - RECENT_CASHOUT_WINDOW_MS) },
    },
    orderBy: { cashOutAt: "desc" },
    include: { table: true },
  });

  if (!recent || !recent.cashOutAt) return null;

  const amountText = recent.cashOutAmount != null ? `$${recent.cashOutAmount} ` : "";
  return `Atención: este jugador cobró ${amountText}hace ${formatMinutesAgo(recent.cashOutAt)} en ${recent.table.name}.`;
}

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

  // Un jugador puede estar anotado en varias mesas a la vez (por ejemplo,
  // jugando en una mientras espera lugar en otra más fuerte). Lo único
  // que no puede pasar es tener dos inscripciones activas en la MISMA
  // mesa. El chequeo acá es solo para dar un mensaje claro: la garantía
  // real la da el índice único parcial de la base — ver el catch de
  // P2002 más abajo, que cubre el caso de que dos requests casi
  // simultáneas pasen este chequeo a la vez (doble click, dos pestañas).
  const existingActiveHere = await prisma.waitingListEntry.findFirst({
    where: { userId, tableId, status: { in: ["ANOTADO", "SENTADO"] } },
  });
  if (existingActiveHere) {
    throw new AppError(409, "Ya estás anotado en esta mesa.");
  }

  try {
    const entry = await prisma.waitingListEntry.create({
      data: {
        userId,
        tableId,
        status: "ANOTADO",
        origin: "APP",
        documentType: user.documentType,
        documentNumber: user.documentNumber,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
    broadcastTablesChanged();
    return entry;
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "Ya estás anotado en esta mesa.");
    }
    throw err;
  }
}

export async function leaveWaitingList(userId: string, tableId: string) {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { userId, tableId, status: { in: ["ANOTADO", "SENTADO"] } },
  });
  if (!entry) {
    throw new AppError(404, "No tenés ninguna inscripción activa en esa mesa.");
  }
  if (entry.status === "SENTADO") {
    // Un jugador sentado no puede auto-retirarse: eso significaría dejar
    // la mesa, una decisión que tiene que gestionar el personal desde
    // el panel (ver removeEntry).
    throw new AppError(
      403,
      "No podés retirarte vos mismo de una mesa en la que ya estás sentado. Pedile a un supervisor que te retire desde el panel."
    );
  }

  await prisma.waitingListEntry.update({
    where: { id: entry.id },
    data: { status: "RETIRADO", leftAt: new Date() },
  });

  broadcastTablesChanged();
  return { message: "Te retiraste de la lista." };
}

export async function getMyEntries(userId: string) {
  const entries = await prisma.waitingListEntry.findMany({
    where: { userId, status: { in: ["ANOTADO", "SENTADO"] } },
    include: { table: true },
    orderBy: { createdAt: "asc" },
  });
  return entries; // [] si no tiene ninguna — el frontend lo maneja
}

export async function getTableEntries(tableId: string) {
  const entries = await prisma.waitingListEntry.findMany({
    where: { tableId, status: { in: ["ANOTADO", "SENTADO"] } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    seated: entries.filter((e) => e.status === "SENTADO"),
    waiting: entries.filter((e) => e.status === "ANOTADO"),
  };
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

  // Una persona no puede estar SENTADO en dos mesas a la vez. Si ya
  // figura sentada en otra, asumimos que se paró de ahí para venir a
  // esta y la movemos: se retira su entrada vieja y se crea/activa la
  // nueva, todo en la misma transacción.
  const otherSeatedElsewhere = await prisma.waitingListEntry.findFirst({
    where: {
      documentType: entry.documentType,
      documentNumber: entry.documentNumber,
      status: "SENTADO",
      id: { not: entryId },
    },
    include: { table: true },
  });

  const operations = [];

  if (otherSeatedElsewhere) {
    operations.push(
      prisma.waitingListEntry.update({
        where: { id: otherSeatedElsewhere.id },
        data: { status: "RETIRADO", leftAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId,
          action: "PLAYER_AUTO_LEFT_TABLE_ON_RESEAT",
          entityType: "WaitingListEntry",
          entityId: otherSeatedElsewhere.id,
          previousState: { status: "SENTADO", tableId: otherSeatedElsewhere.tableId, tableName: otherSeatedElsewhere.table.name },
          newState: { status: "RETIRADO", reason: `Sentado en ${entry.table.name}` },
        },
      })
    );
  }

  operations.push(
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
    })
  );

  await prisma.$transaction(operations);

  const warning = await checkRecentCashOutWarning(entry.documentType, entry.documentNumber);

  broadcastTablesChanged();
  return {
    message: otherSeatedElsewhere
      ? `Jugador sentado correctamente (se lo retiró automáticamente de ${otherSeatedElsewhere.table.name}).`
      : "Jugador sentado correctamente.",
    ...(warning ? { warning } : {}),
  };
}

export async function removeEntry(
  entryId: string,
  actorId: string,
  reason?: string,
  cashOutAmount?: number | null
) {
  const entry = await prisma.waitingListEntry.findUnique({ where: { id: entryId } });
  if (!entry || !["ANOTADO", "SENTADO"].includes(entry.status)) {
    throw new AppError(404, "Inscripción no encontrada o ya no está activa.");
  }

  // El cash-out solo tiene sentido para alguien que estaba jugando
  // (SENTADO). Para una entrada ANOTADO (todavía en espera) se ignora
  // aunque venga en la request, para no guardar un monto sin sentido.
  const isSeated = entry.status === "SENTADO";

  await prisma.$transaction([
    prisma.waitingListEntry.update({
      where: { id: entryId },
      data: {
        status: "CANCELADO_ADMIN",
        leftAt: new Date(),
        cancelledBy: actorId,
        cancelReason: reason || null,
        ...(isSeated
          ? {
              cashOutAmount: cashOutAmount ?? null,
              cashOutAt: new Date(),
            }
          : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: entry.status === "SENTADO" ? "PLAYER_REMOVED_FROM_TABLE" : "ENTRY_REMOVED_FROM_WAITING_LIST",
        entityType: "WaitingListEntry",
        entityId: entryId,
        previousState: { status: entry.status },
        newState: {
          status: "CANCELADO_ADMIN",
          reason: reason || null,
          ...(isSeated ? { cashOutAmount: cashOutAmount ?? null } : {}),
        },
      },
    }),
  ]);

  broadcastTablesChanged();
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

  const existingActiveHere = await prisma.waitingListEntry.findFirst({
    where: { userId: targetUserId, tableId, status: { in: ["ANOTADO", "SENTADO"] } },
  });
  if (existingActiveHere) {
    throw new AppError(409, "Ese jugador ya tiene una inscripción activa en esta mesa.");
  }

  const seatedCount = await prisma.waitingListEntry.count({
    where: { tableId, status: "SENTADO" },
  });
  if (seatedCount >= table.capacity) {
    throw new AppError(409, "La mesa no tiene lugar disponible.");
  }

  // Mismo criterio que en seatFromWaitingList: si ya está sentado en
  // otra mesa, lo movemos automáticamente.
  const otherSeatedElsewhere = await prisma.waitingListEntry.findFirst({
    where: {
      documentType: targetUser.documentType,
      documentNumber: targetUser.documentNumber,
      status: "SENTADO",
    },
    include: { table: true },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (otherSeatedElsewhere) {
        await tx.waitingListEntry.update({
          where: { id: otherSeatedElsewhere.id },
          data: { status: "RETIRADO", leftAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "PLAYER_AUTO_LEFT_TABLE_ON_RESEAT",
            entityType: "WaitingListEntry",
            entityId: otherSeatedElsewhere.id,
            previousState: { status: "SENTADO", tableId: otherSeatedElsewhere.tableId, tableName: otherSeatedElsewhere.table.name },
            newState: { status: "RETIRADO", reason: `Sentado en ${table.name}` },
          },
        });
      }

      const entry = await tx.waitingListEntry.create({
        data: {
          userId: targetUserId,
          tableId,
          status: "SENTADO",
          origin: "MANUAL_STAFF",
          seatedAt: new Date(),
          documentType: targetUser.documentType,
          documentNumber: targetUser.documentNumber,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "PLAYER_SEATED_WALKIN",
          entityType: "WaitingListEntry",
          entityId: entry.id,
          newState: { userId: targetUserId, tableId, tableName: table.name },
        },
      });

      return entry;
    });

    const warning = await checkRecentCashOutWarning(targetUser.documentType, targetUser.documentNumber);

    broadcastTablesChanged();
    return { ...result, ...(warning ? { warning } : {}) };
  } catch (err: any) {
    if (err.code === "P2002") {
      throw new AppError(409, "Ese jugador ya tiene una inscripción activa en esta mesa.");
    }
    throw err;
  }
}