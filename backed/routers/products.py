import re
import random
import time
from fastapi import APIRouter
try:
    from curl_cffi import requests as curl_requests
except ImportError:
    pass

from models import decode_val, smart_format, translate_to_zh

router = APIRouter(prefix="/api/product", tags=["Products"])

@router.get("/{pid}")
def get_product_endpoint(pid: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"https://www.fastmoss.com/zh/e-commerce/detail/{pid}",
    }
    html_url = f"https://www.fastmoss.com/zh/e-commerce/detail/{pid}"
    html = ""
    full_content = ""
    try:
        resp = curl_requests.get(html_url, impersonate="chrome120", headers=headers, timeout=15)
        resp.encoding = 'utf-8'
        html = resp.text
        chunks = re.findall(r'self\.__next_f\.push\(\[1,\s*"(.*?)"\]\)', html, re.S)
        full_content = "".join(chunks)
    except Exception as e:
        print(f"[!] HTML 请求失败: {e}")

    def search_text(source, key):
        matches = re.findall(rf'\\"{key}\\":\\"(.*?)\\"', source)
        if not matches: matches = re.findall(rf'"{key}"\s*:\s*"([^"]+)"', html)
        for m in reversed(matches):
            val = decode_val(m)
            if val and "：" not in str(val) and "佣金" not in str(val) and val != "店铺": return val
        return "N/A"

    intro_match = re.search(r'<title>查看\[(.*?)\]', html)
    introduction = intro_match.group(1) if intro_match else search_text(full_content, "title")
    brand = "N/A"
    shop_pattern = r'\\"seller_id\\":\d+.*?\\"name\\":\\"([^"\\]*)\\"'
    shop_matches = re.findall(shop_pattern, full_content)
    for m in reversed(shop_matches):
        val = decode_val(m)
        if val and "：" not in val and val not in ["店铺"]: brand = val; break
    if brand == "N/A": brand = search_text(full_content, "name")

    country = search_text(full_content, "region_name")
    raw_price = search_text(full_content, "real_price")
    price = raw_price.replace('$$', '$') if raw_price != "N/A" else "N/A"
    def search_list(source, key):
        matches = re.findall(rf'\\"{key}\\":\[\\"(.*?)\\"\]', source)
        for m in reversed(matches): return decode_val(m)
        return "N/A"

    cat1 = search_list(full_content, "category_name")
    cat2 = search_list(full_content, "category_name_l2")
    cat3 = search_list(full_content, "category_name_l3")
    cat_list = [c for c in [cat1, cat2, cat3] if c != "N/A"]
    
    if cat_list:
        last_cat = str(cat_list[-1])
        category_full = translate_to_zh(last_cat)
    else:
        category_full = "N/A"

    images = []
    img_block = re.search(r'\\"cover_list\\":\[(.*?)]', full_content)
    if img_block: images = [decode_val(i) for i in re.findall(r'\\"(.*?)\\"', img_block.group(1))]

    current_time = int(time.time())
    cnonce = random.randint(10000000, 99999999)
    api_url = f"https://www.fastmoss.com/api/goods/v3/base?product_id={pid}&_time={current_time}&cnonce={cnonce}"
    sold_count = sale_amount = author_count = aweme_count = commission_rate = product_rating = "N/A"
    try:
        api_resp = curl_requests.get(api_url, impersonate="chrome120", headers=headers, timeout=15)
        api_data = api_resp.json()
        if api_data.get("msg") == "success":
            product_data = api_data.get("data", {}).get("product", {})
            sold_count = smart_format(product_data.get("sold_count", "N/A"))
            sale_amount = smart_format(product_data.get("sale_amount", "N/A"), is_money=True)
            author_count = smart_format(product_data.get("author_count", "N/A"))
            aweme_count = smart_format(product_data.get("aweme_count", "N/A"))
            commission_rate = str(product_data.get("commission_rate", "N/A"))
            product_rating = str(product_data.get("product_rating", "N/A"))
    except Exception as e:
        print(f"[!] API 请求失败: {e}")

    return {"introduction": introduction, "brand": brand, "country": country, "category": category_full, "price": price, "sold_count": sold_count, "sale_amount": sale_amount, "author_count": author_count, "aweme_count": aweme_count, "commission_rate": commission_rate, "product_rating": product_rating, "images": images}