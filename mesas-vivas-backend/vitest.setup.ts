import { beforeEach, vi } from "vitest";
import { mockReset } from "vitest-mock-extended";
import { prismaMock } from "./src/lib/__mocks__/prisma";

// Cualquier archivo de servicio que haga `import prisma from "../lib/prisma"`
// (con la ruta relativa que sea) recibe automáticamente el mock de acá
// abajo en vez de conectarse a una base real. No hace falta repetir este
// vi.mock en cada archivo de test.
vi.mock("./src/lib/prisma");

beforeEach(() => {
  mockReset(prismaMock);

  // Prisma usa $transaction de dos formas distintas en el código real:
  //   1) con un array de operaciones ya "armadas": prisma.$transaction([...])
  //   2) con una función interactiva: prisma.$transaction(async (tx) => {...})
  // Esta implementación cubre las dos sin que cada test tenga que
  // repetirla: para el array, resuelve todo con Promise.all; para la
  // función, la ejecuta pasándole el mismo prismaMock como "tx" (así los
  // asserts sobre prismaMock.algo.mockResolvedValue(...) siguen
  // funcionando adentro de la transacción interactiva).
  prismaMock.$transaction.mockImplementation((arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg) as any;
    return arg(prismaMock);
  });
});