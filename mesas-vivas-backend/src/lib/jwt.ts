import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("JWT_SECRET no está definida — el login no va a funcionar.");
}

// Corto a propósito: si se filtra, el daño posible es acotado. La sesión
// larga la sostiene el refresh token (guardado hasheado en la base),
// no este access token.
const ACCESS_TOKEN_TTL = "15m";

export interface AccessTokenPayload {
  userId: string;
  roles: string[];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET as string) as AccessTokenPayload;
}