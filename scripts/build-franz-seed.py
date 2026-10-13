#!/usr/bin/env python3
"""Build customized Franzlift seed.json from authoritative Franzlift content and template collections."""

import json
from pathlib import Path

ROOT = Path("/home/namnh/workspace/thuanphat/franzlift-emdash")
SOURCE_CONTENT_PATH = ROOT / "seed/franzlift-source-content.json"
BASE_SEED_PATH = Path("/home/namnh/workspace/thuanphat/thuanphat-worker/emdash-poc/seed/seed.json")
OUTPUT_SEED_PATH = ROOT / "seed/seed.json"

source_content = json.load(open(SOURCE_CONTENT_PATH))
base_seed = json.load(open(BASE_SEED_PATH))

# Clone base schema
seed = {
    "$schema": base_seed["$schema"],
    "version": base_seed["version"],
    "meta": {
        "generator": "franzlift-builder",
        "timestamp": "2026-09-05T12:00:00.000Z"
    },
    "settings": {
        "site_name": "Thang Máy Nhập Khẩu Franz",
        "tagline": "Đỉnh Cao Công Nghệ Đức – Nâng Tầm Không Gian Sống",
        "description": "Thang máy nhập khẩu Franz chính hãng - công nghệ Đức, vận hành êm ái, thiết kế sang trọng, tối ưu diện tích và an toàn tuyệt đối.",
        "locale": "vi",
        "timezone": "Asia/Ho_Chi_Minh"
    },
    "collections": base_seed["collections"],
    "menus": base_seed.get("menus", []),
    "content": {}
}

# 1. site_data
# Ensure branding has logo-header.svg (colored) and logo-header-white.svg (white)
source_content["branding.logo"] = "/assets-local/logo-header.svg"
source_content["branding.logoLight"] = "/assets-local/logo-header-white.svg"
source_content["branding.siteName"] = "Thang Máy Nhập Khẩu Franz"
source_content["contact.hotline"] = source_content.get("contact.hotline") or "0939612555"
source_content["contact.salesPhone"] = source_content.get("contact.salesPhone") or "0939612555"
source_content["contact.techPhone"] = source_content.get("contact.techPhone") or "0902218255"
source_content["contact.email"] = source_content.get("contact.email") or "homeliftvietnam@gmail.com"
source_content["contact.address"] = source_content.get("contact.address") or "Số 55A Louis I, Louis City, Đại Mỗ, Hà Nội"

# Config entry
seed["content"]["site_data"] = [
    {
        "id": "config",
        "slug": "config",
        "status": "published",
        "data": {
            "title": "Nội dung website Franzlift",
            "vr_url": source_content.get("vr.url") or "https://vr.justeasy.cn/view/1845656k57jm8951-1657245612.html",
            "content": source_content
        }
    }
]

# 2. Reuse rich collections from base_seed (which already have portableText converted, rich galleries, etc.)
# Products
seed["content"]["products"] = base_seed["content"]["products"]
# Posts
seed["content"]["posts"] = base_seed["content"]["posts"]
# Projects
seed["content"]["projects"] = base_seed["content"]["projects"]
# Services
seed["content"]["services"] = base_seed["content"]["services"]
# Tech items
seed["content"]["tech_items"] = base_seed["content"]["tech_items"]
# VR Cabins
seed["content"]["vr_cabins"] = base_seed["content"]["vr_cabins"]

# 3. Hero slides (Franz-tailored)
seed["content"]["hero_slides"] = [
    {
        "id": "hero-1",
        "slug": "hero-1",
        "status": "published",
        "data": {
            "title": "Franz Home Lift",
            "message": "Thang máy nhập khẩu Franz - Tinh hoa công nghệ Đức dành cho không gian sống hiện đại.",
            "image": {
                "id": "bundled:/assets-local/02-bce74fae6c8eb1eba141044b0b26d970.png",
                "src": "/assets-local/02-bce74fae6c8eb1eba141044b0b26d970.png",
                "alt": "Franz Home Lift"
            },
            "sort_order": 0
        }
    },
    {
        "id": "hero-2",
        "slug": "hero-2",
        "status": "published",
        "data": {
            "title": "Công Nghệ Tiêu Chuẩn Đức",
            "message": "Tiêu chuẩn Đức – Khởi nguồn từ tinh thần thủ công trăm năm, hố pit siêu nông không phòng máy.",
            "image": {
                "id": "bundled:/assets-local/03-2aeef62d95c474ce21e032cf459b418e.png",
                "src": "/assets-local/03-2aeef62d95c474ce21e032cf459b418e.png",
                "alt": "Tiêu chuẩn Đức"
            },
            "sort_order": 1
        }
    },
    {
        "id": "hero-3",
        "slug": "hero-3",
        "status": "published",
        "data": {
            "title": "Nâng Tầm Không Gian Sống",
            "message": "Giải pháp thang máy thông minh dành cho nhà cải tạo, nhà phố và biệt thự cao cấp.",
            "image": {
                "id": "bundled:/assets-local/05-ab9f2d1e25e98218ae32ec5b6b4724b0.png",
                "src": "/assets-local/05-ab9f2d1e25e98218ae32ec5b6b4724b0.png",
                "alt": "Nâng tầm không gian sống"
            },
            "sort_order": 2
        }
    }
]

# 4. Reasons
seed["content"]["reasons"] = [
    {
        "id": "reason-1",
        "slug": "reason-1",
        "status": "published",
        "data": {
            "title": "Đỉnh Cao Công Nghệ Đức",
            "description": "Thang máy nhập khẩu Franz đồng bộ nguyên chiếc, đạt chứng nhận an toàn quốc tế khắt khe.",
            "sort_order": 0
        }
    },
    {
        "id": "reason-2",
        "slug": "reason-2",
        "status": "published",
        "data": {
            "title": "Hố Pit Siêu Nông & Không Phòng Máy",
            "description": "Chỉ từ 60mm - 150mm, giữ nguyên kết cấu sàn và kiến trúc mái tòa nhà.",
            "sort_order": 1
        }
    },
    {
        "id": "reason-3",
        "slug": "reason-3",
        "status": "published",
        "data": {
            "title": "Thiết Kế Tinh Xảo & Cá Nhân Hóa",
            "description": "Đa dạng tùy chọn vách kính toàn cảnh, trần và sàn nghệ thuật sang trọng.",
            "sort_order": 2
        }
    },
    {
        "id": "reason-4",
        "slug": "reason-4",
        "status": "published",
        "data": {
            "title": "Vận Hành Bằng Điện 220V",
            "description": "Tiết kiệm điện năng vượt trội, êm ái tuyệt đối không gây tiếng ồn.",
            "sort_order": 3
        }
    },
    {
        "id": "reason-5",
        "slug": "reason-5",
        "status": "published",
        "data": {
            "title": "Dịch Vụ Hậu Mãi Toàn Diện",
            "description": "Bảo hành dài hạn, bảo trì định kỳ bởi đội ngũ kỹ thuật giàu kinh nghiệm.",
            "sort_order": 4
        }
    }
]

# 5. Stats
seed["content"]["stats"] = [
    {
        "id": "stat-1",
        "slug": "stat-1",
        "status": "published",
        "data": {
            "number": "100%",
            "label": "Nhập khẩu nguyên chiếc",
            "sort_order": 0
        }
    },
    {
        "id": "stat-2",
        "slug": "stat-2",
        "status": "published",
        "data": {
            "number": "60mm",
            "label": "Hố Pit tối thiểu",
            "sort_order": 1
        }
    },
    {
        "id": "stat-3",
        "slug": "stat-3",
        "status": "published",
        "data": {
            "number": "5 sao",
            "label": "Đánh giá chất lượng",
            "sort_order": 2
        }
    },
    {
        "id": "stat-4",
        "slug": "stat-4",
        "status": "published",
        "data": {
            "number": "24/7",
            "label": "Hỗ trợ kỹ thuật chuyên sâu",
            "sort_order": 3
        }
    }
]

with open(OUTPUT_SEED_PATH, "w", encoding="utf-8") as f:
    json.dump(seed, f, ensure_ascii=False, indent=2)

print("Generated franzlift-emdash/seed/seed.json successfully!")
