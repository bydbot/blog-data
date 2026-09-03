#!/usr/bin/env python3
"""
爬取 Bangumi 用户动画收藏（想看/看过/在看）
输出：data/collections.json
"""
import json
import os
import time
import random
import argparse
from datetime import datetime

import requests

BASE_URL = "https://api.bgm.tv"
USER_AGENT = "bgm-timeline-crawler/1.0"


class RateLimiter:
    def __init__(self, requests_per_minute=30):
        self.interval = 60.0 / requests_per_minute
        self.last_request_time = 0.0

    def wait(self):
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.interval:
            time.sleep(self.interval - elapsed + random.uniform(0, 0.3))
        self.last_request_time = time.time()


def fetch_collections(session, user_id, limiter, subject_type=2, collection_type=None, limit=50, offset=0):
    """
    获取用户收藏列表
    
    Args:
        subject_type: 条目类型 (2=动画)
        collection_type: 收藏类型 (1=想看, 2=看过, 3=在看, 4=搁置, 5=抛弃)
        limit: 每页数量 (最大50)
        offset: 偏移量
    """
    url = f"{BASE_URL}/v0/users/{user_id}/collections"
    params = {
        "subject_type": subject_type,
        "limit": limit,
        "offset": offset,
    }
    if collection_type is not None:
        params["type"] = collection_type

    retries = 0
    max_retries = 5
    backoff = 2.0

    while retries < max_retries:
        limiter.wait()
        try:
            resp = session.get(url, params=params, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                if retry_after:
                    wait = float(retry_after)
                else:
                    wait = backoff * (2 ** retries) + random.uniform(0, 1)
                print(f"Rate limited (429), waiting {wait:.1f}s...")
                time.sleep(wait)
                retries += 1
            elif resp.status_code >= 500:
                wait = backoff * (2 ** retries) + random.uniform(0, 1)
                print(f"Server error {resp.status_code}, retrying in {wait:.1f}s...")
                time.sleep(wait)
                retries += 1
            else:
                print(f"Unexpected status {resp.status_code}: {resp.text}")
                return None
        except requests.RequestException as e:
            wait = backoff * (2 ** retries) + random.uniform(0, 1)
            print(f"Request error: {e}, retrying in {wait:.1f}s...")
            time.sleep(wait)
            retries += 1

    print(f"Max retries exceeded for offset={offset}")
    return None


def extract_collection(item):
    """
    从 API 返回中提取精简的收藏数据
    """
    subject = item.get("subject", {})
    images = subject.get("images", {})
    
    return {
        "sid": item["subject_id"],
        "name": subject.get("name", ""),
        "name_cn": subject.get("name_cn", ""),
        "img": images.get("grid", "") or images.get("small", ""),
        "type": item["type"],  # 1=想看, 2=看过, 3=在看
        "rate": item.get("rate", 0),
        "ep_status": item.get("ep_status", 0),
        "eps": subject.get("eps", 0),
        "comment": item.get("comment") or "",
        "updated_at": item.get("updated_at", ""),
    }


def load_existing_collections(output_dir):
    """加载已有收藏数据，建立 sid -> updated_at 索引"""
    output_path = os.path.join(output_dir, "collections.json")
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def merge_collections(existing, new_items):
    """
    合并收藏数据：
    - 新 sid 直接加入
    - 已有 sid 但 updated_at 更新则替换
    - 已有 sid 且 updated_at 不变则跳过
    """
    existing_map = {c["sid"]: c for c in existing}
    changed = 0
    added = 0

    for item in new_items:
        sid = item["sid"]
        if sid not in existing_map:
            existing.append(item)
            added += 1
        elif item["updated_at"] > existing_map[sid]["updated_at"]:
            # 替换已有记录
            idx = next(i for i, c in enumerate(existing) if c["sid"] == sid)
            existing[idx] = item
            changed += 1

    existing.sort(key=lambda x: x["updated_at"], reverse=True)
    return added, changed


def crawl_user_collections(user_id, proxy, rate, output_dir, types_to_crawl=(1, 2, 3)):
    """
    增量爬取用户收藏
    
    API 返回按 updated_at 降序排列，所以逐页爬取时
    一旦遇到 updated_at 没变过的条目就可以停止。
    """
    os.makedirs(output_dir, exist_ok=True)
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
    })
    if proxy:
        session.proxies = {"http": proxy, "https": proxy}
    
    limiter = RateLimiter(requests_per_minute=rate)
    
    # 加载已有数据
    existing = load_existing_collections(output_dir)
    # 建立 sid -> updated_at 快照（用于增量判断）
    existing_map = {c["sid"]: c["updated_at"] for c in existing}
    print(f"已有收藏数据：{len(existing)} 条")
    
    type_names = {1: "想看", 2: "看过", 3: "在看"}
    
    all_new_items = []
    total_api_calls = 0
    
    for ctype in types_to_crawl:
        print(f"\n=== 开始爬取：{type_names[ctype]} (type={ctype}) ===")
        offset = 0
        limit = 50
        total_this_type = 0
        reached_unchanged = False
        
        while not reached_unchanged:
            data = fetch_collections(
                session, user_id, limiter,
                subject_type=2,
                collection_type=ctype,
                limit=limit,
                offset=offset,
            )
            total_api_calls += 1
            
            if not data or not data.get("data"):
                break
            
            items = data["data"]
            total = data.get("total", 0)
            new_count = 0
            
            for item in items:
                sid = item["subject_id"]
                item_updated = item.get("updated_at", "")
                
                # 增量判断：如果这个 sid 已存在且 updated_at 没变，说明后面都是旧的
                if sid in existing_map and existing_map[sid] == item_updated:
                    reached_unchanged = True
                    break
                
                collection = extract_collection(item)
                all_new_items.append(collection)
                existing_map[sid] = item_updated  # 更新快照
                new_count += 1
                total_this_type += 1
            
            print(f"  offset={offset}: 获取 {len(items)} 条，新增 {new_count} 条，"
                  f"累计新增 {total_this_type} 条 "
                  f"({'停止' if reached_unchanged else '继续'})")
            
            if reached_unchanged:
                break
            
            offset += limit
            if offset >= total:
                break
    
    print(f"\n总 API 请求次数：{total_api_calls}")
    print(f"新增/变更条目：{len(all_new_items)} 条")
    
    if not all_new_items:
        print("无变更，跳过写入")
        return
    
    # 合并到已有数据
    added, changed = merge_collections(existing, all_new_items)
    
    # 保存
    output_path = os.path.join(output_dir, "collections.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== 完成 ===")
    print(f"新增 {added} 条，更新 {changed} 条，总计 {len(existing)} 条")
    print(f"输出文件：{output_path}")
    
    # 统计
    stats = {
        "想看": len([c for c in existing if c["type"] == 1]),
        "看过": len([c for c in existing if c["type"] == 2]),
        "在看": len([c for c in existing if c["type"] == 3]),
    }
    print(f"统计：{stats}")


def main():
    parser = argparse.ArgumentParser(description="Crawl Bangumi user collections")
    parser.add_argument("--user-id", type=int, required=True, help="User ID (number)")
    parser.add_argument("--proxy", default="", help="HTTP proxy (empty = direct)")
    parser.add_argument("--rate", type=float, default=30, help="Requests per minute")
    parser.add_argument("--output-dir", default="data", help="Output directory")
    parser.add_argument("--types", default="1,2,3",
                        help="Collection types to crawl (1=想看,2=看过,3=在看)")
    args = parser.parse_args()
    
    types_to_crawl = [int(t.strip()) for t in args.types.split(",")]
    
    crawl_user_collections(
        user_id=args.user_id,
        proxy=args.proxy,
        rate=args.rate,
        output_dir=args.output_dir,
        types_to_crawl=types_to_crawl,
    )


if __name__ == "__main__":
    main()
