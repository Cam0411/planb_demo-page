import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfchwza1n',
  api_key: process.env.CLOUDINARY_API_KEY || '164479568338558',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'GGkl0_UqjlfQJH0C6ocG__g_LrE'
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Health check

  // Signature endpoint for client-side direct upload (Bypasses 32MB server limit)
  app.get("/api/cloudinary-signature", (req, res) => {
    console.log(`[API] ${req.method} ${req.url} requested`);
    try {
      const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || 'dfchwza1n';
      const api_key = process.env.CLOUDINARY_API_KEY || '164479568338558';
      const api_secret = process.env.CLOUDINARY_API_SECRET || 'GGkl0_UqjlfQJH0C6ocG__g_LrE';

      console.log('Generating Cloudinary signature for cloud:', cloud_name);

      const timestamp = Math.round(new Date().getTime() / 1000);
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: "video_feedback_comments" },
        api_secret
      );

      res.setHeader('Content-Type', 'application/json');
      res.json({
        signature,
        timestamp,
        cloud_name,
        api_key,
      });
    } catch (error: any) {
      console.error('[API] Signature generation failed:', error);
      res.status(500).json({ 
        error: "Failed to generate signature", 
        message: error.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode");
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // Avoid intercepting API routes that should have been handled above
      if (req.url.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
