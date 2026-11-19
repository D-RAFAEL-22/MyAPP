import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chatDataOf,
  compileWidget,
  promptGuide,
  toSendWidgetParams,
  widgetSpecSchema,
} from './src/tw/index.ts';
import { deflate9Node } from './src/tw/measure-node.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/schema', (_req, res) => {
    res.json(widgetSpecSchema);
  });

  app.get('/api/prompt-guide', (_req, res) => {
    res.type('text/plain; charset=utf-8').send(promptGuide());
  });

  app.post('/api/compile', (req, res) => {
    const body = req.body as {
      spec?: unknown;
      allowedOrigins?: string[];
      botUsername?: string;
      limits?: Record<string, number>;
      words?: Record<string, string>;
      chatId?: number | string;
    };

    const allowedOrigins = Array.isArray(body?.allowedOrigins)
      ? body.allowedOrigins
      : ['https://acme.sayf.example'];

    const result = compileWidget(body?.spec, {
      deflate9: deflate9Node,
      allowedOrigins,
      botUsername: typeof body?.botUsername === 'string' && body.botUsername.trim() ? body.botUsername.trim() : undefined,
      limits: body?.limits,
      words: body?.words,
    });

    if (!result.ok) {
      res.json({ ok: false, error: result.error });
      return;
    }

    const sendWidgetParams = toSendWidgetParams(body?.chatId ?? 123456789, result.value);
    res.json({
      ok: true,
      value: result.value,
      sendWidgetParams,
    });
  });

  app.post('/api/chat-data', (req, res) => {
    const body = req.body as { spec?: unknown; state?: unknown };
    const stateResult = chatDataOf(body?.spec as never, body?.state as never);
    if (!stateResult.ok) {
      res.json({ ok: false, error: stateResult.error });
      return;
    }
    res.json({ ok: true, chatData: stateResult.value });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`TW Compiler Studio listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
