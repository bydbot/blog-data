#!/usr/bin/env python3
import json
import os
import time
import random
import argparse
from datetime import datetime
from collections import defaultdict

import requests

BASE_URL = "https://next.bgm.tv"
USER_AGENT = "bgm-timeline-crawler/1.0"


class RateLimiter:
    def __init__(self, requests_per_minute=30):
        self.interval = 60.0 / requests_per_minute
        self.last_request_time = 0.0

    def wait(self):
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.interval:
            time.sleep(self.interval - elapsed + random.uniform(0, 0.5))
        self.last_request_time = time.time()


def fetch_timeline(session, user_id, limiter, limit=20, until_id=None):
    url = f"{BASE_URL}/p1/users/{user_id}/timeline"
    params = {"limit": limit}
    if until_id is not None:
        params["until"] = until_id

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
                return []
        except requests.RequestException as e:
            wait = backoff * (2 ** retries) + random.uniform(0, 1)
            print(f"Request error: {e}, retrying in {wait:.1f}s...")
            time.sleep(wait)
            retries += 1

    print(f"Max retries exceeded for until_id={until_id}")
    return []


def save_by_year(data_by_year, output_dir):
    for year, items in data_by_year.items():
        filepath = os.path.join(output_dir, f"timeline_{year}.json")
        existing = []
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                existing = json.load(f)

        existing_ids = {item["id"] for item in existing}
        for item in items:
            if item["id"] not in existing_ids:
                existing.append(item)

        existing.sort(key=lambda x: x["id"], reverse=True)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        print(f"Saved {len(existing)} items to {filepath}")


def load_state(state_path):
    if os.path.exists(state_path):
        with open(state_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"last_until_id": None, "total_fetched": 0}


def save_state(state_path, state):
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Crawl Bangumi user timeline")
    parser.add_argument("--user-id", required=True, help="User ID (number)")
    parser.add_argument("--token", default="", help="Bearer token (empty = anonymous)")
    parser.add_argument("--proxy", default="", help="HTTP proxy (empty = direct)")
    parser.add_argument("--rate", type=float, default=30, help="Requests per minute")
    parser.add_argument("--limit", type=int, default=20, help="Items per page (max 20)")
    parser.add_argument("--output-dir", default="data", help="Output directory")
    parser.add_argument("--max-pages", type=int, default=0,
                        help="Max pages to crawl (0 = unlimited)")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    state_path = os.path.join(args.output_dir, "state.json")
    state = load_state(state_path)

    # 加载已有记录 id（增量去重基础：从最新开始爬，遇到已存在的 id 即停）
    existing_ids = set()
    for fname in os.listdir(args.output_dir):
        if fname.startswith("timeline_") and fname.endswith(".json"):
            with open(os.path.join(args.output_dir, fname), encoding="utf-8") as fh:
                for item in json.load(fh):
                    existing_ids.add(item["id"])
    print(f"已有记录数: {len(existing_ids)}")

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
    })
    if args.token:
        session.headers.update({"Authorization": f"Bearer {args.token}"})
    if args.proxy:
        session.proxies = {"http": args.proxy, "https": args.proxy}

    limiter = RateLimiter(requests_per_minute=args.rate)

    # 注意：新记录 id 更大，增量必须从最新（无 until）开始爬；
    # 旧版用 last_until_id 往旧爬会永远漏掉新增记录（bug 已修复）
    until_id = None
    total_fetched = state.get("total_fetched", 0)
    new_count = 0
    page = 0
    data_by_year = defaultdict(list)

    print(f"Starting crawl for user {args.user_id}")
    print(f"Rate limit: {args.rate} req/min")
    print("Starting from newest (incremental by id dedup)")

    while True:
        if args.max_pages and page >= args.max_pages:
            print(f"Reached max pages ({args.max_pages})")
            break

        page += 1
        items = fetch_timeline(session, args.user_id, limiter,
                               limit=args.limit, until_id=until_id)

        if not items:
            print("No more items or error, stopping")
            break

        # 只保留新增记录（按 id 去重）；整页全是已存在的记录说明到底了
        fresh = [x for x in items if x["id"] not in existing_ids]
        if not fresh:
            print("All items already exist, stopping")
            break

        for item in fresh:
            existing_ids.add(item["id"])
            year = datetime.fromtimestamp(item["createdAt"]).year
            data_by_year[year].append(item)

        new_count += len(fresh)
        last_item = items[-1]
        until_id = last_item["id"]
        last_date = datetime.fromtimestamp(last_item["createdAt"]).strftime("%Y-%m-%d")

        print(f"Page {page}: got {len(items)} items ({len(fresh)} new), "
              f"total_new={new_count}, "
              f"last_id={until_id}, "
              f"last_date={last_date}")

        if page % 10 == 0:
            save_by_year(data_by_year, args.output_dir)
            data_by_year.clear()
            state["last_until_id"] = until_id
            state["total_fetched"] = total_fetched
            save_state(state_path, state)

        if len(items) < args.limit:
            print("Reached end of timeline")
            break

    if data_by_year:
        save_by_year(data_by_year, args.output_dir)

    if until_id is not None:
        state["last_until_id"] = until_id
    state["total_fetched"] = total_fetched + new_count
    save_state(state_path, state)

    print(f"\nDone! New items fetched: {new_count}, cumulative: {state['total_fetched']}")


if __name__ == "__main__":
    main()
