import express from 'express';
import cors from 'cors';
import { createAllCrawlers } from './crawlers/index.js';
import { JsonStorage } from './storage/JsonStorage.js';
import { CrawlScheduler } from './scheduler/CrawlScheduler.js';
import { createRouter } from './api/routes.js';
import { SERVER_PORT } from './config.js';

const app = express();

app.use(cors());
app.use(express.json());

const storage = new JsonStorage();
const crawlers = createAllCrawlers();
const scheduler = new CrawlScheduler(crawlers, storage);

app.use('/api/v1', createRouter(storage, scheduler));

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

app.listen(SERVER_PORT, () => {
  console.log(`\n=== 金融舆情监测系统 - 爬虫服务 ===`);
  console.log(`API: http://localhost:${SERVER_PORT}/api/v1`);
  console.log(`健康检查: http://localhost:${SERVER_PORT}/health`);
  console.log(`存储数据量: ${storage.getSize()} 条\n`);

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
