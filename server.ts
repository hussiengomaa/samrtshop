import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb } from './src/server/db/database.js';
import { apiRouter } from './src/server/routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize SQLite database
  await getDb();
  console.log('[Server] Database initialized successfully.');

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API router
  app.use('/api', apiRouter);

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        host: '0.0.0.0'
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted for development.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Server] Serving static production build.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] SmartShop AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal error during startup:', err);
  process.exit(1);
});
