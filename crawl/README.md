# Bangumi 追番数据爬取 & 博客集成

## 文件说明

| 文件 | 作用 |
|---|---|
| `crawl_timeline.py` | 爬取看番时间线（增量，基于 `state.json`） |
| `crawl_collections.py` | 爬取追番收藏列表（增量，基于 `updated_at` 对比） |
| `convert_to_bangumi_data.mjs` | 把 `collections.json` 转成 Mizuki 的 `bangumi-data.json` |
| `data/` | 爬取的数据（timeline_*.json, collections.json, state.json） |
| `../update-bgm.sh` | 一键脚本：爬取 + 聚合 + 转换 + 构建 + 部署 |

## 增量爬取原理

### 时间线 `crawl_timeline.py`
- 记录上次爬到的 `until_id`（在 `data/state.json`）
- 下次从该 ID 往前爬（更新的记录）
- `--max-pages 5` 限制每次最多爬 5 页（约 100 条），防止跑太久

### 收藏 `crawl_collections.py`
- API 返回按 `updated_at` 降序排列
- 加载已有的 `collections.json`，建立 `sid → updated_at` 快照
- 逐页爬取，遇到 `updated_at` 没变过的条目就停止
- **无变更时只发 3 次 API 请求**（想看/看过/在看各一次），秒完

## 使用方法

### 首次使用

1. **填配置**：编辑 `../update-bgm.sh`，填好 `USER_ID`、`BGM_TOKEN`、`PROXY` 等
2. **装依赖**：
   ```bash
   cd bgm-timeline
   python -m venv venv
   source venv/bin/activate
   pip install requests
   ```
3. **确认代理可用**：代理默认 `http://127.0.0.1:20171`
4. **手动跑一次全量**：
   ```bash
   cd /home/sin/blog
   ./update-bgm.sh
   ```

### 日常使用

```bash
# 只爬取 + 构建（不部署）
./update-bgm.sh

# 爬取 + 构建 + 部署到 VPS + 清 CDN 缓存
./update-bgm.sh --deploy

# 爬取 + 构建 + 部署 + git push 备份
./update-bgm.sh --deploy --push
```

### 定时执行（cron）

```bash
crontab -e
```

加一行：
```cron
# 每天凌晨 3 点自动更新并部署，日志写到 bgm-cron.log
0 3 * * * /home/sin/blog/update-bgm.sh --deploy >> /home/sin/blog/bgm-cron.log 2>&1
```

### 查看日志

```bash
# 查看定时任务日志
tail -100 /home/sin/blog/bgm-cron.log

# 手动测试跑一次
cd /home/sin/blog
./update-bgm.sh 2>&1 | tee /tmp/bgm-test.log
```

## 部署相关配置

`update-bgm.sh --deploy` 需要填的变量：

| 变量 | 说明 | 示例 |
|---|---|---|
| `VPS_SSH` | VPS 的 SSH 地址 | `root@1.2.3.4` |
| `VPS_WEB_ROOT` | VPS 上 Web 根目录 | `/var/www/blog` |
| `CF_ZONE_ID` | Cloudflare Zone ID | 在 Cloudflare 仪表盘 → 概览 → 右侧栏 |
| `CF_API_TOKEN` | Cloudflare API Token | 需要 Cache Purge 权限 |

### 获取 Cloudflare Zone ID

1. 登录 Cloudflare → 选你的域名
2. 右侧栏 → API → Zone ID

### 创建 Cloudflare API Token

1. Cloudflare → My Profile → API Tokens → Create Token
2. 选 "Custom token"
3. Permissions: Zone → Cache Purge → Purge
4. Zone Resources: Include → Specific zone → 你的域名

## VPS 上的 Nginx 配置参考

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/blog;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 静态资源长缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API JSON 短缓存
    location /api/ {
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

## 故障排查

| 问题 | 解决 |
|---|---|
| 连接超时 | 检查代理是否开启 |
| 429 Too Many Requests | 降低 `--rate`（默认 30 次/分钟） |
| `state.json` 丢失 | 会从头爬，不影响已有数据（按 year 合并去重） |
| collections 增量失效 | 删掉 `collections.json` 重新全量爬 |
| VPS 构建内存不足 | 本脚本在本地构建，VPS 只需 Nginx |
