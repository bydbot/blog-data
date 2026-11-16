#!/usr/bin/env python3
"""crawl_timeline_rss.py — 时间线事件流的 RSS 兜底抓取。

背景：时间线日历的唯一事件源是 next.bgm.tv/p1 的 timeline feed。
2026-11-10 起 p1 feed 停止同步新事件（主站网页版与 RSS 正常），导致数据冻结。
本脚本作为增量补漏源，从官方页面底部的 RSS 订阅（/feed/user/{uid}/timeline）
抓取最新事件，与 p1 记录按同一 id 空间去重后并入 timeline_YYYY.json：
  - p1 恢复后其富数据记录照常入库，RSS 补漏记录 id 相同不会重复；
  - 合成记录镜像 p1 数据形状，聚合器（aggregate-bgm-timeline.mjs）无需感知来源。

RSS 提供字段有限，按下列映射合成：
  - 里程碑收藏（「看过/玩过/在看…」+ subject 链接，data-subject-id）
      → cat=3 collect，rate/comment 经 v0 收藏详情接口补回；
  - 批量进度（「完成了/看到 X of Y 话」+ subject 链接）
      → cat=4 type=0 batch；
  - 单集进度（描述链接为 /subject/ep/{epid}）
      → cat=4 type=2 single，经 v0 episodes 接口解析所属作品与集号；
  - 吐槽/日志/人物/小组等其它类型：跳过（聚合器本就只消费 cat 3/4）。

作品富化优先级：先从既有 timeline_*.json 内嵌 subject 对象挖掘（免费且字段最全），
缺口再查官方 v0 /v0/subjects/{sid}（匿名可用）。
"""

import json
import os
import re
import time
import random
import argparse
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import unquote

import requests

RSS_URL = "https://bgm.tv/feed/user/{uid}/timeline"
V0_BASE = "https://api.bgm.tv"
USER_AGENT = "bgm-timeline-crawler/1.0 (+rss-backfill)"

# cat=3 收藏动作 → p1 type 码（与 aggregate-bgm-timeline.mjs 的 collectTypes 映射一致）
COLLECT_TYPE = {
    "想读": 1, "想看": 2, "想听": 3, "想玩": 4,
    "读过": 5, "看过": 6, "听过": 7, "玩过": 8,
    "在读": 9, "在看": 10, "在听": 11, "在玩": 12,
    "搁置": 13, "抛弃": 14,
}

RE_GUID = re.compile(r"/timeline/(\d+)$")
RE_SUBJECT_HREF = re.compile(r"bgm\.tv/subject/(\d+)")
RE_EP_HREF = re.compile(r"bgm\.tv/subject/ep/(\d+)")
RE_BATCH_TITLE = re.compile(r"^(完成了|看到) .+? (\d+) of (\d+) 话$")

RETRYABLE = (429, 500, 502, 503, 504)


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


class BgmClient:
    """RSS + v0 接口客户端，带限流与重试。"""

    def __init__(self, user_id, token="", proxy="", rate=30):
        self.user_id = user_id
        self.limiter = RateLimiter(rate)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}

    def get(self, url, retries=3):
        for attempt in range(retries):
            self.limiter.wait()
            try:
                resp = self.session.get(url, timeout=30)
                if resp.status_code == 200:
                    return resp
                if resp.status_code in RETRYABLE:
                    wait = 2.0 * (2 ** attempt) + random.uniform(0, 1)
                    print(f"  [http {resp.status_code}] {url} → {wait:.1f}s 后重试")
                    time.sleep(wait)
                    continue
                print(f"  [http {resp.status_code}] 放弃：{url}")
                return None
            except requests.RequestException as e:
                wait = 2.0 * (2 ** attempt) + random.uniform(0, 1)
                print(f"  [请求失败] {e} → 重试")
                time.sleep(wait)
        return None

    def fetch_rss_items(self):
        resp = self.get(RSS_URL.format(uid=self.user_id))
        if resp is None:
            return []
        try:
            root = ET.fromstring(resp.content)
        except ET.ParseError as e:
            print(f"  [RSS 解析失败] {e}")
            return []
        items = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            desc = item.findtext("description") or ""
            guid = item.findtext("guid") or ""
            pub = item.findtext("pubDate") or ""
            m = RE_GUID.search(guid)
            if not m or not pub:
                continue
            try:
                ts = int(parsedate_to_datetime(pub).timestamp())
            except (ValueError, TypeError):
                continue
            items.append({
                "id": int(m.group(1)),
                "ts": ts,
                "title": title,
                "desc": desc,
            })
        return items

    def fetch_episode(self, epid):
        """v0 单集详情 → (subject_id, sort, name, nameCN)。"""
        resp = self.get(f"{V0_BASE}/v0/episodes/{epid}")
        if resp is None:
            return None
        d = resp.json()
        return {
            "subjectID": d.get("subject_id"),
            "sort": d.get("sort"),
            "name": d.get("name") or "",
            "nameCN": d.get("name_cn") or "",
        }

    def fetch_subject(self, sid):
        """v0 条目详情 → p1 形状的 subject 对象（按需精简字段）。"""
        resp = self.get(f"{V0_BASE}/v0/subjects/{sid}")
        if resp is None:
            return None
        d = resp.json()
        eps_total = d.get("total_episodes") or 0
        return {
            "id": d.get("id"),
            "name": d.get("name") or "",
            "nameCN": d.get("name_cn") or "",
            "type": d.get("type") or 0,
            # p1 的 info 以「N话」开头，聚合器据此解析总话数；v0 无 info 字段则合成
            "info": f"{eps_total}话" if eps_total else "",
            "metaTags": [t.get("name") for t in (d.get("tags") or [])[:5]
                         if t.get("name")],
            "locked": False,
            "nsfw": bool(d.get("nsfw")),
            "images": d.get("images") or {},
        }

    def fetch_collection(self, sid):
        """v0 收藏详情 → (rate, comment)。失败返回 (0, "")。"""
        resp = self.get(f"{V0_BASE}/v0/users/{self.user_id}/collections/{sid}")
        if resp is None:
            return 0, ""
        d = resp.json()
        return d.get("rate") or 0, d.get("comment") or ""


def mine_subjects_from_timeline(output_dir):
    """从既有 timeline 记录挖掘内嵌的完整 subject 对象，按 sid 建缓存。"""
    cache = {}
    for fname in sorted(os.listdir(output_dir)):
        if not (fname.startswith("timeline_") and fname.endswith(".json")):
            continue
        with open(os.path.join(output_dir, fname), encoding="utf-8") as fh:
            for rec in json.load(fh):
                m = rec.get("memo") or {}
                subj = None
                if m.get("progress", {}).get("single"):
                    subj = m["progress"]["single"].get("subject")
                elif m.get("progress", {}).get("batch"):
                    subj = m["progress"]["batch"].get("subject")
                elif m.get("subject"):
                    subj = m["subject"][0].get("subject")
                if subj and subj.get("id") and subj.get("type"):
                    cache[subj["id"]] = subj
    return cache


def existing_ids(output_dir):
    ids = set()
    for fname in os.listdir(output_dir):
        if fname.startswith("timeline_") and fname.endswith(".json"):
            with open(os.path.join(output_dir, fname), encoding="utf-8") as fh:
                for item in json.load(fh):
                    ids.add(item["id"])
    return ids


def save_by_year(data_by_year, output_dir):
    """与 crawl_timeline.py 同款合并：按 id 去重、降序写入。"""
    for year, items in data_by_year.items():
        filepath = os.path.join(output_dir, f"timeline_{year}.json")
        existing = []
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                existing = json.load(f)
        existing_ids_set = {item["id"] for item in existing}
        for item in items:
            if item["id"] not in existing_ids_set:
                existing.append(item)
        existing.sort(key=lambda x: x["id"], reverse=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        print(f"  已写入 {len(existing)} 条到 {filepath}")


def classify(item):
    """把一条 RSS item 解析为事件草稿，返回 None 表示跳过。"""
    desc = item["desc"]
    ep_m = RE_EP_HREF.search(desc)
    if ep_m:
        # 单集进度：链接指向 /subject/ep/{id}
        return {"kind": "single", "epid": int(ep_m.group(1))}

    sub_m = RE_SUBJECT_HREF.search(desc)
    if sub_m:
        sid = int(sub_m.group(1))
        batch_m = RE_BATCH_TITLE.match(item["title"])
        if batch_m:
            return {"kind": "batch", "sid": sid,
                    "eps_update": int(batch_m.group(2)),
                    "eps_total": int(batch_m.group(3))}
        action = item["title"].split(" ", 1)[0]
        if action in COLLECT_TYPE:
            return {"kind": "collect", "sid": sid,
                    "action": action, "type": COLLECT_TYPE[action]}
    return None


def main():
    parser = argparse.ArgumentParser(description="RSS 兜底抓取时间线事件")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--token", default="")
    parser.add_argument("--proxy", default="")
    parser.add_argument("--rate", type=float, default=30)
    parser.add_argument("--output-dir", default="data")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    known = existing_ids(args.output_dir)
    print(f"[rss-backfill] 已有记录 id 数: {len(known)}")

    client = BgmClient(args.user_id, args.token, args.proxy, args.rate)
    items = client.fetch_rss_items()
    print(f"[rss-backfill] RSS 拉到 {len(items)} 条事件")

    fresh = [it for it in items if it["id"] not in known]
    if not fresh:
        print("[rss-backfill] 无新增事件")
        return

    # 按时间正序处理，方便限流下逐条补齐
    fresh.sort(key=lambda x: x["ts"])
    subject_cache = mine_subjects_from_timeline(args.output_dir)
    print(f"[rss-backfill] 从既有记录挖掘 subject 缓存 {len(subject_cache)} 个")

    data_by_year = {}
    added = 0
    for it in fresh:
        ev = classify(it)
        if ev is None:
            print(f"  跳过（非条目事件）id={it['id']} title={it['title'][:40]!r}")
            continue

        base = {
            "id": it["id"],
            "uid": int(args.user_id),
            "batch": False,
            "replies": 0,
            "createdAt": it["ts"],
            "source": {"name": "rss-backfill"},
        }

        if ev["kind"] == "single":
            ep_info = client.fetch_episode(ev["epid"])
            if not ep_info or not ep_info.get("subjectID"):
                print(f"  跳过（单集解析失败）id={it['id']}")
                continue
            sid = ep_info["subjectID"]
            subject = subject_cache.get(sid) or client.fetch_subject(sid)
            if not subject:
                print(f"  跳过（作品富化失败）id={it['id']} sid={sid}")
                continue
            subject_cache[sid] = subject
            rec = {**base, "cat": 4, "type": 2,
                   "memo": {"progress": {"single": {
                       "subject": subject,
                       "episode": {
                           "id": ev["epid"],
                           "subjectID": sid,
                           "sort": ep_info["sort"],
                           "name": ep_info["name"],
                           "nameCN": ep_info["nameCN"],
                       },
                   }}}}

        elif ev["kind"] == "batch":
            subject = subject_cache.get(ev["sid"]) or client.fetch_subject(ev["sid"])
            if not subject:
                print(f"  跳过（作品富化失败）id={it['id']} sid={ev['sid']}")
                continue
            subject_cache[ev["sid"]] = subject
            rec = {**base, "cat": 4, "type": 0,
                   "memo": {"progress": {"batch": {
                       "subject": subject,
                       "epsUpdate": ev["eps_update"],
                       "epsTotal": str(ev["eps_total"]),
                       "volsUpdate": 0,
                       "volsTotal": "??",
                   }}}}

        else:  # collect
            subject = subject_cache.get(ev["sid"]) or client.fetch_subject(ev["sid"])
            if not subject:
                print(f"  跳过（作品富化失败）id={it['id']} sid={ev['sid']}")
                continue
            subject_cache[ev["sid"]] = subject
            rate, comment = client.fetch_collection(ev["sid"])
            rec = {**base, "cat": 3, "type": ev["type"],
                   "memo": {"subject": [{
                       "subject": subject,
                       "rate": rate,
                       "comment": comment,
                   }]}}

        year = datetime.fromtimestamp(it["ts"]).year
        data_by_year.setdefault(year, []).append(rec)
        added += 1

    if data_by_year:
        save_by_year(data_by_year, args.output_dir)
    print(f"[rss-backfill] 完成：新增 {added} 条事件")


if __name__ == "__main__":
    main()
