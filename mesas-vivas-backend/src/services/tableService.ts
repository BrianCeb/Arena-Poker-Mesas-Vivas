import { TableStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { AppError } from "../lib/errors";

export async function listTables() {
  const tables = await prisma.casinoTable.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });

  // El conteo de sentados/esperando se calcula acá, en tiempo real —
  // nunca se guarda como campo de la mesa (ver decisión en CLAUDE.md:
  // "completa"/"armando mesa" son de presentación, no estado persistido).
  const withCounts = await Promise.all(
    tables.map(async (t) => {
      const [seated, waiting] = await Promise.all([
        prisma.waitingListEntry.count({ where: { tableId: t.id, status: "SENTADO" } }),
        prisma.waitingListEntry.count({ where: { tableId: t.id, status: "ANOTADO" } }),
      ]);
      return { ...t, seated, waiting };
    })
  );

  return withCounts;
}

const VALID_STATUSES: TableStatus[] = ["CERRADA", "ABIERTA", "SUSPENDIDA"];

export async function updateTableStatus(
  tableId: string,
  newStatus: string,
  actorId: string,
  reason?: string
) {
  if (!VALID_STATUSES.includes(newStatus as TableStatus)) {
    throw new AppError(400, "Estado de mesa inválido.");
  }

  const table = await prisma.casinoTable.findUnique({ where: { id: tableId } });
  if (!table) {
    throw new AppError(404, "Mesa no encontrada.");
  }
  if (table.status === newStatus) {
    throw new AppError(400, `La mesa ya está en estado ${newStatus}.`);
  }

  const previousStatus = table.status;

  await prisma.$transaction([
    prisma.casinoTable.update({
      where: { id: tableId },
      data: {
        status: newStatus as TableStatus,
        openedAt: newStatus === "ABIERTA" ? new Date() : table.openedAt,
        closedAt: newStatus === "CERRADA" ? new Date() : table.closedAt,
      },
    }),
    prisma.tableStatusHistory.create({
      data: {
        tableId,
        previousStatus,
        newStatus: newStatus as TableStatus,
        changedBy: actorId,
        reason,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: `TABLE_${newStatus}`,
        entityType: "CasinoTable",
        entityId: tableId,
        previousState: { status: previousStatus },
        newState: { status: newStatus },
      },
    }),
  ]);

  return { message: `Mesa actualizada a ${newStatus}.` };
}

interface CreateTableInput {
  name?: string;
  gameType?: string;
  smallBlind?: number;
  bigBlind?: number;
  minBuyIn?: number;
  maxBuyIn?: number;
  capacity?: number;
  minPlayersToStart?: number;
  stradleMode?: string;
  stradleAmount?: number;
}

const VALID_STRADLE_MODES = ["NO", "OPCIONAL", "OBLIGATORIO"];

export async function createTable(input: CreateTableInput, actorId: string) {
  const {
    name, gameType, smallBlind, bigBlind, minBuyIn, maxBuyIn,
    capacity, minPlayersToStart, stradleMode, stradleAmount,
  } = input;

  if (!name || !gameType || smallBlind == null || bigBlind == null) {
    throw new AppError(400, "Nombre, tipo de juego y ciegas son obligatorios.");
  }

  const mode = stradleMode || "NO";
  if (!VALID_STRADLE_MODES.includes(mode)) {
    throw new AppError(400, "Modo de stradle inválido.");
  }
  if (mode !== "NO" && (stradleAmount == null || stradleAmount <= 0)) {
    throw new AppError(400, "Si el stradle es opcional u obligatorio, hace falta indicar el monto.");
  }

  const table = await prisma.casinoTable.create({
    data: {
      name,
      gameType,
      smallBlind,
      bigBlind,
      minBuyIn: minBuyIn ?? null,
      maxBuyIn: maxBuyIn ?? null,
      capacity: capacity ?? 9,
      minPlayersToStart: minPlayersToStart ?? 4,
      stradleMode: mode as any,
      stradleAmount: mode !== "NO" ? stradleAmount : null,
      createdBy: actorId,
    },
  }).catch((err: any) => {
    if (err.code === "P2002") {
      throw new AppError(409, `Ya existe una mesa activa llamada "${name}".`);
    }
    throw err;
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "TABLE_CREATED",
      entityType: "CasinoTable",
      entityId: table.id,
      newState: { name: table.name, gameType: table.gameType },
    },
  });

  return table;
}

export async function deleteTable(tableId: string, actorId: string) {
  const table = await prisma.casinoTable.findUnique({ where: { id: tableId } });
  if (!table || table.deletedAt) {
    throw new AppError(404, "Mesa no encontrada.");
  }

  const activeCount = await prisma.waitingListEntry.count({
    where: { tableId, status: { in: ["ANOTADO", "SENTADO"] } },
  });
  if (activeCount > 0) {
    throw new AppError(
      409,
      "No se puede dar de baja una mesa con jugadores sentados o en espera. Retiralos primero."
    );
  }

  await prisma.$transaction([
    prisma.casinoTable.update({
      where: { id: tableId },
      data: { deletedAt: new Date(), status: "CERRADA" },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: "TABLE_DELETED",
        entityType: "CasinoTable",
        entityId: tableId,
        previousState: { name: table.name },
      },
    }),
  ]);

  return { message: `${table.name} dada de baja.` };
}

interface UpdateTableInput {
  gameType?: string;
  smallBlind?: number;
  bigBlind?: number;
  minBuyIn?: number;
  maxBuyIn?: number;
  capacity?: number;
  minPlayersToStart?: number;
  stradleMode?: string;
  stradleAmount?: number;
  notes?: string;
}

export async function updateTable(tableId: string, input: UpdateTableInput, actorId: string) {
  const table = await prisma.casinoTable.findUnique({ where: { id: tableId } });
  if (!table || table.deletedAt) {
    throw new AppError(404, "Mesa no encontrada.");
  }

  const { stradleMode, stradleAmount, capacity } = input;

  if (stradleMode && !VALID_STRADLE_MODES.includes(stradleMode)) {
    throw new AppError(400, "Modo de stradle inválido.");
  }
  const effectiveStradleMode = stradleMode ?? table.stradleMode;
  const effectiveStradleAmount = stradleAmount ?? Number(table.stradleAmount ?? 0);
  if (effectiveStradleMode !== "NO" && effectiveStradleAmount <= 0) {
    throw new AppError(400, "Si el stradle es opcional u obligatorio, hace falta indicar el monto.");
  }

  // No dejamos bajar la capacidad por debajo de la gente que ya está
  // sentada — eso dejaría jugadores "de más" respecto al límite nuevo.
  if (capacity != null) {
    const seated = await prisma.waitingListEntry.count({
      where: { tableId, status: "SENTADO" },
    });
    if (capacity < seated) {
      throw new AppError(
        409,
        `No se puede bajar la capacidad a ${capacity}: hay ${seated} jugadores sentados ahora mismo.`
      );
    }
  }

  const previousState = {
    gameType: table.gameType,
    smallBlind: table.smallBlind,
    bigBlind: table.bigBlind,
    minBuyIn: table.minBuyIn,
    maxBuyIn: table.maxBuyIn,
    capacity: table.capacity,
    minPlayersToStart: table.minPlayersToStart,
    stradleMode: table.stradleMode,
    stradleAmount: table.stradleAmount,
  };

  const updated = await prisma.casinoTable.update({
    where: { id: tableId },
    data: {
      gameType: input.gameType ?? undefined,
      smallBlind: input.smallBlind ?? undefined,
      bigBlind: input.bigBlind ?? undefined,
      minBuyIn: input.minBuyIn ?? undefined,
      maxBuyIn: input.maxBuyIn ?? undefined,
      capacity: input.capacity ?? undefined,
      minPlayersToStart: input.minPlayersToStart ?? undefined,
      stradleMode: (stradleMode as any) ?? undefined,
      stradleAmount:
        stradleMode !== undefined
          ? (effectiveStradleMode !== "NO" ? effectiveStradleAmount : null)
          : (stradleAmount ?? undefined),
      notes: input.notes ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "TABLE_UPDATED",
      entityType: "CasinoTable",
      entityId: tableId,
      previousState,
      newState: {
        gameType: updated.gameType,
        smallBlind: updated.smallBlind,
        bigBlind: updated.bigBlind,
        minBuyIn: updated.minBuyIn,
        maxBuyIn: updated.maxBuyIn,
        capacity: updated.capacity,
        minPlayersToStart: updated.minPlayersToStart,
        stradleMode: updated.stradleMode,
        stradleAmount: updated.stradleAmount,
      },
    },
  });

  return updated;
}