# 项目指南

## 项目概览

本仓库是一个金融舆情监测 POC。前端应用位于 `web/`，使用 React/Vite；爬虫与 API 后端位于 `server/`，使用 Express/TypeScript；共享 API 契约位于 `openapi/openapi.yaml`；SQLite 数据库及运行期数据位于 `data/`。

改动应与 `task.md` 和 `plan.md` 中的产品方向保持一致：行业/板块映射、板块温度评分、监测方案、数据源权重、内容去重，以及可解释的市场情绪信号。

## 架构

- `web/` 是前端：React 19、TypeScript、Ant Design、React Router、TanStack Query、ECharts，并带有 MSW 降级 Mock 数据。
- `server/` 是后端：Node.js ESM、Express 5、TypeScript、爬虫适配器、NLP 服务、SQLite 存储、去重服务和温度计算服务。
- `data/` 存放 SQLite 数据库（`sentiment.db`）及配置数据。将这些文件视为应用数据，只有在任务确实需要调整种子数据或配置时才修改。
- `openapi/openapi.yaml` 是前后端共享的 API 契约。新增或修改公开 API 路由时，需要同步更新契约、前端类型和 API 客户端代码。
- 前端 API 调用统一走 `/api/v1`；Vite 会将该路径代理到后端 `3001` 端口。

## 命令

在对应子项目目录下执行命令。优先使用 `pnpm`，因为 `web/` 和 `server/` 都包含 `pnpm-lock.yaml`。

```bash
cd server
pnpm install
pnpm dev
pnpm crawl
```

```bash
cd web
pnpm install
pnpm dev
pnpm build
pnpm lint
```

根目录没有统一的 package 脚本。前端和后端命令需要分别执行。

## 后端约定

- 保持 TypeScript strict，并兼容 ESM。`server/src/` 下的相对导入需要显式使用 `.js` 扩展名。
- 保持现有服务边界：爬虫适配器放在 `server/src/crawlers/`，路由集中在 `server/src/api/routes.ts`，存储工具放在 `server/src/storage/`，NLP 放在 `server/src/nlp/`，去重逻辑放在 `server/src/dedup/`，温度计算放在 `server/src/temperature/`。
- 新增爬虫应沿用现有爬虫模式，并在入库前将结果归一化为共享内容类型。
- API 响应需要与 `server/src/types.ts` 以及 `web/src/api/types.ts` 中的类型保持一致。
- 在明确要求进行数据库迁移之前，不要引入生产数据库假设。

## 前端约定

- 遵循现有 Ant Design 布局和组件风格。本系统是运营型看板，应优先采用信息密度高、便于扫读、面向工作的界面，而不是营销式页面。
- 使用 React Query 管理服务端状态，API 访问逻辑保持在 `web/src/api/client.ts`。
- 前端源码导入使用 `@/` 别名；只有在明确需要消费共享 JSON 数据时才使用 `@data/`。
- 页面放在 `web/src/pages/<feature>/index.tsx`；可复用 UI 放在 `web/src/components/`；共享页面骨架放在 `web/src/layouts/`。
- 后端行为变化时，需要让 MSW mock handler 和 mock 数据保持足够一致，确保纯前端开发模式仍可用。

## 数据与领域规则

- 金融情绪输出应保持可解释：在相关场景中包含分项得分、来源权重、风险等级和关键驱动内容。
- 不要把词典式情绪分析视为确定性的投资建议。本应用是分析辅助工具和 POC，不是交易推荐引擎。
- 遵守爬虫合规约束。可用时优先使用官方或授权 API，不要将凭证、Cookie 或 Token 写入仓库。
- 修改数据源权重、温度公式、行业映射或监测规则时，在可行情况下保持示例数据向后兼容。

## 验证

- 前端变更在可行时于 `web/` 下运行 `pnpm lint` 和 `pnpm build`。
- 后端变更可运行 `pnpm dev` 做运行时检查；涉及爬虫行为时运行 `pnpm crawl`。如果需要新增 TypeScript 检查脚本，应将其限定在 `server/package.json` 内。
- 如果因为依赖缺失或外部服务不可用而无法运行命令，需要清楚说明受影响的范围。