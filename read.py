import sqlite3
from tabulate import tabulate


def display_tables(db_name):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    def print_table(table_name):
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        headers = [desc[0] for desc in cursor.description]
        print(f"\n# {table_name}")
        if rows:
            print(
                tabulate(
                    rows,
                    headers=headers,
                    tablefmt="github",
                    stralign="left",
                    numalign="left",
                )
            )
        else:
            print("(empty table)")

    print_table("mods")
    print_table("mod_id_entries")

    conn.close()


if __name__ == "__main__":
    display_tables("mod_database.db")  # Change this to your actual DB path
