import { createAllCrawlers } from './crawlers/index.js';
import { JsonStorage } from './storage/JsonStorage.js';
import { CrawlScheduler } from './scheduler/CrawlScheduler.js';

/**
 * 一次性爬取脚本 - 用于手动测试
 * 运行：npm run crawl
 */
async function main() {
  console.log('=== 手动爬取模式 ===\n');

  const storage = new JsonStorage();
  const crawlers = createAllCrawlers();
  const scheduler = new CrawlScheduler(crawlers, storage);

  console.log(`当前存储数据量: ${storage.getSize()} 条\n`);

  const results = await scheduler.runAllEnabled();

  console.log('\n=== 爬取结果汇总 ===');
  let totalNew = 0;
  for (const r of results) {
    const status = r.success ? '✓' : '✗';
    console.log(`  ${status} ${r.source}: +${r.count} 条`);
    totalNew += r.count;
  }

  storage.save();
  console.log(`\n新增 ${totalNew} 条，总存储 ${storage.getSize()} 条`);
  console.log('数据已保存到 server/data/contents.json');

  storage.destroy();
}

main().catch(console.error);
