import time
import random
import threading
import sqlite3
import re
from datetime import datetime
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed
from apscheduler.schedulers.background import BackgroundScheduler

from database import get_db_connection
from scraper import get_request_headers, fetch_page_source, merge_analysis_results, fetch_profile_video_urls
from models import VIDEO_ID_REGEX, translate_to_zh

# 用于普通单点更新、前端交互的响应式线程池
executor = ThreadPoolExecutor(max_workers=3) 
# 专门用于承载全局多轮重试调度器的主后台线程
global_batch_executor = ThreadPoolExecutor(max_workers=1)

PROGRESS_STORE = {}
scheduler = BackgroundScheduler()

def process_video_urls(account_id: int, username: str, urls: List[str], is_single: bool = False, scraped_video_count: int = 0, progress_total: int = 0, progress_offset: int = 0, progress_prefix: str = "") -> bool:
    """
    修改点：增加了布尔值返回值。True 代表抓取且入库成功；False 代表遭遇风控拦截导致抓取失败。
    """
    total = len(urls)
    if total == 0: return True
        
    act_total = progress_total if progress_total > 0 else total

    if not is_single: PROGRESS_STORE[account_id] = {"total": act_total, "current": progress_offset, "status": progress_prefix or "正在全速并发抓取中...", "done": False}
        
    try:
        req_hdrs = get_request_headers()
        processed_videos = []
        c_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        progress_lock = threading.Lock()
        completed_count = 0
        
        def fetch_and_parse(target_url):
            try:
                # 高并发下的微小抖动，避免瞬间发包特征太明显
                time.sleep(random.uniform(0.1, 0.8))
                html = fetch_page_source(target_url, req_headers=req_hdrs)
                parsed = merge_analysis_results(target_url, html, c_timestamp, username)
                return True, parsed, target_url, None
            except Exception as e:
                return False, [], target_url, str(e)
                
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = {pool.submit(fetch_and_parse, u): u for u in urls}
            for future in as_completed(futures):
                success, parsed_rows, url_val, error_msg = future.result()
                with progress_lock:
                    completed_count += 1
                    if success and parsed_rows and parsed_rows[0].get("作者ID"):
                        for row in parsed_rows:
                            raw_cat = row.get("商品类目名称", "")
                            if raw_cat:
                                parts = str(raw_cat).split('>')
                                last_part = parts[-1].strip()
                                clean_name = re.sub(r'\(\d+\)$', '', last_part).strip()
                                try:
                                    row["display_category"] = translate_to_zh(clean_name)
                                except Exception:
                                    row["display_category"] = clean_name
                            else:
                                row["display_category"] = "未知类目"
                        processed_videos.extend(parsed_rows)
                    if not is_single:
                        status_str = f"{progress_prefix} ({progress_offset + completed_count}/{act_total})..." if progress_prefix else f"并发解析中 ({progress_offset + completed_count}/{act_total})..."
                        PROGRESS_STORE[account_id] = {"total": act_total, "current": progress_offset + completed_count, "status": status_str, "done": False}

        # 智能风控识别点 1：虽然请求了 URL，但返回的全是空数据/解析失败，证明被盾拦截了
        if not processed_videos:
            if not is_single and (progress_offset + total >= act_total):
                PROGRESS_STORE[account_id] = {"total": act_total, "current": act_total, "status": "遭遇风控拦截 (无有效数据)", "done": True}
            return False

        best_row = processed_videos[0]
        for r in processed_videos:
            if r.get("作者ID"): best_row = r; break
                
        account_stats_merged = {
            "nickname": best_row.get("作者名", username),
            "avatar_url": best_row.get("avatar_url", ""),
            "reg_time": best_row.get("注册时间", "未知") if best_row.get("注册时间") else "未知",
            "uid": best_row.get("作者ID", ""), 
            "follower_count": best_row.get("作者粉丝数", 0),
            "following_count": best_row.get("following_count", 0),
            "heart_count": best_row.get("heart_count", 0),
            "video_count": scraped_video_count if scraped_video_count > 0 else best_row.get("video_count", 0)
        }
        
        unique_videos = {v["video_id"]: v.get("播放量", 0) for v in processed_videos}
        total_plays = sum(unique_videos.values())
        total_pids = sum(1 for v in processed_videos if v.get("PID"))
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        acc_info = cursor.execute("SELECT reg_time, created_at, uid FROM accounts WHERE id=?", (account_id,)).fetchone()
        existing_reg_time = acc_info['reg_time'] if acc_info and acc_info['reg_time'] else "未知"
        existing_created_at = acc_info['created_at'] if acc_info and acc_info['created_at'] else ""
        existing_uid = acc_info['uid'] if acc_info and acc_info['uid'] else ""
        
        final_reg_time = account_stats_merged["reg_time"]
        if not final_reg_time or final_reg_time == "未知":
            final_reg_time = existing_reg_time

        final_created_at = existing_created_at
        if not final_created_at:
            final_created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
        final_uid = account_stats_merged["uid"]
        if not final_uid:
            final_uid = existing_uid

        cursor.execute('''UPDATE accounts SET nickname=?, avatar_url=?, reg_time=?, created_at=?, uid=?, last_updated=datetime('now', 'localtime') WHERE id=?''', 
                       (account_stats_merged["nickname"], account_stats_merged["avatar_url"], final_reg_time, final_created_at, final_uid, account_id))
        
        cursor.execute('''INSERT INTO snapshots (account_id, follower_count, following_count, heart_count, video_count, play_count, pid_count, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))''', 
                       (account_id, account_stats_merged["follower_count"], account_stats_merged["following_count"], account_stats_merged["heart_count"], account_stats_merged["video_count"], total_plays, total_pids))

        sql_new = '''INSERT INTO videos (account_id, video_id, desc, create_time, duration, category, play_count, digg_count, comment_count, share_count, cover_url, platform_category, sub_label, vq_score, is_ai, video_type, pid, product_category, display_category, is_deleted, music_name, collect_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) 
                ON CONFLICT(video_id, pid) DO UPDATE SET 
                account_id = excluded.account_id, play_count = excluded.play_count, digg_count = excluded.digg_count, 
                comment_count = excluded.comment_count, share_count = excluded.share_count, 
                create_time = CASE WHEN excluded.create_time > 1420070400 THEN excluded.create_time ELSE videos.create_time END,
                duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE videos.duration END,
                cover_url = CASE WHEN excluded.cover_url != '' THEN excluded.cover_url ELSE videos.cover_url END,
                desc = CASE WHEN excluded.desc != '' THEN excluded.desc ELSE videos.desc END,
                platform_category = CASE WHEN excluded.platform_category != '' THEN excluded.platform_category ELSE videos.platform_category END,
                sub_label = CASE WHEN excluded.sub_label != '' THEN excluded.sub_label ELSE videos.sub_label END,
                vq_score = CASE WHEN excluded.vq_score != '' THEN excluded.vq_score ELSE videos.vq_score END,
                is_ai = excluded.is_ai,
                video_type = excluded.video_type,
                music_name = CASE WHEN excluded.music_name != '' THEN excluded.music_name ELSE videos.music_name END,
                collect_count = CASE WHEN excluded.collect_count > 0 THEN excluded.collect_count ELSE videos.collect_count END,
                product_category = CASE WHEN excluded.product_category != '' THEN excluded.product_category ELSE videos.product_category END,
                display_category = CASE WHEN excluded.display_category != '' THEN excluded.display_category ELSE videos.display_category END,
                is_deleted = 0
        '''
        sql_old = '''INSERT INTO videos (account_id, video_id, desc, create_time, duration, category, play_count, digg_count, comment_count, share_count, cover_url, platform_category, sub_label, vq_score, is_ai, video_type, pid, product_category, display_category, is_deleted, music_name, collect_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?) 
                ON CONFLICT(video_id) DO UPDATE SET 
                account_id = excluded.account_id, play_count = excluded.play_count, digg_count = excluded.digg_count, 
                comment_count = excluded.comment_count, share_count = excluded.share_count, 
                create_time = CASE WHEN excluded.create_time > 1420070400 THEN excluded.create_time ELSE videos.create_time END,
                duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE videos.duration END,
                cover_url = CASE WHEN excluded.cover_url != '' THEN excluded.cover_url ELSE videos.cover_url END,
                desc = CASE WHEN excluded.desc != '' THEN excluded.desc ELSE videos.desc END,
                platform_category = CASE WHEN excluded.platform_category != '' THEN excluded.platform_category ELSE videos.platform_category END,
                sub_label = CASE WHEN excluded.sub_label != '' THEN excluded.sub_label ELSE videos.sub_label END,
                vq_score = CASE WHEN excluded.vq_score != '' THEN excluded.vq_score ELSE videos.vq_score END,
                is_ai = excluded.is_ai,
                video_type = excluded.video_type,
                music_name = CASE WHEN excluded.music_name != '' THEN excluded.music_name ELSE videos.music_name END,
                collect_count = CASE WHEN excluded.collect_count > 0 THEN excluded.collect_count ELSE videos.collect_count END,
                pid = CASE WHEN excluded.pid != '' THEN excluded.pid ELSE videos.pid END,
                product_category = CASE WHEN excluded.product_category != '' THEN excluded.product_category ELSE videos.product_category END,
                display_category = CASE WHEN excluded.display_category != '' THEN excluded.display_category ELSE videos.display_category END,
                is_deleted = 0
        '''
        for v in processed_videos:
            params = (
                account_id, v["video_id"], v.get("desc", ""), v.get("create_ts", 0), v.get("视频时长(秒)", 0), "", 
                v.get("播放量", 0), v.get("点赞量", 0), v.get("评论数", 0), v.get("分享数", 0), v.get("cover_url", ""), 
                v.get("类目名称", ""), v.get("细分标签名称", ""), str(v.get("视频画质得分", "")), v.get("AI视频", "否"), 
                v.get("视频类型", "普通流量"), v.get("PID", ""), v.get("商品类目名称", ""), v.get("display_category", ""),
                v.get("音乐名称", ""), v.get("收藏数", 0)
            )
            try: cursor.execute(sql_new, params)
            except sqlite3.OperationalError: cursor.execute(sql_old, params)
                
            cursor.execute('''INSERT INTO video_snapshots (video_id, play_count, digg_count, comment_count, share_count, timestamp) 
                              VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))''', 
                           (v["video_id"], v.get("播放量", 0), v.get("点赞量", 0), v.get("评论数", 0), v.get("分享数", 0)))
              
        conn.commit()
        conn.close()
        
        if not is_single and (progress_offset + total >= act_total):
            PROGRESS_STORE[account_id] = {"total": act_total, "current": act_total, "status": "数据聚合入库完成！", "done": True}
        
        return True
    except Exception as e:
        if not is_single: PROGRESS_STORE[account_id] = {"total": act_total, "current": 0, "status": "并发解析系统发生故障", "done": True}
        return False

def update_account_data_initial(account_id: int, username: str):
    conn = get_db_connection()
    acc = conn.cursor().execute("SELECT type FROM accounts WHERE id = ?", (account_id,)).fetchone()
    settings = dict(conn.cursor().execute("SELECT key, value FROM settings").fetchall())
    conn.close()
    limit_key = 'internal_scrape_video_limit' if acc and acc['type'] == 'internal' else 'external_scrape_video_limit'
    scrape_limit = int(settings.get(limit_key) or 30)

    PROGRESS_STORE[account_id] = {"total": scrape_limit, "current": 0, "status": "正在极速抓取作者主页视频列表...", "done": False}
    urls, playlist_count = fetch_profile_video_urls(username, limit=scrape_limit)
    if urls: process_video_urls(account_id, username, urls, scraped_video_count=playlist_count)
    else: PROGRESS_STORE[account_id] = {"total": scrape_limit, "current": scrape_limit, "status": "账号暂无有效视频", "done": True}

def refresh_existing_videos(account_id: int, limit: int = 30):
    PROGRESS_STORE[account_id] = {"total": limit, "current": 0, "status": "准备连接作者主页...", "done": False}
    conn = get_db_connection()
    acc = conn.cursor().execute("SELECT username FROM accounts WHERE id = ?", (account_id,)).fetchone()
    if not acc: 
        conn.close(); return
    username = acc['username']
    deleted_rows = conn.cursor().execute("SELECT video_id FROM videos WHERE account_id = ? AND is_deleted = 1", (account_id,)).fetchall()
    deleted_vids = {row['video_id'] for row in deleted_rows}
    conn.close()

    PROGRESS_STORE[account_id] = {"total": limit, "current": 0, "status": "正在极速抓取作者主页视频列表...", "done": False}
    vids_data_urls, playlist_count = fetch_profile_video_urls(username, limit=limit + len(deleted_vids)) 
    
    valid_urls = []
    for url in vids_data_urls:
        match = VIDEO_ID_REGEX.search(url)
        if match:
            vid = match.group(1)
            if vid not in deleted_vids: valid_urls.append(url)
            if limit > 0 and len(valid_urls) >= limit: break
            
    if valid_urls: process_video_urls(account_id, username, valid_urls, scraped_video_count=playlist_count)
    else: PROGRESS_STORE[account_id] = {"total": limit, "current": limit, "status": "暂无需要更新的新鲜数据", "done": True}

def daily_scheduled_account_update(account_id: int) -> bool:
    """
    修改点：增加返回布尔值。用于让多轮调度器知道该账号在这一轮有没有触发风控。
    返回 True 表示彻底更新成功；返回 False 表示遭遇风控，需要进入下一轮重试缓存。
    """
    conn = get_db_connection()
    acc = conn.cursor().execute("SELECT username, type FROM accounts WHERE id = ?", (account_id,)).fetchone()
    if not acc:
        conn.close()
        return True # 账号不存在，不需要重试
    username = acc['username']

    settings = dict(conn.cursor().execute("SELECT key, value FROM settings").fetchall())
    limit_key = 'internal_scrape_video_limit' if acc['type'] == 'internal' else 'external_scrape_video_limit'
    scrape_limit = int(settings.get(limit_key) or 30)

    deleted_rows = conn.cursor().execute("SELECT video_id FROM videos WHERE account_id = ? AND is_deleted = 1", (account_id,)).fetchall()
    deleted_vids = {row['video_id'] for row in deleted_rows}

    existing_rows = conn.cursor().execute("SELECT video_id FROM videos WHERE account_id = ? AND is_deleted = 0", (account_id,)).fetchall()
    active_old_vids = {row['video_id'] for row in existing_rows}
    all_existing_vids = deleted_vids.union(active_old_vids)
    conn.close()

    vids_data_urls, playlist_count = fetch_profile_video_urls(username, limit=scrape_limit + len(deleted_vids))
    
    # 智能风控识别点 2：明明库里有旧视频，但主页请求返回 0 个视频，大概率 IP 被封禁（弹出了验证码）
    if not vids_data_urls and active_old_vids:
        return False 
    
    new_urls = []
    for url in vids_data_urls:
        match = VIDEO_ID_REGEX.search(url)
        if match:
            vid = match.group(1)
            if vid not in all_existing_vids:
                new_urls.append(url)

    total_tasks = len(new_urls) + len(active_old_vids)
    if total_tasks == 0:
        PROGRESS_STORE[account_id] = {"total": 100, "current": 100, "status": "主页干净无遗漏，已跳过", "done": True}
        return True

    current_offset = 0
    success_all = True

    if new_urls:
        # 获取当前进度前缀（由多轮调度器写入的 status 提取），保持 UI 一致性
        current_status = PROGRESS_STORE.get(account_id, {}).get("status", "")
        prefix = "新增视频抓取中" if "极速抓取" in current_status else "风控重试新增视频中"
        
        PROGRESS_STORE[account_id] = {"total": total_tasks, "current": 0, "status": f"发现 {len(new_urls)} 个新视频，开始抓取...", "done": False}
        res = process_video_urls(account_id, username, new_urls, is_single=False, scraped_video_count=playlist_count, progress_total=total_tasks, progress_offset=current_offset, progress_prefix=prefix)
        if not res: success_all = False
        current_offset += len(new_urls)

    if active_old_vids:
        old_urls = [f"https://www.tiktok.com/@{username}/video/{vid}" for vid in active_old_vids]
        current_status = PROGRESS_STORE.get(account_id, {}).get("status", "")
        prefix = "历史视频全量更新中" if "极速抓取" in current_status else "风控重试历史视频中"
        
        for i in range(0, len(old_urls), 20):
            batch_urls = old_urls[i:i+20]
            res = process_video_urls(account_id, username, batch_urls, is_single=False, progress_total=total_tasks, progress_offset=current_offset, progress_prefix=prefix)
            if not res: success_all = False
            current_offset += len(batch_urls)
            # 批次之间短暂休眠
            time.sleep(random.uniform(2.0, 4.0))
            
    return success_all

# =========================================================================
# 【核心升级】多轮退避重试调度器 (最高 5 轮高并发)
# =========================================================================
def _run_global_update_multi_round(accounts):
    max_rounds = 5
    current_round = 1
    pending_accounts = accounts

    while current_round <= max_rounds and pending_accounts:
        failed_accounts = []
        
        # 1. 刷新本轮待处理账号的 UI 状态
        for acc in pending_accounts:
            acc_id = acc["id"]
            if current_round == 1:
                PROGRESS_STORE[acc_id] = {"total": 100, "current": 0, "status": "第1轮高并发极速抓取中...", "done": False}
            else:
                PROGRESS_STORE[acc_id] = {"total": 100, "current": 0, "status": f"第{current_round}轮风控重试排队中...", "done": False}

        # 2. 启动高并发池执行当前轮次 (max_workers=5 提升效率)
        with ThreadPoolExecutor(max_workers=5) as pool:
            future_to_acc = {pool.submit(daily_scheduled_account_update, acc["id"]): acc for acc in pending_accounts}
            
            for future in as_completed(future_to_acc):
                acc = future_to_acc[future]
                try:
                    is_success = future.result()
                    if not is_success:
                        # 触发风控，加入失败列表准备下一轮
                        failed_accounts.append(acc)
                except Exception as e:
                    failed_accounts.append(acc)

        # 3. 检查是否全部更新完毕
        if not failed_accounts:
            break
            
        # 4. 准备进入下一轮
        pending_accounts = failed_accounts
        current_round += 1
        
        # 如果还有下一轮，先让服务器 IP 彻底冷静 20~30 秒，这是防死封的关键！
        if current_round <= max_rounds:
            for acc in pending_accounts:
                 PROGRESS_STORE[acc["id"]] = {"total": 100, "current": 0, "status": f"遭遇风控，冷却IP准备第{current_round}轮重试...", "done": False}
            time.sleep(random.uniform(20.0, 30.0))

    # 5. 经过 5 轮血战仍然失败的账号，进行特殊标识
    for acc in pending_accounts:
        PROGRESS_STORE[acc["id"]] = {"total": 100, "current": 100, "status": "❌ 连续5轮触发风控，更新失败", "done": True}

def scheduled_update_all():
    conn = get_db_connection()
    accounts = conn.cursor().execute("SELECT id FROM accounts WHERE status = 'active'").fetchall()
    conn.close()

    if not accounts: return

    for acc in accounts:
        PROGRESS_STORE[acc["id"]] = {"total": 100, "current": 0, "status": "已加入全局并发列车...", "done": False}
        
    # 将包含智能重试机制的 Multi-Round 调度器推入后台独立线程运行，不阻塞主程序
    global_batch_executor.submit(_run_global_update_multi_round, accounts)

def scheduled_24h_video_updater():
    conn = get_db_connection()
    c = conn.cursor()
    stale_videos = c.execute('''SELECT v.video_id, a.id as account_id, a.username FROM videos v JOIN accounts a ON v.account_id = a.id WHERE v.is_deleted = 0 AND a.status = 'active' AND v.create_time > 1420070400 AND NOT EXISTS (SELECT 1 FROM video_snapshots vs WHERE vs.video_id = v.video_id AND vs.timestamp >= datetime(v.create_time + ((CAST(strftime('%s', 'now') AS INTEGER) - v.create_time) / 86400) * 86400, 'unixepoch', 'localtime'))''').fetchall()
    conn.close()
    if not stale_videos: return
    from collections import defaultdict
    acc_map = defaultdict(list)
    for row in stale_videos: acc_map[(row['account_id'], row['username'])].append(f"https://www.tiktok.com/@{row['username']}/video/{row['video_id']}")
    for (acc_id, username), urls in acc_map.items():
        for i in range(0, len(urls), 20):
            process_video_urls(acc_id, username, urls[i:i+20], is_single=True)
            time.sleep(15)

def setup_cron_job(time_str: str):
    if scheduler.running: scheduler.remove_all_jobs()
    else: scheduler.start()
    try:
        hour, minute = map(int, time_str.split(':'))
        scheduler.add_job(scheduled_update_all, 'cron', hour=hour, minute=minute)
        scheduler.add_job(scheduled_24h_video_updater, 'interval', minutes=60)
    except Exception: pass

if not scheduler.running:
    scheduler.start()
    scheduler.add_job(scheduled_24h_video_updater, 'interval', minutes=60)