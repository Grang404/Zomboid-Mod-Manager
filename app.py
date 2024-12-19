from flask import (
    Flask,
    render_template,
    jsonify,
    request,
    send_from_directory,
    redirect,
    url_for,
)
import sqlite3
import os
from mod_manager import ModManager

mod_manager = ModManager()
app = Flask(__name__)


def get_db_connection():
    conn = sqlite3.connect(mod_manager.db_name)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/static/<path:path>")
def send_static(path):
    return send_from_directory("static", path)


@app.route("/api/mods", methods=["GET"])
def get_mods():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM mods ORDER BY load_order")
        mods = cursor.fetchall()

        # Convert rows to dictionaries
        mods_list = []
        for mod in mods:
            mods_list.append(
                {
                    "id": mod["id"],
                    "workshop_id": mod["workshop_id"],
                    "title": mod["title"],
                    "enabled": bool(mod["enabled"]),
                }
            )

        return jsonify(mods_list)

    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


@app.route("/api/mods", methods=["POST"])
def update_mods():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        mods = request.json

        # Update each mod's load order and enabled status
        for mod in mods:
            cursor.execute(
                """
                UPDATE mods 
                SET load_order = ?, enabled = ? 
                WHERE id = ?
            """,
                (mod["load_order"], mod["enabled"], mod["id"]),
            )

        conn.commit()
        return jsonify({"message": "Changes saved successfully"})

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()


@app.route("/process_url", methods=["POST"])
def process_url():
    url = request.form["url"]
    mod_manager.get_mods_from_collection(url)
    return redirect(url_for("index"))


if __name__ == "__main__":
    # Create necessary directories if they don't exist
    os.makedirs("static", exist_ok=True)
    os.makedirs("templates", exist_ok=True)

    # Start the Flask app
    app.run(debug=True)
