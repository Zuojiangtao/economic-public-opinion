// T008: migrated to SQLite
import { getDb } from './db.js';
import type { IndustryMapping } from '../types.js';

const NOW = '2026-01-01T00:00:00Z';

const DEFAULT_MAPPINGS: IndustryMapping[] = [
  {
    id: 'industry-ai', name: 'AI科技', type: 'sector', description: '人工智能及相关科技产业',
    keywords: ['AI', '人工智能', '大模型', '算力', 'ChatGPT', 'GPT', '机器学习', '深度学习', '神经网络', 'LLM', '生成式AI'],
    synonyms: ['人工智能', 'Artificial Intelligence', '智能计算', 'AIGC', '智算'],
    relatedConcepts: ['半导体', '云计算', '大数据'],
    stocks: [
      { code: '002415', name: '海康威视', shortName: '海康', market: 'cn' },
      { code: '300059', name: '东方财富', market: 'cn' },
    ],
    indices: ['科创50', '中证人工智能'],
    overseasMappings: [{ code: 'NVDA', name: '英伟达', market: 'us', mappedThemes: ['AI', '算力', '半导体', 'GPU'] }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-new-energy', name: '新能源', type: 'industry', description: '新能源汽车、光伏、储能等清洁能源产业',
    keywords: ['新能源', '光伏', '锂电池', '储能', '风电', '电动汽车', 'NEV', '充电桩', '氢能', '碳中和', '双碳'],
    synonyms: ['清洁能源', '绿色能源', '可再生能源'], relatedConcepts: ['有色金属', '汽车', '电力'],
    stocks: [
      { code: '300750', name: '宁德时代', shortName: '宁德', market: 'cn', chainPosition: 'midstream' },
      { code: '002594', name: '比亚迪', shortName: '比亚迪', market: 'cn', chainPosition: 'downstream' },
      { code: '600438', name: '通威股份', market: 'cn', chainPosition: 'upstream' },
    ],
    indices: ['新能源汽车指数', '光伏指数', 'CSI新能源'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-metals', name: '有色金属', type: 'industry', description: '铜、铝、黄金、锂等有色金属矿业',
    keywords: ['有色金属', '铜', '铝', '黄金', '锂', '钴', '镍', '白银', '稀土', '铅锌'],
    synonyms: ['金属', '矿业', '采矿'], relatedConcepts: ['新能源', '半导体'],
    stocks: [
      { code: '601899', name: '紫金矿业', market: 'cn', isHoldings: true },
      { code: '600547', name: '山东黄金', market: 'cn' },
      { code: '002460', name: '赣锋锂业', market: 'cn' },
    ],
    indices: ['有色金属指数', '中证有色'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-semiconductor', name: '半导体', type: 'industry', description: '芯片、集成电路、晶圆制造等半导体产业',
    keywords: ['半导体', '芯片', '集成电路', '晶圆', '光刻机', 'EDA', '封测', '存储芯片', 'CPU', 'GPU', '功率半导体'],
    synonyms: ['IC', '集成电路', '微电子', '芯片设计'], relatedConcepts: ['AI科技', '消费电子'],
    stocks: [
      { code: '603501', name: '韦尔股份', market: 'cn' },
      { code: '688012', name: '中微公司', market: 'cn' },
      { code: '002049', name: '紫光国微', market: 'cn' },
    ],
    indices: ['科创芯片', '中证半导体', '半导体指数'],
    overseasMappings: [
      { code: 'NVDA', name: '英伟达', market: 'us', mappedThemes: ['AI', '算力', '半导体', 'GPU'] },
      { code: 'ASML', name: '阿斯麦', market: 'us', mappedThemes: ['半导体', '光刻机'] },
    ],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-pharma', name: '医药', type: 'industry', description: '创新药、生物医药、医疗器械等大健康产业',
    keywords: ['医药', '创新药', '生物医药', '疫苗', '医疗器械', 'CXO', '中药', '基因治疗', '细胞治疗', '仿制药', 'CDMO'],
    synonyms: ['医疗', '生命科学', '大健康', '医疗健康', 'Biotech'], relatedConcepts: ['消费', '科技'],
    stocks: [
      { code: '600276', name: '恒瑞医药', market: 'cn' },
      { code: '300015', name: '爱尔眼科', market: 'cn' },
      { code: '603259', name: '药明康德', market: 'cn' },
    ],
    indices: ['医药生物指数', '创新药指数', '中证医疗'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-bank', name: '银行', type: 'industry', description: '商业银行、国有大行、城商行等金融机构',
    keywords: ['银行', '降准', '降息', 'LPR', '存款', '贷款', '净息差', '不良贷款', '拨备', '国有大行', '城商行'],
    synonyms: ['金融', '商业银行', '银行板块'], relatedConcepts: ['房地产', '货币政策'],
    stocks: [
      { code: '601398', name: '工商银行', shortName: '工行', market: 'cn', isHoldings: true },
      { code: '601939', name: '建设银行', shortName: '建行', market: 'cn' },
      { code: '600036', name: '招商银行', shortName: '招行', market: 'cn' },
    ],
    indices: ['中证银行指数', '银行ETF'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-realestate', name: '房地产', type: 'industry', description: '房地产开发、物业管理等产业',
    keywords: ['房地产', '楼市', '房价', '地产', '开发商', '商品房', '保障性住房', '土地出让', '房贷', '限购', '以旧换新'],
    synonyms: ['地产', '房产', '楼盘'], relatedConcepts: ['银行', '建材', '家电'],
    stocks: [
      { code: '000002', name: '万科A', shortName: '万科', market: 'cn' },
      { code: '600048', name: '保利发展', market: 'cn' },
      { code: '001979', name: '招商蛇口', market: 'cn' },
    ],
    indices: ['房地产指数', '中证地产'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-consumer', name: '消费', type: 'industry', description: '食品饮料、家电、零售等大消费产业',
    keywords: ['消费', '食品饮料', '白酒', '家电', '零售', '免税', '旅游', '酒店', '餐饮', '乳制品', '调味品'],
    synonyms: ['大消费', '消费品', '消费板块'], relatedConcepts: ['医药', '银行'],
    stocks: [
      { code: '600519', name: '贵州茅台', shortName: '茅台', market: 'cn' },
      { code: '000858', name: '五粮液', market: 'cn' },
      { code: '000333', name: '美的集团', shortName: '美的', market: 'cn' },
    ],
    indices: ['中证消费', '食品饮料指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-defense', name: '军工', type: 'industry', description: '航空航天、兵器、船舶等国防军工产业',
    keywords: ['军工', '国防', '航空航天', '导弹', '卫星', '北斗', '战斗机', '航母', '武器装备', '军民融合'],
    synonyms: ['国防军工', '军事', '军工板块'], relatedConcepts: ['半导体', '新能源'],
    stocks: [
      { code: '600893', name: '航发动力', market: 'cn' },
      { code: '600760', name: '中航沈飞', market: 'cn' },
      { code: '002179', name: '中航光电', market: 'cn' },
    ],
    indices: ['军工指数', '中证军工'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-auto', name: '汽车', type: 'industry', description: '整车制造、汽车零部件、智能驾驶等',
    keywords: ['汽车', '整车', '零部件', '智能驾驶', '自动驾驶', '车联网', '汽车电子', '新能源汽车', '造车新势力'],
    synonyms: ['车企', '汽车产业', '汽车板块'], relatedConcepts: ['新能源', '半导体'],
    stocks: [
      { code: '002594', name: '比亚迪', shortName: '比亚迪', market: 'cn', isHoldings: true },
      { code: '601238', name: '广汽集团', market: 'cn' },
      { code: '000625', name: '长安汽车', market: 'cn' },
    ],
    indices: ['汽车指数', '新能源汽车指数'], overseasMappings: [
      { code: 'TSLA', name: '特斯拉', market: 'us', mappedThemes: ['新能源汽车', '智能驾驶'] },
    ], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-media', name: '传媒', type: 'industry', description: '游戏、影视、广告、数字内容等传媒产业',
    keywords: ['传媒', '游戏', '影视', '广告', '数字内容', '短视频', '直播', '元宇宙', '虚拟现实', 'VR', 'AR'],
    synonyms: ['文化传媒', '传媒板块', 'TMT'], relatedConcepts: ['AI科技', '消费'],
    stocks: [
      { code: '300418', name: '昆仑万维', market: 'cn' },
      { code: '002555', name: '三七互娱', market: 'cn' },
      { code: '300413', name: '芒果超媒', market: 'cn' },
    ],
    indices: ['传媒指数', '中证传媒'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-telecom', name: '通信', type: 'industry', description: '5G、光纤、运营商、通信设备等',
    keywords: ['通信', '5G', '光纤', '运营商', '通信设备', '基站', '物联网', 'IDC', '数据中心', '云计算'],
    synonyms: ['通信板块', 'TMT', '信息通信'], relatedConcepts: ['AI科技', '半导体'],
    stocks: [
      { code: '600050', name: '中国联通', market: 'cn' },
      { code: '601728', name: '中国电信', market: 'cn' },
      { code: '000063', name: '中兴通讯', market: 'cn' },
    ],
    indices: ['通信指数', '5G指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-transport', name: '交通运输', type: 'industry', description: '航空、港口、铁路、物流等',
    keywords: ['交通运输', '航空', '港口', '铁路', '物流', '快递', '航运', '公路', '铁路', '机场'],
    synonyms: ['交运', '物流', '运输板块'], relatedConcepts: ['消费', '贸易'],
    stocks: [
      { code: '601006', name: '大秦铁路', market: 'cn' },
      { code: '600029', name: '南方航空', market: 'cn' },
      { code: '601021', name: '春秋航空', market: 'cn' },
    ],
    indices: ['交通运输指数', '物流指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-construction', name: '建筑建材', type: 'industry', description: '水泥、钢铁、建材、基建等',
    keywords: ['建筑', '建材', '水泥', '钢铁', '基建', '房地产', '装修', '玻璃', '陶瓷', '管材'],
    synonyms: ['建筑业', '建材板块', '基建'], relatedConcepts: ['房地产', '有色金属'],
    stocks: [
      { code: '600585', name: '海螺水泥', market: 'cn' },
      { code: '600019', name: '宝钢股份', market: 'cn' },
      { code: '000786', name: '北新建材', market: 'cn' },
    ],
    indices: ['建筑材料指数', '基建指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-utilities', name: '公用事业', type: 'industry', description: '电力、水务、燃气等公共事业',
    keywords: ['公用事业', '电力', '水务', '燃气', '供水', '供电', '供热', '环保', '污水处理', '垃圾处理'],
    synonyms: ['电力', '水务', '公用板块'], relatedConcepts: ['新能源', '环保'],
    stocks: [
      { code: '600900', name: '长江电力', market: 'cn' },
      { code: '600023', name: '浙能电力', market: 'cn', isHoldings: true },
      { code: '600025', name: '华能水电', market: 'cn' },
      { code: '600886', name: '国投电力', market: 'cn' },
    ],
    indices: ['公用事业指数', '电力指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-agriculture', name: '农林牧渔', type: 'industry', description: '种植、养殖、饲料、农药等农业产业',
    keywords: ['农业', '种植', '养殖', '饲料', '农药', '化肥', '猪肉', '禽类', '水产', '种子'],
    synonyms: ['农林牧渔', '农业板块', '大农业'], relatedConcepts: ['消费', '食品饮料'],
    stocks: [
      { code: '300498', name: '温氏股份', market: 'cn' },
      { code: '002714', name: '牧原股份', market: 'cn' },
      { code: '002385', name: '大北农', market: 'cn' },
    ],
    indices: ['农业指数', '农林牧渔指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-securities', name: '证券', type: 'industry', description: '券商、投行、资产管理等证券金融业',
    keywords: ['证券', '券商', '投行', '资产管理', '经纪业务', '两融', '自营业务', '注册制', 'IPO', '再融资'],
    synonyms: ['券商板块', '证券行业', '金融服务'], relatedConcepts: ['银行', '保险'],
    stocks: [
      { code: '600999', name: '招商证券', market: 'cn', isHoldings: true },
      { code: '600030', name: '中信证券', market: 'cn' },
      { code: '601211', name: '国泰君安', market: 'cn' },
    ],
    indices: ['证券指数', '券商ETF'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-coal', name: '煤炭', type: 'industry', description: '煤炭开采、煤化工等传统能源产业',
    keywords: ['煤炭', '煤', '焦煤', '动力煤', '焦炭', '煤化工', '煤矿', '煤炭开采', '煤电'],
    synonyms: ['煤炭板块', '煤炭行业', '传统能源'], relatedConcepts: ['电力', '钢铁'],
    stocks: [
      { code: '601088', name: '中国神华', market: 'cn', isHoldings: true },
      { code: '600188', name: '兖矿能源', market: 'cn' },
      { code: '601898', name: '中煤能源', market: 'cn' },
    ],
    indices: ['煤炭指数', '中证煤炭'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'industry-machinery', name: '工程机械', type: 'industry', description: '挖掘机、起重机、装载机等工程机械制造',
    keywords: ['工程机械', '挖掘机', '起重机', '装载机', '混凝土', '桩工机械', '叉车', '高空作业平台'],
    synonyms: ['机械板块', '工程机械行业', '重型机械'], relatedConcepts: ['基建', '房地产'],
    stocks: [
      { code: '000425', name: '徐工机械', market: 'cn', isHoldings: true },
      { code: '600031', name: '三一重工', market: 'cn' },
      { code: '000157', name: '中联重科', market: 'cn' },
    ],
    indices: ['工程机械指数', '机械指数'], overseasMappings: [], createdAt: NOW, updatedAt: NOW,
  },
];

export function loadIndustryMappingsMap(): Map<string, IndustryMapping> {
  const db = getDb();
  const rows = db.prepare('SELECT id, data_json FROM industry_mappings').all() as { id: string; data_json: string }[];
  if (rows.length > 0) {
    const map = new Map<string, IndustryMapping>();
    for (const r of rows) map.set(r.id, JSON.parse(r.data_json) as IndustryMapping);
    console.log(`[IndustryMappings] Loaded ${map.size} mappings from SQLite`);
    return map;
  }
  // Seed defaults
  const map = new Map<string, IndustryMapping>();
  const stmt = db.prepare('INSERT OR IGNORE INTO industry_mappings (id, data_json) VALUES (?, ?)');
  const seed = db.transaction(() => {
    for (const m of DEFAULT_MAPPINGS) {
      stmt.run(m.id, JSON.stringify(m));
      map.set(m.id, m);
    }
  });
  seed();
  console.log(`[IndustryMappings] Seeded ${map.size} defaults to SQLite`);
  return map;
}

export function saveIndustryMappingsMap(map: Map<string, IndustryMapping>): void {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO industry_mappings (id, data_json) VALUES (?, ?)');
  const save = db.transaction(() => {
    for (const [id, m] of map) upsert.run(id, JSON.stringify(m));
  });
  save();
}

