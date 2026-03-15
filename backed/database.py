import os
import sqlite3

DB_DIR = r"D:\TiktokData"
if not os.path.exists(DB_DIR): 
    os.makedirs(DB_DIR)
DB_PATH = os.path.join(DB_DIR, "chengfeng_data.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 【核心优化1】开启 WAL 模式，极大提升高并发读写性能，解决前端请求 Pending 挂起卡死问题
    cursor.execute('PRAGMA journal_mode=WAL;')
    # 调整同步模式，进一步提升写入速度
    cursor.execute('PRAGMA synchronous=NORMAL;')

    cursor.execute('''CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, nickname TEXT, 
        avatar_url TEXT, type TEXT, status TEXT DEFAULT 'active', last_updated DATETIME DEFAULT (datetime('now', 'localtime')), 
        deleted_at DATETIME, reg_time TEXT)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, timestamp DATETIME DEFAULT (datetime('now', 'localtime')), 
        follower_count INTEGER, following_count INTEGER, heart_count INTEGER, video_count INTEGER, 
        play_count INTEGER, pid_count INTEGER DEFAULT 0)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, video_id TEXT, desc TEXT, 
        create_time INTEGER, duration INTEGER, category TEXT, play_count INTEGER, digg_count INTEGER, 
        comment_count INTEGER, share_count INTEGER, cover_url TEXT, platform_category TEXT, 
        sub_label TEXT, vq_score TEXT, is_ai TEXT, video_type TEXT, pid TEXT, product_category TEXT,
        is_deleted INTEGER DEFAULT 0, 
        UNIQUE(video_id, pid))''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)''')
    
    cursor.execute('''CREATE TABLE IF NOT EXISTS video_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        video_id TEXT, 
        play_count INTEGER, 
        digg_count INTEGER,
        comment_count INTEGER,
        share_count INTEGER,
        timestamp DATETIME DEFAULT (datetime('now', 'localtime'))
    )''')
    
    # 修改表结构增加字段（防重防错处理）
    try: cursor.execute("ALTER TABLE videos ADD COLUMN is_deleted INTEGER DEFAULT 0")
    except Exception: pass
    try: cursor.execute("ALTER TABLE videos ADD COLUMN music_name TEXT DEFAULT ''")
    except Exception: pass
    try: cursor.execute("ALTER TABLE videos ADD COLUMN collect_count INTEGER DEFAULT 0")
    except Exception: pass
    try: cursor.execute("ALTER TABLE videos ADD COLUMN display_category TEXT DEFAULT ''")
    except Exception: pass

    try: cursor.execute("ALTER TABLE accounts ADD COLUMN group_name TEXT DEFAULT '默认分组'")
    except Exception: pass
    try: cursor.execute("ALTER TABLE accounts ADD COLUMN country TEXT DEFAULT '未知'")
    except Exception: pass
    try: cursor.execute("ALTER TABLE accounts ADD COLUMN custom_name TEXT DEFAULT ''")
    except Exception: pass
    try: cursor.execute("ALTER TABLE accounts ADD COLUMN created_at TEXT DEFAULT ''")
    except Exception: pass
    try: cursor.execute("ALTER TABLE accounts ADD COLUMN mcn TEXT DEFAULT ''")
    except Exception: pass
    
    # 🚀 新增：为账号表增加原生 uid 字段 
    try: cursor.execute("ALTER TABLE accounts ADD COLUMN uid TEXT DEFAULT ''")
    except Exception: pass
    
    # 【核心优化2】添加关键业务索引，解决随着数据海量增长后，Dashboard API 聚合查询缓慢的问题
    try: cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_account_date ON videos(account_id, is_deleted, create_time)")
    except Exception: pass
    try: cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_pid ON videos(pid)")
    except Exception: pass
    try: cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(product_category)")
    except Exception: pass

    # 修复早期错误时间戳
    try:
        zero_rows = cursor.execute("SELECT id, video_id FROM videos WHERE create_time <= 1420070400 OR create_time IS NULL").fetchall()
        for r in zero_rows:
            vid = str(r['video_id'])
            if vid.isdigit() and len(vid) > 15:
                real_ts = int(vid) >> 32
                if real_ts > 1420070400:
                    cursor.execute("UPDATE videos SET create_time = ? WHERE id = ?", (real_ts, r['id']))
    except Exception: pass
        
    conn.commit()
    conn.close()