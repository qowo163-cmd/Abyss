import pandas as pd
import mysql.connector
import os
import json

excel_path = "/home/ubuntu/upload/1111.xlsx"
df = pd.read_excel(excel_path, sheet_name="어비스")
print("Total rows in 어비스:", len(df))

db_url = os.environ.get("DATABASE_URL", "mysql://root:@localhost:3306/mixmaster")
# parse mysql url: mysql://user:pass@host:port/dbname
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

cursor.execute("DELETE FROM monsters")

count = 0
for idx, row in df.iterrows():
    name = row.get("이름")
    if pd.isna(name) or str(name).strip() == "":
        continue
    name = str(name).strip()
    
    monster_id = str(name)
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
    
    sql = """
    INSERT INTO monsters (id, name, level, attribute, type, habitat, acquire, main, sub, main2, sub2, base_level, max_level, x_antibody)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    vals = (
        monster_id, name, level, attribute, type_val, habitat, acquire,
        main_m, sub_m, main2 if main2 != "nan" else None, sub2 if sub2 != "nan" else None,
        base_level, max_level, x_antibody
    )
    cursor.execute(sql, vals)
    count += 1

conn.commit()
cursor.close()
conn.close()
print(f"Successfully imported {count} monsters from 1111.xlsx into MySQL via Python!")
