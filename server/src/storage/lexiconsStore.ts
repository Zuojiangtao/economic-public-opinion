import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';

const FILE = path.join(DATA_DIR, 'lexicons.json');

/** 与 data/lexicons.json 初始内容一致，仅在文件缺失或损坏时用于种子写入 */
const DEFAULT_LEXICONS: unknown[] = [
  { id: 'lex-001', word: '比亚迪', category: 'brand', synonyms: ['BYD'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-002', word: '宁德时代', category: 'brand', synonyms: ['CATL'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-003', word: '贵州茅台', category: 'brand', synonyms: ['茅台'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-004', word: '中信证券', category: 'brand', synonyms: [], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-005', word: '特斯拉', category: 'competitor', synonyms: ['Tesla'], createdAt: '2026-01-15T00:00:00Z' },
  { id: 'lex-006', word: '三星', category: 'competitor', synonyms: ['Samsung'], createdAt: '2026-01-15T00:00:00Z' },
  { id: 'lex-007', word: '暴雷', category: 'risk', synonyms: ['爆雷'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-008', word: '违约', category: 'risk', synonyms: ['债务违约', '信用违约'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-009', word: '跑路', category: 'risk', synonyms: ['卷款', '失联'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-010', word: '崩盘', category: 'risk', synonyms: ['暴跌', '崩溃'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-011', word: '做空', category: 'risk', synonyms: ['空头', '沽空'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-012', word: '利好', category: 'synonym', synonyms: ['利多', '正面', '积极'], createdAt: '2026-02-01T00:00:00Z' },
  { id: 'lex-013', word: '利空', category: 'synonym', synonyms: ['利淡', '负面', '消极'], createdAt: '2026-02-01T00:00:00Z' },
  { id: 'lex-014', word: '广告', category: 'stop', synonyms: ['推广', '软文'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lex-015', word: '招聘', category: 'stop', synonyms: ['求职', '应聘'], createdAt: '2026-01-01T00:00:00Z' },
];

export function loadLexicons(): any[] {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf-8');
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        console.log(`[Lexicons] Loaded ${arr.length} entries from ${FILE}`);
        return arr as any[];
      }
    }
  } catch (err) {
    console.error('[Lexicons] Load failed, using defaults:', err);
  }
  const copy = JSON.parse(JSON.stringify(DEFAULT_LEXICONS)) as any[];
  saveLexicons(copy);
  console.log(`[Lexicons] Seeded defaults to ${FILE}`);
  return copy;
}

export function saveLexicons(lexicons: any[]): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(FILE, JSON.stringify(lexicons, null, 2), 'utf-8');
}
