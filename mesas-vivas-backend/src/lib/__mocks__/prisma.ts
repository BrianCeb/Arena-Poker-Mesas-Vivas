// Va en: src/lib/__mocks__/prisma.ts
//
// Vitest (igual que Jest) auto-mockea un módulo con el contenido de un
// archivo en __mocks__/ que esté al lado del original, cuando algún test
// llama a vi.mock("../lib/prisma") sin pasarle una función. Este archivo
// es ese mock: un PrismaClient "falso" donde cada método (findUnique,
// create, update, etc.) es una función de test que por default devuelve
// undefined, y que cada test puede configurar con
// prismaMock.user.findUnique.mockResolvedValueOnce(...) para simular lo
// que necesite, sin tocar una base de datos real.
import { PrismaClient } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";
import type { DeepMockProxy } from "vitest-mock-extended";

export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

export default prismaMock;