import { BaseCrawler } from './BaseCrawler.js';
import { EastMoneyCrawler } from './EastMoneyCrawler.js';
import { GubaCrawler } from './GubaCrawler.js';
import { XueqiuCrawler } from './XueqiuCrawler.js';
import { SinaFinanceCrawler } from './SinaFinanceCrawler.js';
import { ClsCrawler } from './ClsCrawler.js';
import { ThsCrawler } from './ThsCrawler.js';
import { ZhihuCrawler } from './ZhihuCrawler.js';
import { XiaohongshuCrawler } from './XiaohongshuCrawler.js';
import { DouyinCrawler } from './DouyinCrawler.js';
import { WindCrawler } from './WindCrawler.js';
import { ChinaSecuritiesJournalCrawler } from './ChinaSecuritiesJournalCrawler.js';
import { RegulatoryAuthorityCrawler } from './RegulatoryAuthorityCrawler.js';
import { BrokerResearchCrawler } from './BrokerResearchCrawler.js';
import { HKEXCrawler } from './HKEXCrawler.js';
import { SECCrawler } from './SECCrawler.js';
import { BloombergCrawler } from './BloombergCrawler.js';
import { ReutersCrawler } from './ReutersCrawler.js';
import { FutuCrawler } from './FutuCrawler.js';
import { TigerCrawler } from './TigerCrawler.js';
import { Laohu8Crawler } from './Laohu8Crawler.js';
import { FirstBankCrawler } from './FirstBankCrawler.js';
import { StockstarCrawler } from './StockstarCrawler.js';

export function createAllCrawlers(): BaseCrawler[] {
  return [
    new EastMoneyCrawler(),
    new GubaCrawler(),
    new XueqiuCrawler(),
    new SinaFinanceCrawler(),
    new ClsCrawler(),
    new ThsCrawler(),
    new ChinaSecuritiesJournalCrawler(),
    new ZhihuCrawler(),
    new XiaohongshuCrawler(),
    new DouyinCrawler(),
    new WindCrawler(),
    new RegulatoryAuthorityCrawler(),
    new BrokerResearchCrawler(),
    new HKEXCrawler(),
    new SECCrawler(),
    new BloombergCrawler(),
    new ReutersCrawler(),
    new FutuCrawler(),
    new TigerCrawler(),
    new Laohu8Crawler(),
    new FirstBankCrawler(),
    new StockstarCrawler(),
  ];
}

export { BaseCrawler };
