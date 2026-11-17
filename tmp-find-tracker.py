import os
import sqlite3

bases = [
    r"C:\Users\USER\AppData\Local\Google\Chrome\User Data",
    r"C:\Users\USER\AppData\Local\Microsoft\Edge\User Data",
]
needles = ("clickup", "linear.app", "HTL-06", "Bugs")
for base in bases:
    if not os.path.isdir(base):
        continue
    print("BASE", base)
    for prof in os.listdir(base):
        hist = os.path.join(base, prof, "History")
        if not os.path.isfile(hist):
            continue
        try:
            con = sqlite3.connect(f"file:{hist}?mode=ro", uri=True)
            rows = con.execute(
                "SELECT title, url FROM urls WHERE url LIKE '%clickup%' OR url LIKE '%linear.app%' OR title LIKE '%HTL%' OR title LIKE '%GrandStay%' ORDER BY last_visit_time DESC LIMIT 20"
            ).fetchall()
            print("---", prof, len(rows))
            for title, url in rows:
                print((title or "")[:80], "|", (url or "")[:160])
            con.close()
        except Exception as e:
            print("---", prof, "ERR", type(e).__name__, e)
