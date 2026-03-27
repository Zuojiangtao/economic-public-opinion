import type { LexiconEntry } from '../../api/types';
import lexiconsJson from '@data/lexicons.json';

/** 与根目录 `data/lexicons.json` 保持一致（MSW 初始数据） */
export const mockLexicons: LexiconEntry[] = lexiconsJson as LexiconEntry[];
