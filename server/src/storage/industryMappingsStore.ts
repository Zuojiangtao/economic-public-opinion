import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';
import type { IndustryMapping } from '../types.js';

const FILE = path.join(DATA_DIR, 'industry-mappings.json');

const NOW = '2026-01-01T00:00:00Z';

const DEFAULT_MAPPINGS: IndustryMapping[] = [
  {
    id: 'industry-ai',
    name: 'AI科技',
    type: 'sector',
    description: '人工智能及相关科技产业',
    keywords: ['AI', '人工智能', '大模型', '算力', 'ChatGPT', 'GPT', '机器学习', '深度学习', '神经网络', 'LLM', '生成式AI'],
    synonyms: ['人工智能', 'Artificial Intelligence', '智能计算', 'AIGC', '智算'],
    relatedConcepts: ['半导体', '云计算', '大数据'],
    stocks: [
      { code: '002415', name: '海康威视', shortName: '海康', market: 'cn' },
      { code: '300059', name: '东方财富', market: 'cn' },
    ],
    indices: ['科创50', '中证人工智能'],
    overseasMappings: [
      { code: 'NVDA', name: '英伟达', market: 'us', mappedThemes: ['AI', '算力', '半导体', 'GPU'] },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'industry-new-energy',
    name: '新能源',
    type: 'industry',
    description: '新能源汽车、光伏、储能等清洁能源产业',
    keywords: ['新能源', '光伏', '锂电池', '储能', '风电', '电动汽车', 'NEV', '充电桩', '氢能', '碳中和', '双碳'],
    synonyms: ['清洁能源', '绿色能源', '可再生能源'],
    relatedConcepts: ['有色金属', '汽车', '电力'],
    stocks: [
      { code: '300750', name: '宁德时代', shortName: '宁德', market: 'cn', chainPosition: 'midstream' },
      { code: '002594', name: '比亚迪', shortName: '比亚迪', market: 'cn', chainPosition: 'downstream' },
      { code: '600438', name: '通威股份', market: 'cn', chainPosition: 'upstream' },
    ],
    indices: ['新能源汽车指数', '光伏指数', 'CSI新能源'],
    overseasMappings: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'industry-metals',
    name: '有色金属',
    type: 'industry',
    description: '铜、铝、黄金、锂等有色金属矿业',
    keywords: ['有色金属', '铜', '铝', '黄金', '锂', '钴', '镍', '白银', '稀土', '铅锌'],
    synonyms: ['金属', '矿业', '采矿'],
    relatedConcepts: ['新能源', '半导体'],
    stocks: [
      { code: '601899', name: '紫金矿业', market: 'cn' },
      { code: '600547', name: '山东黄金', market: 'cn' },
      { code: '002460', name: '赣锋锂业', market: 'cn' },
    ],
    indices: ['有色金属指数', '中证有色'],
    overseasMappings: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'industry-semiconductor',
    name: '半导体',
    type: 'industry',
    description: '芯片、集成电路、晶圆制造等半导体产业',
    keywords: ['半导体', '芯片', '集成电路', '晶圆', '光刻机', 'EDA', '封测', '存储芯片', 'CPU', 'GPU', '功率半导体'],
    synonyms: ['IC', '集成电路', '微电子', '芯片设计'],
    relatedConcepts: ['AI科技', '消费电子'],
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
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'industry-pharma',
    name: '医药',
    type: 'industry',
    description: '创新药、生物医药、医疗器械等大健康产业',
    keywords: ['医药', '创新药', '生物医药', '疫苗', '医疗器械', 'CXO', '中药', '基因治疗', '细胞治疗', '仿制药', 'CDMO'],
    synonyms: ['医疗', '生命科学', '大健康', '医疗健康', 'Biotech'],
    relatedConcepts: ['消费', '科技'],
    stocks: [
      { code: '600276', name: '恒瑞医药', market: 'cn' },
      { code: '300015', name: '爱尔眼科', market: 'cn' },
      { code: '603259', name: '药明康德', market: 'cn' },
    ],
    indices: ['医药生物指数', '创新药指数', '中证医疗'],
    overseasMappings: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'industry-bank',
    name: '银行',
    type: 'industry',
    description: '商业银行、国有大行、城商行等金融机构',
    keywords: ['银行', '降准', '降息', 'LPR', '存款', '贷款', '净息差', '不良贷款', '拨备', '国有大行', '城商行'],
    synonyms: ['金融', '商业银行', '银行板块'],
    relatedConcepts: ['房地产', '货币政策'],
    stocks: [
      { code: '601398', name: '工商银行', shortName: '工行', market: 'cn' },
      { code: '601939', name: '建设银行', shortName: '建行', market: 'cn' },
      { code: '600036', name: '招商银行', shortName: '招行', market: 'cn' },
    ],
    indices: ['中证银行指数', '银行ETF'],
    overseasMappings: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'industry-realestate',
    name: '房地产',
    type: 'industry',
    description: '房地产开发、物业管理等产业',
    keywords: ['房地产', '楼市', '房价', '地产', '开发商', '商品房', '保障性住房', '土地出让', '房贷', '限购', '以旧换新'],
    synonyms: ['地产', '房产', '楼盘'],
    relatedConcepts: ['银行', '建材', '家电'],
    stocks: [
      { code: '000002', name: '万科A', shortName: '万科', market: 'cn' },
      { code: '600048', name: '保利发展', market: 'cn' },
      { code: '001979', name: '招商蛇口', market: 'cn' },
    ],
    indices: ['房地产指数', '中证地产'],
    overseasMappings: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export function loadIndustryMappingsMap(): Map<string, IndustryMapping> {
  const map = new Map<string, IndustryMapping>();
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf-8');
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && typeof item === 'object' && 'id' in item && typeof (item as { id: unknown }).id === 'string') {
            map.set((item as IndustryMapping).id, item as IndustryMapping);
          }
        }
        console.log(`[IndustryMappings] Loaded ${map.size} mappings from ${FILE}`);
        return map;
      }
    }
  } catch (err) {
    console.error('[IndustryMappings] Load failed, using defaults:', err);
  }
  for (const m of DEFAULT_MAPPINGS) {
    map.set(m.id, m);
  }
  saveIndustryMappingsMap(map);
  console.log(`[IndustryMappings] Seeded defaults to ${FILE}`);
  return map;
}

export function saveIndustryMappingsMap(map: Map<string, IndustryMapping>): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const arr = Array.from(map.values());
  fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf-8');
}
