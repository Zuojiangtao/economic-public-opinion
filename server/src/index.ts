import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { createAllCrawlers } from './crawlers/index.js';
import { JsonStorage } from './storage/JsonStorage.js';
import { CrawlScheduler } from './scheduler/CrawlScheduler.js';
import { createRouter } from './api/routes.js';
import { createDeepAnalysisRouter } from './api/deepAnalysisHandler.js';
import { SERVER_PORT } from './config.js';

const app = express();

app.use(cors());
app.use(express.json());

const storage = new JsonStorage();
const crawlers = createAllCrawlers();
const scheduler = new CrawlScheduler(crawlers, storage);

// Health check — 放最前面，不被 catch-all 拦截
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    storageSize: storage.getSize(),
    crawlers: scheduler.getStatuses().map((s) => ({
      name: s.name,
      enabled: s.enabled,
      lastSuccess: s.lastSuccess,
      totalFetched: s.totalFetched,
    })),
  });
});

app.use('/api/v1/deep-analysis', createDeepAnalysisRouter(storage));
app.use('/api/v1', createRouter(storage, scheduler));

// 生产模式：服务前端静态文件
const isProduction = process.env['NODE_ENV'] === 'production';
if (isProduction) {
  const webDistPath = join(process.cwd(), '../web/dist');
  
  if (existsSync(webDistPath) && existsSync(join(webDistPath, 'index.html'))) {
    console.log(`[Static] Serving frontend from: ${webDistPath}`);
    app.use(express.static(webDistPath));
    // SPA fallback — 所有非 API、非 health 的 GET 请求都返回 index.html
    app.get('/{*splat}', (req, res) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path}` });
        return;
      }
      res.sendFile(join(webDistPath, 'index.html'));
    });
  } else {
    console.warn(`[Static] Frontend dist not found at: ${webDistPath}`);
  }
}

app.listen(SERVER_PORT, () => {
  console.log(`\n=== 金融舆情监测系统 - 爬虫服务 ===`);
  console.log(`API: http://localhost:${SERVER_PORT}/api/v1`);
  console.log(`健康检查: http://localhost:${SERVER_PORT}/health`);
  console.log(`存储数据量: ${storage.getSize()} 条`);
  if (isProduction) {
    console.log(`前端: http://localhost:${SERVER_PORT}`);
  }
  console.log('');

  scheduler.start();
});

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  scheduler.stop();
  storage.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  scheduler.stop();
  storage.destroy();
  process.exit(0);
});
