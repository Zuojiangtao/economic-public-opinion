import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';
import type { SourceConfig } from '../types.js';

const FILE = path.join(DATA_DIR, 'source-configs.json');

function readFile(): SourceConfig[] {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf-8');
      const parsed = JSON.parse(raw) as { configs?: unknown };
      if (Array.isArray(parsed?.configs)) {
        console.log(`[SourceConfigs] Loaded ${parsed.configs.length} configs from ${FILE}`);
        return parsed.configs as SourceConfig[];
      }
    }
  } catch (err) {
    console.error('[SourceConfigs] Load failed:', err);
  }
  return [];
}

function writeFile(configs: SourceConfig[]): void {
  fs.writeFileSync(FILE, JSON.stringify({ configs }, null, 2), 'utf-8');
}

export function loadSourceConfigs(): SourceConfig[] {
  return readFile();
}

export function saveSourceConfigs(configs: SourceConfig[]): void {
  writeFile(configs);
}

/** 按 sourceName 构建查找 Map（用于温度计算快速匹配） */
export function buildSourceConfigMap(configs: SourceConfig[]): Map<string, SourceConfig> {
  const m = new Map<string, SourceConfig>();
  for (const c of configs) {
    m.set(c.sourceName, c);
  }
  return m;
}

/** 按 sourceType 构建可信度默认分（取同类型所有已启用配置的平均值） */
export function buildSourceTypeCredibility(configs: SourceConfig[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const c of configs) {
    if (!c.includeInTemperature) continue;
    const arr = groups.get(c.sourceType) ?? [];
    arr.push(c.credibilityScore);
    groups.set(c.sourceType, arr);
  }
  const result = new Map<string, number>();
  for (const [type, scores] of groups) {
    result.set(type, Math.round(scores.reduce((s, v) => s + v, 0) / scores.length));
  }
  return result;
}
