#!/usr/bin/env python3
"""
AKShare 金融数据采集脚本
供 Node.js 爬虫调用，输出 JSON 到 stdout
"""
import json
import sys
from datetime import datetime

def fetch_cx_news():
    """财新快讯"""
    import akshare as ak
    try:
        df = ak.stock_news_main_cx()
        items = []
        for _, row in df.iterrows():
            items.append({
                "title": str(row.get("summary", "")),
                "content": str(row.get("summary", "")),
                "url": str(row.get("url", "")),
                "source": "财新",
                "tag": str(row.get("tag", "")),
            })
        return items
    except Exception as e:
        print(f"[akshare] cx news error: {e}", file=sys.stderr)
        return []

def fetch_stock_news(symbol="000001", count=20):
    """个股新闻（默认平安银行，覆盖面广）"""
    import akshare as ak
    try:
        df = ak.stock_news_em(symbol=symbol)
        items = []
        for _, row in df.head(count).iterrows():
            items.append({
                "title": str(row.get("新闻标题", "")),
                "content": str(row.get("新闻内容", ""))[:500],
                "url": str(row.get("新闻链接", "")),
                "source": str(row.get("文章来源", "")),
                "publishedAt": str(row.get("发布时间", "")),
                "keyword": str(row.get("关键词", "")),
            })
        return items
    except Exception as e:
        print(f"[akshare] stock news error: {e}", file=sys.stderr)
        return []

def main():
    result = {
        "fetchedAt": datetime.now().isoformat(),
        "cx_news": fetch_cx_news(),
        "stock_news": [],
    }

    # 采集几个大盘相关股票的新闻
    for symbol in ["000001", "600519", "601318"]:
        items = fetch_stock_news(symbol, count=10)
        result["stock_news"].extend(items)

    # 去重（按标题）
    seen = set()
    unique = []
    for item in result["stock_news"]:
        if item["title"] not in seen:
            seen.add(item["title"])
            unique.append(item)
    result["stock_news"] = unique

    json.dump(result, sys.stdout, ensure_ascii=False)

if __name__ == "__main__":
    main()
