import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Expose repository screenshots stored under .github/screenshots
  app.use(
    '/screenshots',
    express.static(path.join(__dirname, '.github', 'screenshots'), {
      maxAge: '1h',
    })
  );

  // Expose attached reference assets stored under public/assets
  app.use(
    '/assets',
    express.static(path.join(__dirname, 'public', 'assets'), {
      maxAge: '1h',
    })
  );

  // Serve each standalone WebGPU build intact under its own path
  for (const version of ['napoli', 'posillipo', 'fable', 'opus', 'astra']) {
    app.use(
      `/${version}`,
      express.static(path.join(__dirname, version), {
        index: 'index.html',
      })
    );
  }

  // Root launcher page
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not Found');
  });

  return app;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';
  const app = createApp();
  app.listen(port, host, () => {
    console.log(`Uno com escada rodando em http://${host}:${port}`);
  });
}
