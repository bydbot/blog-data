# Bangumi 追番数据爬取 & 博客集成

数据流水线跑在 GitHub Actions（`.github/workflows/update.yml`，每天北京时间 02:00），
产物直传 R2 桶 `blog-bgm`，站点运行时经 Pages Functions 读取。**仓库里不存数据**。

## 文件说明

| 文件 | 作用 |
|---|---|
| `scripts/update-bgm.sh` | 一键流水线：抓时间线 → RSS 补漏 → 抓收藏 → 富化 → 聚合 |
| `scripts/state-r2.sh` | 爬取状态在 R2 的存取（`pull` / `push` / `verify`）|
| `scripts/crawl_timeline.py` | 爬看番时间线（增量：按 id 去重，最新的往下爬）|
| `scripts/crawl_timeline_rss.py` | RSS 事件流补漏（p1 feed 停更时的兜底源）|
| `scripts/crawl_collections.py` | 爬追番收藏（增量：遇到 `updated_at` 未变即停）|
| `scripts/update-bangumi.mjs` | 富化收藏 → `bangumi-data.json` + 追番页精简版 |
| `scripts/aggregate-bgm-timeline.mjs` | 聚合成日历索引 + 三源分页 |

## 状态存放：R2，不入 git

增量爬取要读上一轮的原始记录才能接着爬，这份状态曾是每日 `chore: auto update`
提交的内容。现在整包存 R2 单对象：

```
blog-bgm/state/current.tar.gz     当前状态（唯一权威副本）
blog-bgm/state/previous.tar.gz    上一版，pull 时自动滚动，供回滚
```

包内容：`crawl/data/`、`crawl/state/`、`data/bangumi-data.json`，压缩后约 3.3MB。

```bash
# CI 里由 workflow 自动执行；本机手动跑流水线时先 pull、跑完 push
bash crawl/scripts/state-r2.sh pull
bash crawl/scripts/update-bgm.sh
bash crawl/scripts/state-r2.sh push
```

本机没有 aws CLI 时脚本自动回落 `npx wrangler r2 object ... --remote`（需先 `wrangler login`）。

### 为什么这么做

站点读的是 R2 里的聚合产物（`bgm-anime.json` / `bgm-timeline*`），构建完全不碰这份状态。
所以每日提交除了留存增量记忆外没有任何作用，却让仓库持续增长、提交历史被自动提交淹没。

### 护栏

- `pull` 先校验 gzip 完整性，再滚动备份到 `previous.tar.gz`，然后才解包
- `push` 拒绝不完整状态：缺目录、时间线记录 < 100 条、基线不是合法 JSON 数组，都会直接失败
- 拉不到状态就中止 job，不会冷启动覆盖云端（确需冷启动置 `BGM_STATE_ALLOW_COLD_START=1`）
- 状态回写失败只影响明天的新鲜度：抓取按 id / `updated_at` 去重，重跑幂等

### 回滚

```bash
# 把上一版状态放回工作区
#   （state-r2.sh 目前只拉 current；回滚时手动取 previous）
npx wrangler r2 object get blog-bgm/state/previous.tar.gz --file /tmp/prev.tar.gz --remote
tar -xzf /tmp/prev.tar.gz -C .
bash crawl/scripts/state-r2.sh verify
bash crawl/scripts/state-r2.sh push   # 需要时把它提升为 current
```

### 状态彻底丢失怎么办

时间线可在本机全量重爬（注释掉 `update-bgm.sh` 里的 `--max-pages 5`，约 13 分钟），
收藏与富化会重新拉取全量条目。已有 R2 产物不受影响，重爬只是重建增量基线。

## 增量原理

**时间线** — 从最新一页往回爬，整页 id 都已存在即停；`--max-pages 5` 限制单次耗时。
**收藏** — API 按 `updated_at` 降序，遇到快照里未变的条目即停，无变更时仅 3 次请求。
**富化** — `crawl/state/.bangumi-state.json` 存 `sid → updated_at`，未变则复用旧条目，不查详情。

## 依赖

- Python 3.11 + `requests`（`update-bgm.sh` 会自动装）
- Node 20
- 抓取本身需要 `BGM_TOKEN`（海外直连可用）；本机抓取走代理 `BGM_PROXY=http://127.0.0.1:10808`

## 故障排查

| 问题 | 解决 |
|---|---|
| 连接超时 | 本机加 `BGM_PROXY`；CI 里通常是上游临时故障，次日自动重试 |
| 429 Too Many Requests | 降低 `--rate`（默认 30 次/分钟）|
| `pull` 报 gzip 校验失败 | 下载截断，重跑即可；连续失败检查令牌与网络 |
| `push` 报「疑似未完整抓取」 | 流水线没跑成，状态不完整——修好抓取再跑，别绕过护栏 |
| collections 增量失效 | 从状态包里删掉 `collections.json` 后重跑，会全量重爬 |
