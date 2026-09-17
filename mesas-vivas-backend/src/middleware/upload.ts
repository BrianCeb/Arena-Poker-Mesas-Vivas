import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "tournaments");

// Nos aseguramos de que la carpeta exista antes de que multer intente escribir ahí.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Nombre único para no pisar archivos si dos admins suben algo con
    // el mismo nombre de archivo original.
    const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP."));
  }
  cb(null, true);
}

export const uploadTournamentImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por imagen
}).fields([
  { name: "flyer", maxCount: 1 },
  { name: "structure", maxCount: 1 },
]);