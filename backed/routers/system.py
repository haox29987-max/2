from typing import Optional
from fastapi import APIRouter
from database import get_db_connection
from models import SettingsUpdate
from services import PROGRESS_STORE, scheduled_update_all, setup_cron_job, executor

router = APIRouter(prefix="/api", tags=["System"])

@router.get("/progress/all")
def get_all_progress(): 
    return PROGRESS_STORE

@router.delete("/recycle_bin/empty")
def empty_recycle_bin():
    conn = get_db_connection()
    conn.cursor().execute("DELETE FROM accounts WHERE status = 'deleted'")
    conn.cursor().execute("DELETE FROM videos WHERE is_deleted = 1")
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/export")
def export_all_data(type: Optional[str] = None, group: Optional[str] = None):
    conn = get_db_connection()
    c = conn.cursor()
    q_acc = "SELECT * FROM accounts WHERE status='active'"
    params = []
    if type:
        q_acc += " AND type=?"; params.append(type)
    if group and group != 'all':
        q_acc += " AND group_name=?"; params.append(group)
    accounts = [dict(r) for r in c.execute(q_acc, params).fetchall()]
    if not accounts: return {"accounts": [], "videos": []}
    acc_ids = [a['id'] for a in accounts]
    placeholders = ",".join("?" * len(acc_ids))
    q_vid = f"""SELECT v.*, a.username as account_username, a.custom_name, a.group_name, a.country 
                FROM videos v JOIN accounts a ON v.account_id = a.id 
                WHERE v.account_id IN ({placeholders}) AND v.pid != '' AND (v.is_deleted = 0 OR v.is_deleted IS NULL)"""
    videos = [dict(r) for r in c.execute(q_vid, acc_ids).fetchall()]
    conn.close()
    return {"accounts": accounts, "videos": videos}

@router.get("/settings")
def get_settings():
    conn = get_db_connection()
    rows = conn.cursor().execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}

@router.post("/settings")
def save_settings(settings: SettingsUpdate):
    conn = get_db_connection()
    c = conn.cursor()
    for key, value in settings.dict(exclude_unset=True).items():
        if value is not None: c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()
    if settings.schedule_time: setup_cron_job(settings.schedule_time)
    return {"success": True}

@router.post("/settings/force_update_all")
def api_force_update_all():
    executor.submit(scheduled_update_all)
    return {"success": True}