// T008: migrated to SQLite
import { getDb } from './db.js';

/** 与 data/lexicons.json 初始内容一致，仅在数据库为空时种子写入 */
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

export function loadLexicons(): unknown[] {
  const db = getDb();
  const rows = db.prepare('SELECT data_json FROM lexicons').all() as { data_json: string }[];
  if (rows.length > 0) {
    const result = rows.map((r) => JSON.parse(r.data_json));
    console.log(`[Lexicons] Loaded ${result.length} entries from SQLite`);
    return result;
  }
  const copy = JSON.parse(JSON.stringify(DEFAULT_LEXICONS)) as Array<{ id: string }>;
  const stmt = db.prepare('INSERT OR IGNORE INTO lexicons (id, data_json) VALUES (?, ?)');
  const seed = db.transaction(() => {
    for (const item of copy) stmt.run(item.id, JSON.stringify(item));
  });
  seed();
  console.log(`[Lexicons] Seeded ${copy.length} defaults to SQLite`);
  return copy;
}

export function saveLexicons(lexicons: unknown[]): void {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO lexicons (id, data_json) VALUES (?, ?)');
  const save = db.transaction(() => {
    for (const item of lexicons as Array<{ id: string }>) {
      upsert.run(item.id, JSON.stringify(item));
    }
  });
  save();
}
