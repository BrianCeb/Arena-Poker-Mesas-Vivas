import prisma from "../lib/prisma";

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export async function getAuditLogs(filters: AuditLogFilters, page: number, pageSize: number) {
  const where: any = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { logs, total, page, pageSize };
}