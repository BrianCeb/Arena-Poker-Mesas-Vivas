import { DocumentType } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { sendVerificationEmail, sendPasswordResetEmail } from "./emailService";
import { signAccessToken } from "../lib/jwt";

interface RegisterInput {
  documentType?: string;
  documentNumber?: string;
  firstName?: string;
  lastName?: string;
  sex?: string;
  email?: string;
  confirmEmail?: string;
  phone?: string;
  nickname?: string;
  password?: string;
  confirmPassword?: string;
  birthDate?: string; // formato ISO, ej "2000-05-14"
  acceptedTerms?: boolean;
}

export class RegisterError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const MIN_AGE = 18;
const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_HOURS = 24;

function isAdult(birthDate: Date): boolean {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= MIN_AGE;
}

export async function registerUser(input: RegisterInput) {
  const {
    documentType,
    documentNumber,
    firstName,
    lastName,
    sex,
    email,
    confirmEmail,
    phone,
    nickname,
    password,
    confirmPassword,
    birthDate,
    acceptedTerms,
  } = input;

  // ── Validaciones básicas (el frontend también valida, pero el
  // backend nunca confía en eso — ver instrucciones de seguridad) ──
  if (
    !documentType ||
    !documentNumber ||
    !firstName ||
    !lastName ||
    !sex ||
    !email ||
    !password ||
    !birthDate
  ) {
    throw new RegisterError(400, "Faltan campos obligatorios.");
  }

  if (!Object.values(DocumentType).includes(documentType as DocumentType)) {
    throw new RegisterError(400, "Tipo de documento inválido.");
  }

  if (email !== confirmEmail) {
    throw new RegisterError(400, "Los emails no coinciden.");
  }

  if (password !== confirmPassword) {
    throw new RegisterError(400, "Las contraseñas no coinciden.");
  }

  if (password.length < 8) {
    throw new RegisterError(400, "La contraseña debe tener al menos 8 caracteres.");
  }

  if (!acceptedTerms) {
    throw new RegisterError(400, "Debés aceptar los términos y condiciones.");
  }

  const parsedBirthDate = new Date(birthDate);
  if (isNaN(parsedBirthDate.getTime())) {
    throw new RegisterError(400, "Fecha de nacimiento inválida.");
  }
  if (!isAdult(parsedBirthDate)) {
    throw new RegisterError(400, "Debés ser mayor de 18 años para registrarte.");
  }

  // ── Chequeo de duplicados ──
  // Esto es solo para dar un mensaje de error claro y rápido. La garantía
  // real de que no haya duplicados la da el UNIQUE de la base de datos
  // (ver el catch de P2002 más abajo) — nunca confiamos solo en este check.
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { documentType: documentType as DocumentType, documentNumber },
      ],
    },
  });
  if (existing) {
    throw new RegisterError(409, "Ya existe una cuenta con ese email o documento.");
  }

  const currentTerms = await prisma.termsVersion.findFirst({
    where: { isCurrent: true },
  });
  if (!currentTerms) {
    // Esto no debería pasar si se corrió `npm run seed`.
    throw new RegisterError(
      500,
      "No hay una versión vigente de Términos y Condiciones cargada."
    );
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Token de verificación de email: se guarda hasheado (igual que una
  // contraseña), nunca el valor plano — ver punto 13 de seguridad.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000
  );

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          documentType: documentType as DocumentType,
          documentNumber,
          firstName,
          lastName,
          sex,
          email,
          phone: phone || null,
          nickname: nickname || null,
          passwordHash,
          birthDate: parsedBirthDate,
          status: "PENDIENTE",
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash,
          expiresAt,
        },
      });

      await tx.userTermsAcceptance.create({
        data: {
          userId: created.id,
          termsVersionId: currentTerms.id,
        },
      });

      return created;
    });

    // El email se manda DESPUÉS de que la transacción confirmó — si el
    // envío falla, el usuario ya quedó creado en PENDIENTE (no perdemos
    // el registro por un problema de Resend, ver nota en emailService).
    await sendVerificationEmail(user.email, user.firstName, rawToken);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
    };
  } catch (err: any) {
    // P2002 = violación de constraint UNIQUE en Prisma. Cubre el caso raro
    // de que dos registros lleguen casi al mismo tiempo y el check de
    // arriba no lo haya detectado — la base es la última línea de defensa.
    if (err.code === "P2002") {
      throw new RegisterError(409, "Ya existe una cuenta con ese email o documento.");
    }
    throw err;
  }
}

export async function verifyEmail(rawToken: string) {
  if (!rawToken) {
    throw new RegisterError(400, "Falta el token de verificación.");
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const tokenRecord = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash },
  });

  if (!tokenRecord) {
    throw new RegisterError(400, "Token de verificación inválido.");
  }
  if (tokenRecord.usedAt) {
    throw new RegisterError(400, "Este link ya fue utilizado.");
  }
  if (tokenRecord.expiresAt < new Date()) {
    throw new RegisterError(400, "Este link venció. Pedí uno nuevo.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { status: "ACTIVA", emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { message: "Cuenta activada correctamente." };
}

// ── LOGIN, REFRESH Y LOGOUT ──────────────────────────────────

const REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function generateOpaqueToken() {
  const rawToken = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

interface LoginMeta {
  ip?: string;
  userAgent?: string;
}

export async function loginUser(email: string, password: string, meta: LoginMeta) {
  if (!email || !password) {
    throw new RegisterError(400, "Email y contraseña son obligatorios.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  // Mensaje genérico a propósito, tanto si el email no existe como si la
  // contraseña está mal — no queremos que alguien pueda usar este endpoint
  // para averiguar qué emails están registrados (enumeración de cuentas).
  const invalidCredentials = () => new RegisterError(401, "Email o contraseña incorrectos.");

  if (!user) {
    throw invalidCredentials();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new RegisterError(
      423,
      "Cuenta bloqueada temporalmente por intentos fallidos. Probá de nuevo más tarde."
    );
  }

  if (user.status === "PENDIENTE") {
    throw new RegisterError(403, "Tenés que verificar tu email antes de iniciar sesión.");
  }
  if (user.status === "BLOQUEADA" || user.status === "DESHABILITADA") {
    throw new RegisterError(403, "Tu cuenta no está habilitada. Contactá al casino.");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });
    throw invalidCredentials();
  }

  // Login correcto: reseteamos el contador de intentos fallidos.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const roleNames = user.roles.map((ur) => ur.role.name);
  const accessToken = signAccessToken({ userId: user.id, roles: roleNames });

  const { rawToken: refreshToken, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: roleNames,
    },
  };
}

export async function refreshAccessToken(rawRefreshToken: string) {
  if (!rawRefreshToken) {
    throw new RegisterError(400, "Falta el refresh token.");
  }

  const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });

  if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
    throw new RegisterError(401, "Sesión inválida o vencida. Iniciá sesión de nuevo.");
  }

  // Rotación: el token usado se revoca y se emite uno nuevo. Si alguien
  // intenta reusar un refresh token viejo (por ejemplo, uno robado), esto
  // ya va a estar revocado y el intento va a fallar acá mismo.
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });

  const { rawToken: newRefreshToken, tokenHash: newHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: tokenRecord.userId, tokenHash: newHash, expiresAt },
  });

  const roleNames = tokenRecord.user.roles.map((ur) => ur.role.name);
  const accessToken = signAccessToken({ userId: tokenRecord.userId, roles: roleNames });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(rawRefreshToken: string) {
  if (!rawRefreshToken) return;
  const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── CAMBIO DE CONTRASEÑA (usuario logueado) ──────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
) {
  if (!currentPassword || !newPassword) {
    throw new RegisterError(400, "Faltan campos obligatorios.");
  }
  if (newPassword !== confirmNewPassword) {
    throw new RegisterError(400, "Las contraseñas nuevas no coinciden.");
  }
  if (newPassword.length < 8) {
    throw new RegisterError(400, "La contraseña debe tener al menos 8 caracteres.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new RegisterError(404, "Usuario no encontrado.");
  }

  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw new RegisterError(401, "La contraseña actual es incorrecta.");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    // Igual criterio que en el reset por email: cambiar la contraseña
    // cierra todas las sesiones activas (incluida esta), por seguridad —
    // si alguien más tenía un refresh token de esta cuenta, queda cortado.
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: "Contraseña actualizada. Iniciá sesión de nuevo." };
}

// ── RECUPERACIÓN DE CONTRASEÑA ───────────────────────────────

const RESET_TOKEN_TTL_HOURS = 1; // más corto que el de verificación a propósito

export async function requestPasswordReset(email: string) {
  if (!email) {
    throw new RegisterError(400, "El email es obligatorio.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Si el usuario no existe, NO tiramos error — respondemos igual que si
  // existiera. Si dijéramos "ese email no existe", cualquiera podría usar
  // este endpoint para averiguar qué emails están registrados.
  if (!user) {
    return { message: "Si el email existe, vas a recibir un link para restablecer tu contraseña." };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  await sendPasswordResetEmail(user.email, user.firstName, rawToken);

  return { message: "Si el email existe, vas a recibir un link para restablecer tu contraseña." };
}

export async function confirmPasswordReset(rawToken: string, newPassword: string, confirmNewPassword: string) {
  if (!rawToken) {
    throw new RegisterError(400, "Falta el token.");
  }
  if (!newPassword || newPassword !== confirmNewPassword) {
    throw new RegisterError(400, "Las contraseñas no coinciden.");
  }
  if (newPassword.length < 8) {
    throw new RegisterError(400, "La contraseña debe tener al menos 8 caracteres.");
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const tokenRecord = await prisma.passwordResetToken.findFirst({ where: { tokenHash } });

  if (!tokenRecord) {
    throw new RegisterError(400, "Token inválido.");
  }
  if (tokenRecord.usedAt) {
    throw new RegisterError(400, "Este link ya fue utilizado.");
  }
  if (tokenRecord.expiresAt < new Date()) {
    throw new RegisterError(400, "Este link venció. Pedí uno nuevo.");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: {
        passwordHash,
        // Aprovechamos para levantar cualquier bloqueo por intentos
        // fallidos — cambiar la contraseña es una buena señal de que el
        // dueño real de la cuenta recuperó el control.
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
    // Por seguridad, al cambiar la contraseña cerramos todas las sesiones
    // activas (revocamos todos los refresh tokens) — si alguien más tenía
    // acceso a la cuenta, esto lo saca.
    prisma.refreshToken.updateMany({
      where: { userId: tokenRecord.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: "Contraseña actualizada correctamente." };
}