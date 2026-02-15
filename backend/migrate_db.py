import sqlite3
import os

db_path = 'instance/db.sqlite3'
if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE user ADD COLUMN profile_pic TEXT;")
        conn.commit()
        conn.close()
        print("Successfully added profile_pic column to user table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column profile_pic already exists.")
        else:
            print(f"Error: {e}")
else:
    print(f"Database not found at {db_path}")
