import type { MonitoringProject } from '../../api/types';
import monitoringProjectsJson from '@data/monitoring-projects.json';

/** 与根目录 `data/monitoring-projects.json` 保持一致（MSW 初始数据） */
export const mockMonitoringProjects: MonitoringProject[] =
  monitoringProjectsJson as MonitoringProject[];
