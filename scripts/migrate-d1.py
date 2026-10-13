#!/usr/bin/env python3

"""
Idempotent D1 database schema migration script for Thang máy Thuận Phát EmDash.
Adds `featured_image`, `content`, `gallery_v2`, and `content_mode` to products and posts
in remote or local D1 databases if not already present.
"""

import json, subprocess, sys, random, os

def gen_ulid():
    chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    return "01M19" + "".join(random.choice(chars) for _ in range(21))

def main():
    target_env = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ("--remote", "--local") else "--remote"
    db_name = "haslift-emdash"
    
    seed_path = os.path.join(os.path.dirname(__file__), "..", "seed", "seed.json")
    try:
        with open(seed_path, "r", encoding="utf-8") as f:
            seed = json.load(f)
    except Exception as err:
        print(f"Failed to read seed file: {err}")
        sys.exit(1)
    sql_statements = []

    cmd = ['npx', 'wrangler', 'd1', 'execute', db_name, target_env, '--command', 'SELECT id, slug FROM _emdash_collections;', '--json']
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("Failed to query collections:", r.stderr)
        sys.exit(1)
    
    try:
        data = json.loads(r.stdout)
        cols = {row['slug']: row['id'] for row in data[0]['results']}
    except Exception as err:
        print(f"Failed to parse collections result: {err}")
        sys.exit(1)

    cmd = ['npx', 'wrangler', 'd1', 'execute', db_name, target_env, '--command', 'SELECT collection_id, slug FROM _emdash_fields;', '--json']
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        existing_fields = {(row['collection_id'], row['slug']) for row in data[0]['results']}
    except Exception as err:
        print(f"Failed to parse fields result: {err}")
        sys.exit(1)

    col_types = {
        "string": "TEXT", "text": "TEXT", "url": "TEXT", "number": "REAL", "integer": "INTEGER",
        "boolean": "INTEGER", "datetime": "TEXT", "image": "TEXT", "file": "TEXT", "reference": "TEXT",
        "portableText": "JSON", "json": "JSON", "slug": "TEXT", "repeater": "JSON", "select": "TEXT"
    }

    for coll_def in seed['collections']:
        c_slug = coll_def['slug']
        if c_slug not in cols: continue
        c_id = cols[c_slug]
        table_name = f"ec_{c_slug}"
        
        cmd = ['npx', 'wrangler', 'd1', 'execute', db_name, target_env, '--command', f'PRAGMA table_info({table_name});', '--json']
        r = subprocess.run(cmd, capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            existing_cols = {row['name'] for row in data[0]['results']}
        except Exception as err:
            print(f"Failed to parse table info for {table_name}: {err}")
            continue
        
        for idx, field in enumerate(coll_def['fields']):
            f_slug = field['slug']
            f_type = field['type']
            col_type = col_types.get(f_type, "TEXT")
            
            if f_slug not in existing_cols:
                sql_statements.append(f"ALTER TABLE {table_name} ADD COLUMN {f_slug} {col_type};")
                existing_cols.add(f_slug)
                
            if (c_id, f_slug) not in existing_fields:
                fid = gen_ulid()
                req = 1 if field.get('required') else 0
                searchable = 1 if field.get('searchable') else 0
                val = field.get('validation')
                val_json = f"'{json.dumps(val, ensure_ascii=False)}'" if val else "NULL"
                
                sql_statements.append(
                    f'INSERT INTO _emdash_fields (id, collection_id, slug, label, type, column_type, required, "unique", default_value, validation, widget, options, sort_order, created_at, searchable, translatable, indexed) '
                    f"VALUES ('{fid}', '{c_id}', '{f_slug}', '{field['label']}', '{f_type}', '{col_type}', {req}, 0, NULL, {val_json}, NULL, NULL, {idx}, '2026-08-30 05:35:00', {searchable}, 1, 0);"
                )
                existing_fields.add((c_id, f_slug))

    sql_statements.append("UPDATE ec_products SET featured_image = image_url WHERE featured_image IS NULL AND image_url IS NOT NULL;")
    sql_statements.append("UPDATE ec_posts SET featured_image = image_url WHERE featured_image IS NULL AND image_url IS NOT NULL;")

    print(f"Executing {len(sql_statements)} migration SQL statements...")
    for i, stmt in enumerate(sql_statements, 1):
        print(f"[{i}/{len(sql_statements)}] {stmt[:70]}...")
        cmd = ['npx', 'wrangler', 'd1', 'execute', db_name, target_env, '--command', stmt]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print("  FAILED:", r.stderr or r.stdout)
        else:
            print("  OK")

if __name__ == '__main__':
    main()
