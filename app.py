from flask import (
    Flask,
    render_template,
    jsonify,
    request,
    send_from_directory,
    redirect,
    url_for,
    send_file,
)
import sqlite3
import os
from mod_manager import ModManager
from io import BytesIO

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
        mods_list = []
        for mod in mods:
            mods_list.append(
                {
                    "id": mod["id"],
                    "workshop_id": mod["workshop_id"],
                    "title": mod["title"],
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


@app.route("/api/save_server_config", methods=["POST"])
def save_server_ini():
    data = request.get_json()
    server_ini_content = data.get("server_ini")

    if server_ini_content:
        mod_manager.save_server_ini(server_ini_content)  # Save server.ini content
        return jsonify({"message": "Server.ini saved successfully!"}), 200
    else:
        return jsonify({"error": "No server.ini content provided."}), 400


@app.route("/api/get_server_ini", methods=["GET"])
def get_server_ini():
    server_ini_content = (
        mod_manager.get_server_ini()
    )  # Retrieve saved server.ini content

    if server_ini_content:
        return jsonify({"server_ini": server_ini_content}), 200
    else:
        return jsonify({"message": "No server.ini found."}), 404


@app.route("/api/process_config", methods=["POST"])
def process_config():
    if "config_file" not in request.files:
        return "No file uploaded", 400

    file = request.files["config_file"]
    if file.filename == "":
        return "No file selected", 400

    try:
        # Read the uploaded file content
        file_content = file.read().decode("utf-8")

        # Process the file using mod_manager
        mod_manager = ModManager()
        processed_content = mod_manager.add_mods_to_config(file_content)

        # Create BytesIO object for the processed content
        mem = BytesIO()
        mem.write(processed_content.encode("utf-8"))
        mem.seek(0)

        return send_file(
            mem, as_attachment=True, download_name="server.ini", mimetype="text/plain"
        )

    except Exception as e:
        return str(e), 500


@app.route("/get_mods_from_url", methods=["POST"])
def get_mods_from_url():
    try:
        data = request.get_json()
        url = data.get("url")

        if not url:
            return jsonify({"error": "URL is required"}), 400

        # Call your mod manager function
        mods = mod_manager.get_mods_from_collection(url)

        return jsonify({"success": True, "mods": mods})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get_mods_config")
def get_mods_config():
    """Fetch the config content for mods."""
    config_content = mod_manager.get_mods_config()

    return jsonify({"config_content": config_content})


if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    os.makedirs("templates", exist_ok=True)
    print(app.url_map)
    app.run(debug=True)
