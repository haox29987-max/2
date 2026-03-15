from typing import Optional
from fastapi import APIRouter, Query
from database import get_db_connection
from models import BatchDeleteRequest, SingleRefreshRequest
from services import executor, process_video_urls

router = APIRouter(prefix="/api/videos", tags=["Videos"])

@router.get("/filter")
def get_filtered_videos(type: Optional[str] = None, filter_type: str = Query(...), filter_val: str = Query(...)):
    conn = get_db_connection()
    c = conn.cursor()
    query_acc = "SELECT id, username FROM accounts WHERE status = 'active'"
    params = []
    if type: query_acc += " AND type = ?"; params.append(type)
    acc_rows = c.execute(query_acc, params).fetchall()
    acc_ids = [row['id'] for row in acc_rows]
    username_map = {row['id']: row['username'] for row in acc_rows}
    
    if not acc_ids: return []
    placeholders = ",".join("?" * len(acc_ids))
    
    sql = f'''SELECT id, account_id, video_id, desc, create_time, duration, category, play_count, digg_count, comment_count, share_count, cover_url, platform_category, sub_label, vq_score, is_ai, video_type, music_name, collect_count, GROUP_CONCAT(pid, ', ') as pid, GROUP_CONCAT(product_category, ', ') as product_category FROM videos WHERE account_id IN ({placeholders}) AND (is_deleted = 0 OR is_deleted IS NULL)'''
    if filter_type == 'date': sql += " AND date(create_time, 'unixepoch', 'localtime') = ?"
    elif filter_type == 'pid': sql += " AND pid = ?"
    elif filter_type == 'category': sql += " AND product_category = ?"
        
    params = acc_ids + [filter_val]
    videos = c.execute(sql + " GROUP BY video_id ORDER BY create_time DESC", params).fetchall()
    conn.close()
    
    result = []
    for v in videos:
        vd = dict(v)
        vd['username'] = username_map.get(vd['account_id'], '')
        result.append(vd)
    return result

@router.post("/batch/delete")
def batch_delete_videos(req: BatchDeleteRequest):
    if not req.ids: return {"success": True}
    conn = get_db_connection()
    placeholders = ",".join("?" * len(req.ids))
    conn.cursor().execute(f"UPDATE videos SET is_deleted = 1 WHERE id IN ({placeholders})", req.ids)
    conn.commit()
    conn.close()
    return {"success": True}

@router.post("/{video_id}/delete")
def soft_delete_video(video_id: str):
    conn = get_db_connection()
    conn.cursor().execute("UPDATE videos SET is_deleted = 1 WHERE video_id = ?", (video_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/deleted")
def get_deleted_videos():
    conn = get_db_connection()
    videos = conn.cursor().execute('''SELECT v.*, a.username as account_username FROM videos v LEFT JOIN accounts a ON v.account_id = a.id WHERE v.is_deleted = 1 GROUP BY v.video_id ORDER BY v.create_time DESC''').fetchall()
    conn.close()
    return [dict(v) for v in videos]

@router.get("/{video_id}/trend")
def get_video_trend(video_id: str, days: int = Query(30)):
    conn = get_db_connection()
    date_cond = f"date(timestamp) >= date('now', 'localtime', '-{days} days')" if days > 0 else "1=1"
    rows = conn.cursor().execute(f'''SELECT date(timestamp) as date, MAX(play_count) as plays, MAX(digg_count) as likes FROM video_snapshots WHERE video_id = ? AND {date_cond} GROUP BY date(timestamp) ORDER BY date ASC''', (video_id,)).fetchall()
    conn.close()
    if not rows: return []
    result = []
    if len(rows) == 1: return [{"date": rows[0]['date'], "plays": 0, "likes": 0}]
    for i in range(1, len(rows)):
        prev = rows[i-1]
        curr = rows[i]
        result.append({"date": curr['date'], "plays": curr['plays'] - prev['plays'], "likes": curr['likes'] - prev['likes']})
    if days == 0 and len(rows) > 1: result.insert(0, {"date": rows[0]['date'], "plays": 0, "likes": 0})
    return result

@router.post("/{video_id}/restore")
def restore_video(video_id: str):
    conn = get_db_connection()
    conn.cursor().execute("UPDATE videos SET is_deleted = 0 WHERE video_id = ?", (video_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.delete("/{video_id}")
def hard_delete_video(video_id: str):
    conn = get_db_connection()
    conn.cursor().execute("DELETE FROM videos WHERE video_id = ?", (video_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.post("/{video_id}/refresh_single")
def refresh_single_video(video_id: str, req: SingleRefreshRequest):
    conn = get_db_connection()
    acc = conn.cursor().execute("SELECT username FROM accounts WHERE id = ?", (req.account_id,)).fetchone()
    conn.cursor().execute("UPDATE videos SET is_deleted = 0 WHERE video_id = ?", (video_id,))
    conn.commit()
    conn.close()
    if acc:
        url = f"https://www.tiktok.com/@{acc['username']}/video/{video_id}"
        executor.submit(process_video_urls, req.account_id, acc['username'], [url], True)
    return {"success": True}