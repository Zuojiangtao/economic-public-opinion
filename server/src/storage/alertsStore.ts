/**
 * T008 预警记录 & 预警规则持久化存储 — SQLite 实现
 */

import { getDb } from './db.js';
import type { Alert, AlertRule, AlertStatus } from '../types.js';

// ── Alert rows ───────────────────────────────────────────────────────────────

interface AlertRow {
  id: string;
  title: string;
  description: string;
  risk_level: string;
  status: string;
  rule_name: string;
  rule_id: string | null;
  triggered_at: string;
  related_content_ids_json: string;
  handle_records_json: string;
  trigger_meta_json: string | null;
}

function rowToAlert(row: AlertRow): Alert {
  return {
    id:                row.id,
    title:             row.title,
    description:       row.description,
    riskLevel:         row.risk_level as Alert['riskLevel'],
    status:            row.status as AlertStatus,
    ruleName:          row.rule_name,
    ruleId:            row.rule_id ?? undefined,
    triggeredAt:       row.triggered_at,
    relatedContentIds: JSON.parse(row.related_content_ids_json),
    handleRecords:     JSON.parse(row.handle_records_json),
    triggerMeta:       row.trigger_meta_json ? JSON.parse(row.trigger_meta_json) : undefined,
  };
}

export function loadAlertsMap(): Map<string, Alert> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM alerts ORDER BY triggered_at DESC').all() as AlertRow[];
  const map = new Map<string, Alert>();
  for (const r of rows) map.set(r.id, rowToAlert(r));
  console.log(`[Alerts] Loaded ${map.size} alerts from SQLite`);
  return map;
}

export function saveAlert(alert: Alert): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO alerts
      (id, title, description, risk_level, status, rule_name, rule_id,
       triggered_at, related_content_ids_json, handle_records_json, trigger_meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.id, alert.title, alert.description,
    alert.riskLevel, alert.status, alert.ruleName,
    alert.ruleId ?? null, alert.triggeredAt,
    JSON.stringify(alert.relatedContentIds ?? []),
    JSON.stringify(alert.handleRecords ?? []),
    alert.triggerMeta ? JSON.stringify(alert.triggerMeta) : null,
  );
}

// ── AlertRule rows ────────────────────────────────────────────────────────────

interface AlertRuleRow {
  id: string;
  name: string;
  description: string;
  enabled: number;
  conditions_json: string;
  created_at: string;
  updated_at: string | null;
}

function rowToRule(row: AlertRuleRow): AlertRule {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    enabled:     row.enabled === 1,
    conditions:  JSON.parse(row.conditions_json),
    createdAt:   row.created_at,
    updatedAt:   row.updated_at ?? undefined,
  };
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'rule-001', name: '负面声量突增预警',
    description: '当负面内容数量在2小时内增长超过100%时触发', enabled: true,
    conditions: { negativeVolumeRiseAbove: 100, sourceTypes: ['news', 'forums', 'social'], windowMinutes: 120 },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-002', name: '情绪阈值预警',
    description: '当监测内容平均情绪指数低于设定阈值时触发', enabled: true,
    conditions: { sentimentBelow: -0.5, windowMinutes: 120 },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-003', name: '高风险内容预警',
    description: '当出现高风险或极高风险级别内容时立即触发', enabled: true,
    conditions: { riskLevelAbove: 'high', windowMinutes: 60 },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-004', name: '行业过热预警',
    description: '当任一行业温度超过85分时触发', enabled: true,
    conditions: { temperatureAbove: 85, windowMinutes: 60 },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-005', name: '行业快速升温预警',
    description: '当行业温度在1小时内上升超过20分时触发', enabled: true,
    conditions: { temperatureRiseAbove: 20, windowMinutes: 60 },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-006', name: '研报观点集中转向预警',
    description: '当券商研报负面比例超过60%时触发', enabled: true,
    conditions: { brokerNegativeRatioAbove: 0.6, windowMinutes: 480 },
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export function loadAlertRules(): AlertRule[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM alert_rules ORDER BY created_at ASC').all() as AlertRuleRow[];
  if (rows.length > 0) {
    console.log(`[AlertRules] Loaded ${rows.length} rules from SQLite`);
    return rows.map(rowToRule);
  }
  // Seed defaults
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO alert_rules
      (id, name, description, enabled, conditions_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = db.transaction(() => {
    for (const r of DEFAULT_RULES) {
      stmt.run(r.id, r.name, r.description, r.enabled ? 1 : 0,
        JSON.stringify(r.conditions), r.createdAt, r.updatedAt ?? null);
    }
  });
  seed();
  console.log(`[AlertRules] Seeded ${DEFAULT_RULES.length} default rules to SQLite`);
  return DEFAULT_RULES;
}

export function saveAlertRule(rule: AlertRule): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO alert_rules
      (id, name, description, enabled, conditions_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    rule.id, rule.name, rule.description,
    rule.enabled ? 1 : 0,
    JSON.stringify(rule.conditions),
    rule.createdAt, rule.updatedAt ?? null,
  );
}

export function deleteAlertRule(id: string): void {
  getDb().prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
}
