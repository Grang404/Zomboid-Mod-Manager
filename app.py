from flask import (
    Flask,
    render_template,
    jsonify,
    request,
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


@app.route("/api/mods", methods=["GET"])
def get_mods():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM mods ORDER BY load_order")
        mods = cursor.fetchall()
        mods_list = []
        for mod in mods:
            mods_list.append(
                {
                    "id": mod["id"],
                    "workshop_id": mod["workshop_id"],
                    "title": mod["title"],
                    "url": mod["url"],
                    "mod_ids": mod["mod_ids"],
                    "enabled": bool(mod["enabled"]),
                    "load_order": mod["load_order"],
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
        if mods is None:
            return jsonify({"error": "Invalid or missing JSON in request body"}), 400

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


@app.route("/api/mods/<int:id>", methods=["DELETE"])
def delete_mod(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM mods WHERE id = ?", (id,))
        conn.commit()
        return jsonify({"message": "Mod deleted successfully!"}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/toggle_mod_id", methods=["POST"])
def toggle_mod_id():
    data = request.get_json()
    mod_id_entry_id = data.get("mod_id_entry_id")
    enabled = data.get("enabled")
    parent_mod_id = data.get("parent_mod_id")

    # Process the data (for example, toggle the enabled state in the database)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Update the mod_id state in the database
        cursor.execute(
            """
            UPDATE mod_id_entries
            SET enabled = ?
            WHERE id = ? AND parent_mod_id = ?
            """,
            (enabled, mod_id_entry_id, parent_mod_id),
        )
        conn.commit()
        conn.close()

        return jsonify({"success": True})

    except Exception as e:
        print(f"Error toggling mod ID: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/get_mod_ids/<int:mod_id>", methods=["GET"])
def api_get_mod_ids(mod_id):
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, mod_id, enabled, parent_mod_id
            FROM mod_id_entries
            WHERE mod_id = ?
            """,
            (mod_id,),
        )
        mod_entry = cursor.fetchone()

        if mod_entry:
            mod_state = {
                "mod_id": mod_entry["mod_id"],
                "enabled": mod_entry["enabled"],
                "parent_mod_id": mod_entry["parent_mod_id"],
            }
        else:
            mod_state = {}

    except Exception as e:
        print(f"Error fetching mod ID state: {e}")
        mod_state = {}

    finally:
        conn.close()

    return jsonify({"mod_state": mod_state})


@app.route("/update_mod_state/<int:mod_id>", methods=["POST"])
def update_mod_state(mod_id):
    request_data = request.get_json()
    enabled = request_data.get("enabled")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE mod_id_entries
            SET enabled = ?
            WHERE mod_id = ?
            """,
            (enabled, mod_id),
        )
        conn.commit()
    except Exception as e:
        print(f"Error updating mod state: {e}")
        return jsonify({"error": "Failed to update mod state"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Mod state updated successfully"})


@app.route("/get_mods_from_url", methods=["POST"])
def get_mods_from_url():
    try:
        data = request.get_json()
        url = data["url"]
        url_type = data["type"]

        if not url:
            return jsonify({"error": "URL is required"}), 400

        if not url_type:
            return jsonify({"error": "Both fields empty"}), 400

        if url_type == "collection":
            mods = mod_manager.get_mods_from_collection(url)
        else:
            mods = mod_manager.get_mod_from_url(url)

        return jsonify({"success": True, "mods": mods})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    os.makedirs("templates", exist_ok=True)
    # print(app.url_map)
    app.run(debug=True)
