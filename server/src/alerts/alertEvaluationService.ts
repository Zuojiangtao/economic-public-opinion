/**
 * T010 预警计算任务
 * 自动评估预警规则，对接实时温度/声量/情绪数据，生成结构化预警记录。
 *
 * 支持的规则条件：
 *   - sentimentBelow          平均情绪指数阈值
 *   - riskLevelAbove          高风险内容出现
 *   - negativeVolumeRiseAbove 负面声量突增（增长率%）
 *   - keywords                风险词命中
 *   - temperatureAbove        行业温度过热（绝对值）
 *   - temperatureRiseAbove    行业温度快速升温（涨幅绝对分值）
 *   - brokerNegativeRatioAbove 研报观点集中转向（负面比例 0-1）
 */

import type { ContentItem, RiskLevel, Alert, AlertRule } from '../types.js';
import { getHistory, getSnapshotsByGranularity } from '../temperature/temperatureStore.js';

// ============================================================
// 冷却时间管理：避免同一条件在短时间内重复触发
// ============================================================
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 默认 1 小时冷却
const alertCooldowns = new Map<string, number>(); // key -> last triggered timestamp (ms)

function shouldTrigger(key: string, cooldownMs = ALERT_COOLDOWN_MS): boolean {
  const last = alertCooldowns.get(key);
  if (!last) return true;
  return Date.now() - last > cooldownMs;
}

function markTriggered(key: string): void {
  alertCooldowns.set(key, Date.now());
}

/** 清空所有冷却状态（测试用 / 重启后重置） */
export function resetCooldowns(): void {
  alertCooldowns.clear();
}

// ============================================================
// 风险等级比较辅助
// ============================================================
const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

function riskLevelGte(a: RiskLevel, b: RiskLevel): boolean {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b);
}

// ============================================================
// 关键词命中辅助
// ============================================================
function matchesKeyword(item: ContentItem, keywords: string[]): boolean {
  const text = `${item.title} ${item.content}`.toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

// ============================================================
// 生成唯一 alert id（供内存 Map 使用）
// ============================================================
function newAlertId(): string {
  return `alert-eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================
// 主评估入口
// ============================================================

/**
 * 评估所有启用的预警规则，返回需要新建的预警列表。
 *
 * @param rules      当前规则集合
 * @param allItems   存储中的全部内容
 * @returns 触发的新预警列表（调用方负责写入 alerts Map）
 */
export function evaluateAlertRules(
  rules: AlertRule[],
  allItems: ContentItem[],
  existingAlerts?: Alert[],
): Alert[] {
  const generated: Alert[] = [];
  const now = new Date();

  // 构建已有待处理预警的去重 key 集合：ruleId + title
  const existingKeys = new Set<string>();
  if (existingAlerts) {
    for (const a of existingAlerts) {
      if (a.status === 'pending' || a.status === 'processing') {
        existingKeys.add(`${a.ruleId}::${a.title}`);
      }
    }
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const cond = rule.conditions;
    const windowMs = (cond.windowMinutes ?? 120) * 60 * 1000;
    const windowStart = new Date(now.getTime() - windowMs);

    // 时间窗口内的内容
    const recentItems = allItems.filter(
      (item) => new Date(item.publishedAt) >= windowStart,
    );

    // ====== 1. 行业温度过热预警 (temperatureAbove) ======
    if (cond.temperatureAbove !== undefined) {
      const snapshots = getSnapshotsByGranularity('hour');
      const targets = cond.industryIds?.length
        ? snapshots.filter((s) => cond.industryIds!.includes(s.industryId))
        : snapshots;

      for (const snap of targets) {
        if (snap.score > cond.temperatureAbove) {
          const key = `${rule.id}-overheat-${snap.industryId}`;
          if (shouldTrigger(key)) {
            const alertTitle = `${snap.industryName}行业温度过热预警`;
            if (!existingKeys.has(`${rule.id}::${alertTitle}`)) {
              generated.push({
                id: newAlertId(),
                title: alertTitle,
                description: `${snap.industryName}当前温度指数为 ${snap.score}（过热阈值 ${cond.temperatureAbove}），建议重点关注驱动因素`,
                riskLevel: snap.score >= 90 ? 'critical' : 'high',
                status: 'pending',
                ruleName: rule.name,
                ruleId: rule.id,
                triggeredAt: now.toISOString(),
                relatedContentIds: [],
                handleRecords: [],
                triggerMeta: {
                  industryId: snap.industryId,
                  industryName: snap.industryName,
                  currentTemperature: snap.score,
                },
              });
              markTriggered(key);
            }
          }
        }
      }
    }

    // ====== 2. 行业温度快速升温预警 (temperatureRiseAbove) ======
    if (cond.temperatureRiseAbove !== undefined) {
      const snapshots = getSnapshotsByGranularity('hour');
      const targets = cond.industryIds?.length
        ? snapshots.filter((s) => cond.industryIds!.includes(s.industryId))
        : snapshots;

      for (const snap of targets) {
        const history = getHistory(snap.industryId, 'hour', 3);
        if (history.length < 2) continue;
        const prev = history[history.length - 2];
        const curr = history[history.length - 1];
        const rise = curr.score - prev.score;

        if (rise > cond.temperatureRiseAbove) {
          const key = `${rule.id}-rise-${snap.industryId}`;
          if (shouldTrigger(key, 30 * 60 * 1000)) { // 快速升温 30 分钟冷却
            const alertTitle = `${snap.industryName}行业温度快速上升预警`;
            if (!existingKeys.has(`${rule.id}::${alertTitle}`)) {
              generated.push({
                id: newAlertId(),
                title: alertTitle,
                description: `${snap.industryName}温度指数在近期上升了 +${rise} 分（${prev.score} → ${curr.score}），建议及时复核驱动内容`,
                riskLevel: rise >= 20 ? 'critical' : rise >= 10 ? 'high' : 'medium',
                status: 'pending',
                ruleName: rule.name,
                ruleId: rule.id,
                triggeredAt: now.toISOString(),
                relatedContentIds: [],
                handleRecords: [],
                triggerMeta: {
                  industryId: snap.industryId,
                  industryName: snap.industryName,
                  currentTemperature: curr.score,
                  previousTemperature: prev.score,
                  temperatureRise: rise,
                },
              });
              markTriggered(key);
            }
          }
        }
      }
    }

    // ====== 3. 研报观点集中转向预警 (brokerNegativeRatioAbove) ======
    if (cond.brokerNegativeRatioAbove !== undefined) {
      const brokerItems = recentItems.filter((item) => item.sourceType === 'broker');
      if (brokerItems.length >= 3) { // 至少 3 篇研报才有统计意义
        const negCount = brokerItems.filter((i) => i.nlp.sentimentLabel === 'negative').length;
        const ratio = negCount / brokerItems.length;

        if (ratio > cond.brokerNegativeRatioAbove) {
          const key = `${rule.id}-broker-shift`;
          if (shouldTrigger(key)) {
            const negItems = brokerItems.filter((i) => i.nlp.sentimentLabel === 'negative');
            generated.push({
              id: newAlertId(),
              title: '研报观点集中转向负面预警',
              description: `近 ${cond.windowMinutes ?? 120} 分钟内，${brokerItems.length} 篇研报中 ${negCount} 篇（${Math.round(ratio * 100)}%）为负面观点，超过阈值 ${Math.round(cond.brokerNegativeRatioAbove * 100)}%`,
              riskLevel: ratio >= 0.7 ? 'high' : 'medium',
              status: 'pending',
              ruleName: rule.name,
              ruleId: rule.id,
              triggeredAt: now.toISOString(),
              relatedContentIds: negItems.slice(0, 5).map((i) => i.id),
              handleRecords: [],
              triggerMeta: { brokerNegativeRatio: ratio },
            });
            markTriggered(key);
          }
        }
      }
    }

    // ====== 4. 负面声量突增预警 (negativeVolumeRiseAbove) ======
    if (cond.negativeVolumeRiseAbove !== undefined) {
      const halfWindow = windowMs / 2;
      const halfWindowStart = new Date(now.getTime() - halfWindow);
      const prevWindowStart = new Date(now.getTime() - windowMs);

      const sourceFilter = cond.sourceTypes?.length
        ? (item: ContentItem) => (cond.sourceTypes as string[]).includes(item.sourceType)
        : () => true;

      const currNeg = allItems.filter(
        (item) =>
          new Date(item.publishedAt) >= halfWindowStart &&
          item.nlp.sentimentLabel === 'negative' &&
          sourceFilter(item),
      );
      const prevNeg = allItems.filter(
        (item) =>
          new Date(item.publishedAt) >= prevWindowStart &&
          new Date(item.publishedAt) < halfWindowStart &&
          item.nlp.sentimentLabel === 'negative' &&
          sourceFilter(item),
      );

      if (prevNeg.length > 0) {
        const risePercent = ((currNeg.length - prevNeg.length) / prevNeg.length) * 100;
        if (risePercent > cond.negativeVolumeRiseAbove) {
          const key = `${rule.id}-neg-volume`;
          if (shouldTrigger(key, 30 * 60 * 1000)) {
            const alertTitle = '负面舆情声量突增预警';
            if (!existingKeys.has(`${rule.id}::${alertTitle}`)) {
              generated.push({
                id: newAlertId(),
                title: alertTitle,
                description: `近 ${Math.round(halfWindow / 60000)} 分钟内负面内容 ${currNeg.length} 条，较前段增加 ${Math.round(risePercent)}%，超过阈值 ${cond.negativeVolumeRiseAbove}%`,
                riskLevel: risePercent >= 200 ? 'critical' : risePercent >= 100 ? 'high' : 'medium',
                status: 'pending',
                ruleName: rule.name,
                ruleId: rule.id,
                triggeredAt: now.toISOString(),
                relatedContentIds: currNeg.slice(0, 5).map((i) => i.id),
                handleRecords: [],
                triggerMeta: { negativeVolumeCount: currNeg.length },
              });
              markTriggered(key);
            }
          }
        }
      }
    }

    // ====== 5. 情绪阈值预警 (sentimentBelow) ======
    if (cond.sentimentBelow !== undefined) {
      const filtered = cond.sourceTypes?.length
        ? recentItems.filter((i) => (cond.sourceTypes as string[]).includes(i.sourceType))
        : recentItems;

      if (filtered.length >= 5) {
        const avgSentiment = filtered.reduce((s, i) => s + i.nlp.sentiment, 0) / filtered.length;
        if (avgSentiment < cond.sentimentBelow) {
          const key = `${rule.id}-sentiment`;
          if (shouldTrigger(key)) {
            const alertTitle = '市场整体情绪指数偏低预警';
            if (!existingKeys.has(`${rule.id}::${alertTitle}`)) {
              generated.push({
                id: newAlertId(),
                title: alertTitle,
                description: `近 ${cond.windowMinutes ?? 120} 分钟内平均情绪指数为 ${avgSentiment.toFixed(2)}，低于阈值 ${cond.sentimentBelow}`,
                riskLevel: avgSentiment < -0.6 ? 'high' : 'medium',
                status: 'pending',
                ruleName: rule.name,
                ruleId: rule.id,
                triggeredAt: now.toISOString(),
                relatedContentIds: [],
                handleRecords: [],
                triggerMeta: { avgSentiment },
              });
              markTriggered(key);
            }
          }
        }
      }
    }

    // ====== 6. 高风险内容预警 (riskLevelAbove) ======
    if (cond.riskLevelAbove !== undefined) {
      const highRiskItems = recentItems.filter(
        (item) => riskLevelGte(item.nlp.riskLevel, cond.riskLevelAbove!),
      );
      for (const item of highRiskItems.slice(0, 3)) {
        const key = `${rule.id}-risk-${item.id}`;
        if (shouldTrigger(key, 24 * 60 * 60 * 1000)) { // 同一条内容 24 小时内只触发一次
          generated.push({
            id: newAlertId(),
            title: `高风险内容预警：${item.title.slice(0, 30)}`,
            description: `检测到 ${item.nlp.riskLevel} 级别风险内容，标题：${item.title}，来源：${item.sourceName}`,
            riskLevel: item.nlp.riskLevel === 'critical' ? 'critical' : 'high',
            status: 'pending',
            ruleName: rule.name,
            ruleId: rule.id,
            triggeredAt: now.toISOString(),
            relatedContentIds: [item.id],
            handleRecords: [],
          });
          markTriggered(key);
        }
      }
    }

    // ====== 7. 风险词命中预警 (keywords) ======
    if (cond.keywords?.length) {
      const keywordItems = recentItems.filter((item) => matchesKeyword(item, cond.keywords!));
      for (const item of keywordItems.slice(0, 3)) {
        const key = `${rule.id}-keyword-${item.id}`;
        if (shouldTrigger(key, 24 * 60 * 60 * 1000)) {
          generated.push({
            id: newAlertId(),
            title: `风险词命中预警：${item.title.slice(0, 30)}`,
            description: `内容命中风险关键词（${cond.keywords.join('、')}），标题：${item.title}，来源：${item.sourceName}`,
            riskLevel: 'medium',
            status: 'pending',
            ruleName: rule.name,
            ruleId: rule.id,
            triggeredAt: now.toISOString(),
            relatedContentIds: [item.id],
            handleRecords: [],
          });
          markTriggered(key);
        }
      }
    }
  }

  return generated;
}
