import { TournamentStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { AppError } from "../lib/errors";

const BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3000";

function fileUrl(filename: string) {
  return `${BASE_URL}/uploads/tournaments/${filename}`;
}

function toBool(v: any): boolean {
  return v === true || v === "true" || v === "1";
}

function toNumber(v: any): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

type UploadedFiles = { flyer?: Express.Multer.File[]; structure?: Express.Multer.File[] } | undefined;

export async function listTournaments() {
  // Público: no mostramos los cancelados ni los borrados. Los finalizados
  // se dejan (para ver el historial reciente); no hace falta paginar
  // todavía por el volumen esperado de torneos.
  return prisma.tournament.findMany({
    where: { deletedAt: null, status: { not: "CANCELADO" } },
    orderBy: { startsAt: "asc" },
  });
}

export async function listTournamentsAdmin() {
  // El admin ve todo, incluidos los cancelados, para poder gestionarlos.
  return prisma.tournament.findMany({
    where: { deletedAt: null },
    orderBy: { startsAt: "asc" },
  });
}

export async function getTournament(id: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id, deletedAt: null },
  });
  if (!tournament) {
    throw new AppError(404, "Torneo no encontrado.");
  }
  return tournament;
}

interface TournamentInput {
  name?: string;
  type?: string;
  startsAt?: string;
  registrationClosesAt?: string;
  buyIn?: number | string;
  rake?: number | string;
  initialStack?: number | string;
  blindsIntervalMinutes?: number | string;
  reEntryEnabled?: boolean | string;
  reEntryClosesAt?: string;
  addOnEnabled?: boolean | string;
  addOnPrice?: number | string;
  addOnRake?: number | string;
  addOnChips?: number | string;
  addOnLevel?: number | string;
  guaranteedPot?: number | string;
  notes?: string;
}

export async function createTournament(
  input: TournamentInput,
  files: UploadedFiles,
  actorId: string
) {
  const { name, type, startsAt, registrationClosesAt } = input;
  const buyIn = toNumber(input.buyIn);
  const rake = toNumber(input.rake);

  if (!name || !type || !startsAt || !registrationClosesAt || buyIn == null || rake == null) {
    throw new AppError(
      400,
      "Nombre, tipo, fecha de inicio, cierre de inscripción, buy-in y rake son obligatorios."
    );
  }

  const parsedStartsAt = new Date(startsAt);
  const parsedRegClose = new Date(registrationClosesAt);
  if (isNaN(parsedStartsAt.getTime()) || isNaN(parsedRegClose.getTime())) {
    throw new AppError(400, "Fecha inválida.");
  }

  const reEntryEnabled = toBool(input.reEntryEnabled);
  const addOnEnabled = toBool(input.addOnEnabled);

  if (addOnEnabled && toNumber(input.addOnPrice) == null) {
    throw new AppError(400, "Si el addon está habilitado, hace falta indicar el precio.");
  }

  const tournament = await prisma.tournament.create({
    data: {
      name,
      type,
      startsAt: parsedStartsAt,
      registrationClosesAt: parsedRegClose,
      buyIn,
      rake,
      initialStack: toNumber(input.initialStack) ?? null,
      blindsIntervalMinutes: toNumber(input.blindsIntervalMinutes) ?? null,
      reEntryEnabled,
      reEntryClosesAt: reEntryEnabled && input.reEntryClosesAt ? new Date(input.reEntryClosesAt) : null,
      addOnEnabled,
      addOnPrice: addOnEnabled ? toNumber(input.addOnPrice) ?? null : null,
      addOnRake: addOnEnabled ? toNumber(input.addOnRake) ?? null : null,
      addOnChips: addOnEnabled ? toNumber(input.addOnChips) ?? null : null,
      addOnLevel: addOnEnabled ? toNumber(input.addOnLevel) ?? null : null,
      guaranteedPot: toNumber(input.guaranteedPot) ?? null,
      flyerImageUrl: files?.flyer?.[0] ? fileUrl(files.flyer[0].filename) : null,
      structureImageUrl: files?.structure?.[0] ? fileUrl(files.structure[0].filename) : null,
      notes: input.notes || null,
      createdBy: actorId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "TOURNAMENT_CREATED",
      entityType: "Tournament",
      entityId: tournament.id,
      newState: { name: tournament.name, startsAt: tournament.startsAt },
    },
  });

  return tournament;
}

export async function updateTournament(
  id: string,
  input: TournamentInput,
  files: UploadedFiles,
  actorId: string
) {
  const existing = await prisma.tournament.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "Torneo no encontrado.");
  }

  const reEntryEnabled =
    input.reEntryEnabled !== undefined ? toBool(input.reEntryEnabled) : existing.reEntryEnabled;
  const addOnEnabled =
    input.addOnEnabled !== undefined ? toBool(input.addOnEnabled) : existing.addOnEnabled;

  if (addOnEnabled && input.addOnPrice !== undefined && toNumber(input.addOnPrice) == null) {
    throw new AppError(400, "Si el addon está habilitado, hace falta indicar el precio.");
  }

  const flyerImageUrl = files?.flyer?.[0] ? fileUrl(files.flyer[0].filename) : existing.flyerImageUrl;
  const structureImageUrl = files?.structure?.[0]
    ? fileUrl(files.structure[0].filename)
    : existing.structureImageUrl;

  const updated = await prisma.tournament.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      type: input.type ?? undefined,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : undefined,
      buyIn: toNumber(input.buyIn) ?? undefined,
      rake: toNumber(input.rake) ?? undefined,
      initialStack: input.initialStack !== undefined ? toNumber(input.initialStack) ?? null : undefined,
      blindsIntervalMinutes:
        input.blindsIntervalMinutes !== undefined ? toNumber(input.blindsIntervalMinutes) ?? null : undefined,
      reEntryEnabled,
      reEntryClosesAt: reEntryEnabled
        ? input.reEntryClosesAt
          ? new Date(input.reEntryClosesAt)
          : existing.reEntryClosesAt
        : null,
      addOnEnabled,
      addOnPrice: addOnEnabled ? toNumber(input.addOnPrice) ?? existing.addOnPrice : null,
      addOnRake: addOnEnabled ? toNumber(input.addOnRake) ?? existing.addOnRake : null,
      addOnChips: addOnEnabled ? toNumber(input.addOnChips) ?? existing.addOnChips : null,
      addOnLevel: addOnEnabled ? toNumber(input.addOnLevel) ?? existing.addOnLevel : null,
      guaranteedPot: input.guaranteedPot !== undefined ? toNumber(input.guaranteedPot) ?? null : undefined,
      flyerImageUrl,
      structureImageUrl,
      notes: input.notes !== undefined ? input.notes || null : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "TOURNAMENT_UPDATED",
      entityType: "Tournament",
      entityId: id,
      previousState: { name: existing.name, startsAt: existing.startsAt },
      newState: { name: updated.name, startsAt: updated.startsAt },
    },
  });

  return updated;
}

const VALID_STATUSES: TournamentStatus[] = ["PROGRAMADO", "EN_CURSO", "FINALIZADO", "CANCELADO"];

export async function updateTournamentStatus(id: string, newStatus: string, actorId: string) {
  if (!VALID_STATUSES.includes(newStatus as TournamentStatus)) {
    throw new AppError(400, "Estado de torneo inválido.");
  }

  const existing = await prisma.tournament.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "Torneo no encontrado.");
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: { status: newStatus as TournamentStatus },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: `TOURNAMENT_${newStatus}`,
      entityType: "Tournament",
      entityId: id,
      previousState: { status: existing.status },
      newState: { status: newStatus },
    },
  });

  return updated;
}

export async function duplicateTournament(id: string, actorId: string) {
  const existing = await prisma.tournament.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "Torneo no encontrado.");
  }

  // Duplicar corre todas las fechas una semana para adelante — pensado
  // para el caso de "el torneo fijo de los domingos". El admin puede
  // ajustar la fecha manualmente después si no es ese el caso.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const shift = (d: Date | null) => (d ? new Date(d.getTime() + WEEK_MS) : null);

  const duplicated = await prisma.tournament.create({
    data: {
      name: existing.name,
      type: existing.type,
      startsAt: shift(existing.startsAt)!,
      registrationClosesAt: shift(existing.registrationClosesAt)!,
      buyIn: existing.buyIn,
      rake: existing.rake,
      initialStack: existing.initialStack,
      blindsIntervalMinutes: existing.blindsIntervalMinutes,
      reEntryEnabled: existing.reEntryEnabled,
      reEntryClosesAt: shift(existing.reEntryClosesAt),
      addOnEnabled: existing.addOnEnabled,
      addOnPrice: existing.addOnPrice,
      addOnRake: existing.addOnRake,
      addOnChips: existing.addOnChips,
      addOnLevel: existing.addOnLevel,
      guaranteedPot: existing.guaranteedPot,
      flyerImageUrl: existing.flyerImageUrl,
      structureImageUrl: existing.structureImageUrl,
      notes: existing.notes,
      status: "PROGRAMADO",
      createdBy: actorId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "TOURNAMENT_DUPLICATED",
      entityType: "Tournament",
      entityId: duplicated.id,
      previousState: { duplicatedFrom: existing.id },
      newState: { name: duplicated.name, startsAt: duplicated.startsAt },
    },
  });

  return duplicated;
}

export async function deleteTournament(id: string, actorId: string) {
  const existing = await prisma.tournament.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError(404, "Torneo no encontrado.");
  }

  await prisma.$transaction([
    prisma.tournament.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: "TOURNAMENT_DELETED",
        entityType: "Tournament",
        entityId: id,
        previousState: { name: existing.name },
      },
    }),
  ]);

  return { message: `${existing.name} eliminado del calendario.` };
}