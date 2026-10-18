import pandas as pd
import mysql.connector
import os
import json

excel_path = "/home/ubuntu/upload/1111.xlsx"
df = pd.read_excel(excel_path, sheet_name="어비스")
print("Total rows in 어비스:", len(df))

db_url = os.environ.get("DATABASE_URL", "mysql://root:@localhost:3306/mixmaster")
import urllib.parse as up
url_parsed = up.urlparse(db_url)
username = url_parsed.username or "root"
password = url_parsed.password or ""
database = url_parsed.path[1:] or "mixmaster"
host = url_parsed.hostname or "localhost"
port = url_parsed.port or 3306

conn = mysql.connector.connect(
    host=host,
    user=username,
    password=password,
    database=database,
    port=port
)
cursor = conn.cursor()

monsters = []
for idx, row in df.iterrows():
    name = row.get("이름")
    if pd.isna(name) or str(name).strip() == "":
        continue
    name = str(name).strip()
    
    monster_id = f"m_{idx+1}"
    level = str(row.get("레벨", "")) if not pd.isna(row.get("레벨")) else ""
    attribute = str(row.get("속성", "")) if not pd.isna(row.get("속성")) else ""
    type_val = str(row.get("장단", "")) if not pd.isna(row.get("장단")) else ""
    habitat = str(row.get("서식지", "")) if not pd.isna(row.get("서식지")) else ""
    acquire = str(row.get("획득여부", "")) if not pd.isna(row.get("획득여부")) else ""
    main_m = str(row.get("메인", "")) if not pd.isna(row.get("메인")) else ""
    sub_m = str(row.get("서브", "")) if not pd.isna(row.get("서브")) else ""
    main2 = str(row.get("메인2", "")) if not pd.isna(row.get("메인2")) else ""
    sub2 = str(row.get("서브2", "")) if not pd.isna(row.get("서브2")) else ""
    base_level = int(row.get("기본레벨", 1)) if not pd.isna(row.get("기본레벨")) else 1
    max_level = int(row.get("최대레벨", 100)) if not pd.isna(row.get("최대레벨")) else 100
    x_antibody = int(row.get("x항체", 0)) if not pd.isna(row.get("x항체")) else 0
    
    monster = {
        "id": monster_id,
        "name": name,
        "level": level,
        "attribute": attribute,
        "type": type_val,
        "habitat": habitat,
        "acquire": acquire,
        "main": main_m,
        "sub": sub_m,
        "main2": main2 if main2 and main2 != "nan" else "",
        "sub2": sub2 if sub2 and sub2 != "nan" else "",
        "baseLevel": base_level,
        "maxLevel": max_level,
        "xAntibody": x_antibody,
        "imageUrl": None
    }
    monsters.append(monster)

print(f"Parsed {len(monsters)} valid monsters from 어비스 sheet.")

# monster_data_store에 JSON 문자열로 저장
data_json = json.dumps(monsters, ensure_ascii=False)
sql = """
INSERT INTO monster_data_store (id, data, updated_at)
VALUES ('current', %s, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP
"""
cursor.execute(sql, (data_json,))
conn.commit()

# fallback JSON 파일에도 저장
fallback_path = "/home/ubuntu/mixmaster-db/server/data/monsters.json"
os.makedirs(os.path.dirname(fallback_path), exist_ok=True)
with open(fallback_path, "w", encoding="utf-8") as f:
    json.dump(monsters, f, ensure_ascii=False, indent=2)

cursor.close()
conn.close()
print("Successfully stored 1111.xlsx monsters into monster_data_store and fallback JSON!")
