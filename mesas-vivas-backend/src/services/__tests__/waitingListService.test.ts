// Va en: src/services/__tests__/waitingListService.test.ts
//
// Tests de las REGLAS DE NEGOCIO de la lista de espera, con Prisma
// mockeado (no toca ninguna base de datos real, así que no dependen de
// si el motor termina siendo Postgres o MySQL). Lo que SÍ depende del
// motor —si los índices únicos parciales realmente sostienen la
// consistencia bajo dos requests simultáneos— son tests de integración
// aparte, para cuando se defina el motor final (ver backlog).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

vi.mock("../../lib/prisma");
vi.mock("../../lib/realtime", () => ({
  broadcastTablesChanged: vi.fn(),
}));

import prismaDefault from "../../lib/prisma";
import { broadcastTablesChanged } from "../../lib/realtime";
import {
  joinWaitingList,
  leaveWaitingList,
  seatFromWaitingList,
  removeEntry,
  seatWalkinGuest,
} from "../waitingListService";

const prismaMock = prismaDefault as unknown as DeepMockProxy<PrismaClient>;

const ACTIVE_USER = {
  id: "user-1",
  status: "ACTIVA",
  documentType: "DNI",
  documentNumber: "30111222",
  firstName: "Ana",
  lastName: "Gómez",
};

const OPEN_TABLE = {
  id: "table-1",
  deletedAt: null,
  status: "ABIERTA",
  capacity: 9,
  name: "Mesa 1",
};

beforeEach(() => {
  vi.mocked(broadcastTablesChanged).mockClear();
});

describe("joinWaitingList", () => {
  it("rechaza si el usuario no existe o su cuenta no está activa", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(joinWaitingList("table-1", "user-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rechaza si la mesa no existe o fue dada de baja", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER as any);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(null);

    await expect(joinWaitingList("table-1", "user-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rechaza si la mesa no está ABIERTA", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER as any);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce({
      ...OPEN_TABLE,
      status: "CERRADA",
    } as any);

    await expect(joinWaitingList("table-1", "user-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rechaza si ya tiene una inscripción activa en esa misma mesa", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER as any);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(OPEN_TABLE as any);
    prismaMock.waitingListEntry.findFirst.mockResolvedValueOnce({ id: "entry-existing" } as any);

    await expect(joinWaitingList("table-1", "user-1")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.waitingListEntry.create).not.toHaveBeenCalled();
  });

  it("crea la inscripción y avisa por tiempo real cuando todo está OK", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER as any);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(OPEN_TABLE as any);
    prismaMock.waitingListEntry.findFirst.mockResolvedValueOnce(null);
    prismaMock.waitingListEntry.create.mockResolvedValueOnce({ id: "entry-nueva" } as any);

    const entry = await joinWaitingList("table-1", "user-1");

    expect(entry).toEqual({ id: "entry-nueva" });
    expect(prismaMock.waitingListEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          tableId: "table-1",
          status: "ANOTADO",
          origin: "APP",
        }),
      })
    );
    expect(broadcastTablesChanged).toHaveBeenCalledTimes(1);
  });

  it("si dos requests casi simultáneas pasan el chequeo y la base tira P2002, responde 409 claro", async () => {
    // Este es el caso de "doble click" / dos pestañas: el chequeo previo
    // (findFirst) puede no alcanzar a detectar la carrera, pero el índice
    // único de la base sí, y Prisma lo reporta como error P2002.
    prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER as any);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(OPEN_TABLE as any);
    prismaMock.waitingListEntry.findFirst.mockResolvedValueOnce(null);
    prismaMock.waitingListEntry.create.mockRejectedValueOnce({ code: "P2002" });

    await expect(joinWaitingList("table-1", "user-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("leaveWaitingList", () => {
  it("rechaza si no tiene ninguna inscripción activa en esa mesa", async () => {
    prismaMock.waitingListEntry.findFirst.mockResolvedValueOnce(null);

    await expect(leaveWaitingList("user-1", "table-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rechaza si está SENTADO (no puede auto-retirarse, tiene que hacerlo el personal)", async () => {
    prismaMock.waitingListEntry.findFirst.mockResolvedValueOnce({
      id: "entry-1",
      status: "SENTADO",
    } as any);

    await expect(leaveWaitingList("user-1", "table-1")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prismaMock.waitingListEntry.update).not.toHaveBeenCalled();
  });

  it("retira correctamente una inscripción ANOTADO", async () => {
    prismaMock.waitingListEntry.findFirst.mockResolvedValueOnce({
      id: "entry-1",
      status: "ANOTADO",
    } as any);

    const result = await leaveWaitingList("user-1", "table-1");

    expect(result).toEqual({ message: "Te retiraste de la lista." });
    expect(prismaMock.waitingListEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry-1" },
        data: expect.objectContaining({ status: "RETIRADO" }),
      })
    );
    expect(broadcastTablesChanged).toHaveBeenCalledTimes(1);
  });
});

describe("seatFromWaitingList", () => {
  const ENTRY = {
    id: "entry-1",
    status: "ANOTADO",
    tableId: "table-1",
    documentType: "DNI",
    documentNumber: "30111222",
    table: OPEN_TABLE,
  };

  it("rechaza si la inscripción no existe o ya no está en espera", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce(null);

    await expect(seatFromWaitingList("entry-1", "staff-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rechaza si la mesa ya no tiene lugar", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce(ENTRY as any);
    prismaMock.waitingListEntry.count.mockResolvedValueOnce(OPEN_TABLE.capacity); // ya está llena

    await expect(seatFromWaitingList("entry-1", "staff-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("sienta al jugador cuando hay lugar y no estaba sentado en otra mesa", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce(ENTRY as any);
    prismaMock.waitingListEntry.count.mockResolvedValueOnce(3); // hay lugar
    prismaMock.waitingListEntry.findFirst
      .mockResolvedValueOnce(null) // no está sentado en otra mesa
      .mockResolvedValueOnce(null); // checkRecentCashOutWarning: no cobró hace poco

    const result = await seatFromWaitingList("entry-1", "staff-1");

    expect(result.message).toBe("Jugador sentado correctamente.");
    expect(result.warning).toBeUndefined();
    expect(broadcastTablesChanged).toHaveBeenCalledTimes(1);
  });

  it("si ya estaba SENTADO en otra mesa, lo mueve automáticamente y lo avisa en el mensaje", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce(ENTRY as any);
    prismaMock.waitingListEntry.count.mockResolvedValueOnce(3);
    prismaMock.waitingListEntry.findFirst
      .mockResolvedValueOnce({
        id: "entry-old",
        tableId: "table-2",
        table: { name: "Mesa 2" },
      } as any) // estaba sentado en Mesa 2
      .mockResolvedValueOnce(null); // sin alerta de cash-out reciente

    const result = await seatFromWaitingList("entry-1", "staff-1");

    expect(result.message).toContain("se lo retiró automáticamente de Mesa 2");
    // Se actualizan las dos entradas: la vieja (retirada) y la nueva (sentada).
    expect(prismaMock.waitingListEntry.update).toHaveBeenCalledTimes(2);
  });
});

describe("removeEntry", () => {
  it("rechaza si la inscripción no existe o ya no está activa", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce(null);

    await expect(removeEntry("entry-1", "staff-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("guarda el cash-out solo si estaba SENTADO, nunca si estaba solo ANOTADO", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce({
      id: "entry-1",
      status: "ANOTADO",
    } as any);

    await removeEntry("entry-1", "staff-1", "se cansó de esperar", 5000);

    expect(prismaMock.waitingListEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ cashOutAmount: expect.anything() }),
      })
    );
  });

  it("sí guarda cashOutAmount/cashOutAt cuando estaba SENTADO", async () => {
    prismaMock.waitingListEntry.findUnique.mockResolvedValueOnce({
      id: "entry-1",
      status: "SENTADO",
    } as any);

    await removeEntry("entry-1", "staff-1", undefined, 12000);

    expect(prismaMock.waitingListEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cashOutAmount: 12000 }),
      })
    );
  });
});

describe("seatWalkinGuest", () => {
  const GUEST = {
    documentType: "DNI",
    documentNumber: "40111222",
    firstName: "Juan",
    lastName: "Pérez",
  };

  it("rechaza si falta algún dato obligatorio", async () => {
    await expect(
      seatWalkinGuest("table-1", { ...GUEST, firstName: "" }, "staff-1")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rechaza si esa persona ya tiene una cuenta registrada", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-existente" } as any);

    await expect(seatWalkinGuest("table-1", GUEST, "staff-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("rechaza si la mesa no existe", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(null);

    await expect(seatWalkinGuest("table-1", GUEST, "staff-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rechaza si la mesa está completa", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(OPEN_TABLE as any);
    prismaMock.waitingListEntry.count.mockResolvedValueOnce(OPEN_TABLE.capacity);

    await expect(seatWalkinGuest("table-1", GUEST, "staff-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("sienta al invitado sin cuenta con userId null", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.casinoTable.findUnique.mockResolvedValueOnce(OPEN_TABLE as any);
    prismaMock.waitingListEntry.count.mockResolvedValueOnce(2);
    prismaMock.waitingListEntry.findFirst
      .mockResolvedValueOnce(null) // no está sentado en otra mesa
      .mockResolvedValueOnce(null); // sin alerta de cash-out
    prismaMock.waitingListEntry.create.mockResolvedValueOnce({ id: "entry-guest" } as any);

    const result = await seatWalkinGuest("table-1", GUEST, "staff-1");

    expect(result.id).toBe("entry-guest");
    expect(prismaMock.waitingListEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          origin: "MANUAL_STAFF",
          documentNumber: GUEST.documentNumber,
        }),
      })
    );
    expect(broadcastTablesChanged).toHaveBeenCalledTimes(1);
  });
});