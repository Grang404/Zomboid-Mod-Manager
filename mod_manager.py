import requests
from bs4 import BeautifulSoup
import sqlite3


class ModManager:
    def __init__(self, db_name="mod_database.db"):
        self.db_name = db_name
        self.server_path = None
        self.create_mod_db()
        self.create_settings_table()

    def create_mod_db(self):
        """Initialize the SQLite database with the mods table."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS mods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workshop_id TEXT UNIQUE,
                title TEXT,
                url TEXT,
                mod_ids TEXT,
                map_folders TEXT,
                load_order INTEGER,
                enabled BOOLEAN DEFAULT 1
            )
        """
        )

        conn.commit()
        conn.close()

    def create_settings_table(self):
        """Create the settings table if it does not exist."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    def save_server_ini(self, ini_content):
        """Save the server.ini content to the settings table."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        # Insert or update the server.ini content in the settings table
        cursor.execute(
            """
            INSERT OR REPLACE INTO settings (key, value)
            VALUES ('server_ini', ?)
            """,
            (ini_content,),
        )

        conn.commit()
        conn.close()

    def get_server_ini(self):
        """Retrieve the server.ini content from the settings table."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT value FROM settings WHERE key = 'server_ini'
            """
        )
        result = cursor.fetchone()
        conn.close()

        if result:
            return result[0]
        else:
            return None  # Return None if no server.ini is found

    def add_mod_to_database(self, workshop_id, title, url, mod_ids, map_folders):
        """Add a mod to the database with its details."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM mods WHERE workshop_id=?", (workshop_id,))
        existing_mod = cursor.fetchone()

        if existing_mod:
            print(f"Mod with Workshop ID {workshop_id} already exists in the database.")
        else:
            print(
                f"Adding Mod into database...\n"
                f"URL: {url}\n"
                f"Title: {title}\n"
                f"Workshop ID: {workshop_id}\n"
                f"Mod IDs: {', '.join(mod_ids)}\n"
                f"Map Folders: {', '.join(map_folders)}\n"
                f"Enabled: True\n"
            )

            # Insert the mod, using the primary key `id` as the `load_order`
            cursor.execute(
                "INSERT INTO mods (workshop_id, title, url, mod_ids, map_folders, load_order, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    workshop_id,
                    title,
                    url,
                    ", ".join(mod_ids),
                    ", ".join(map_folders),
                    None,  # We will let SQLite assign the id, and use that as load_order
                    True,
                ),
            )

            # After the insertion, update the `load_order` to be the same as the `id`
            last_inserted_id = cursor.lastrowid
            cursor.execute(
                "UPDATE mods SET load_order = ? WHERE id = ?",
                (last_inserted_id, last_inserted_id),
            )

        conn.commit()
        conn.close()

    def get_mod_title(self, url):
        """Get the title of a mod from its Steam Workshop URL."""
        response = requests.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            workshop_title = soup.find("div", class_="workshopItemTitle")
            return workshop_title.text.strip() if workshop_title else None
        return None

    def get_mod_ids(self, url):
        """Extract mod IDs from the Steam Workshop page."""
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            workshop_div = soup.find("div", {"class": "workshopItemDescription"})

            if workshop_div:
                mod_ids = workshop_div.find_all(string=lambda text: "Mod ID:" in text)
                return [
                    parts[1].strip()
                    for mod_id in mod_ids
                    if len(parts := mod_id.split(":")) > 1
                ]
        return []

    def get_mod_map_folders(self, url):
        """Extract map folder names from the Steam Workshop page."""
        response = requests.get(url)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            map_folder_div = soup.find("div", {"class": "workshopItemDescription"})

            if map_folder_div:
                map_folders = map_folder_div.find_all(
                    string=lambda text: "Map Folder" in text
                )
                return [
                    parts[1].strip()
                    for map_folder in map_folders
                    if len(parts := map_folder.split(":")) > 1
                ]
        return []

    def get_steam_collection_urls(self, url):
        """Get all mod URLs from a Steam Workshop collection."""
        response = requests.get(url)
        soup = BeautifulSoup(response.content, "html.parser")
        collection_children_div = soup.find("div", class_="collectionChildren")

        if collection_children_div:
            links = collection_children_div.find_all("a")
            return list(
                {
                    href
                    for link in links
                    if (href := link.get("href"))
                    and "https://steamcommunity.com/sharedfiles/filedetails/?id="
                    in href
                }
            )
        return []

    def get_workshop_ids(self, url):
        """Extract the workshop ID from a Steam Workshop URL."""
        return "".join(filter(str.isdigit, url.split("?id=")[1]))

    def get_mods_from_collection(self, url):
        """Process all mods in a Steam Workshop collection."""
        url_list = self.get_steam_collection_urls(url)

        for url in url_list:
            mod_title = self.get_mod_title(url)
            mod_ids = self.get_mod_ids(url)
            workshop_id = self.get_workshop_ids(url)
            map_folders = self.get_mod_map_folders(url)

            self.add_mod_to_database(workshop_id, mod_title, url, mod_ids, map_folders)

    def add_mods_to_config(self, config_content):
        """Update the config content with mod information."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        # Get mods ordered by load_order
        cursor.execute(
            """
            SELECT workshop_id, mod_ids, map_folders 
            FROM mods 
            WHERE enabled = 1
            ORDER BY load_order
        """
        )
        rows = cursor.fetchall()
        conn.close()

        workshop_ids = []
        all_mod_names = []
        all_map_names = []

        # Process mods in load order
        for row in rows:
            workshop_id, mod_ids_str, map_folders_str = row
            if mod_ids_str:
                for mod_group in mod_ids_str.split(";;"):
                    all_mod_names.extend(
                        [mod.strip() for mod in mod_group.split(",") if mod.strip()]
                    )
            if map_folders_str:
                for map_group in map_folders_str.split(";;"):
                    all_map_names.extend(
                        [
                            map_name.strip()
                            for map_name in map_group.split(",")
                            if map_name.strip()
                        ]
                    )
            if workshop_id:
                workshop_ids.append(workshop_id)

        workshop_ids_string = ";".join(workshop_ids)
        mod_names_string = ";".join(all_mod_names)
        map_names_string = ";".join(all_map_names)

        # Process the config content line by line
        lines = config_content.splitlines()
        new_lines = []

        for line in lines:
            if line.startswith("WorkshopItems="):
                new_lines.append(f"WorkshopItems={workshop_ids_string}")
            elif line.startswith("Mods="):
                new_lines.append(f"Mods={mod_names_string}")
            elif line.startswith("Map="):
                new_lines.append(f"Map={map_names_string}")
            else:
                new_lines.append(line)

        # Join lines with newline and add a final newline
        processed_content = "\n".join(new_lines) + "\n"

        print(f"Updated WorkshopItems with {len(workshop_ids)} workshop IDs")
        print(f"Updated Mods with {len(all_mod_names)} mod names")
        print(f"Updated Map with {len(all_map_names)} map names")

        return processed_content

    def get_mods_config(self):
        """Generate config content for mods."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()

        # Get mods ordered by load_order
        cursor.execute(
            """
            SELECT workshop_id, mod_ids, map_folders 
            FROM mods 
            WHERE enabled = 1
            ORDER BY load_order
            """
        )
        rows = cursor.fetchall()
        conn.close()

        workshop_ids = []
        mod_names = []
        map_names = []

        # Process mods in load order
        for row in rows:
            workshop_id, mod_ids_str, map_folders_str = row

            # Process mod_ids if available
            if mod_ids_str:
                for mod_group in mod_ids_str.split(";;"):
                    mod_names.extend(
                        [mod.strip() for mod in mod_group.split(",") if mod.strip()]
                    )

            # Process map_folders if available
            if map_folders_str:
                for map_group in map_folders_str.split(";;"):
                    map_names.extend(
                        [
                            map_name.strip()
                            for map_name in map_group.split(",")
                            if map_name.strip()
                        ]
                    )

            # Add workshop_id to list
            if workshop_id:
                workshop_ids.append(workshop_id)

        # Format the values into strings
        workshop_ids_string = ";".join(workshop_ids)
        mod_names_string = ";".join(mod_names)
        map_names_string = ";".join(map_names)

        # Generate the final config content
        config_content = f"WorkshopItems={workshop_ids_string}\n"
        config_content += f"Mods={mod_names_string}\n"
        config_content += f"Map={map_names_string}\n"

        return config_content

    def list_mods(self):
        """List all mods in the database."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM mods")
        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            print(f"Mod #{row[0]}")
            print(f"  Workshop ID: {row[1]}")
            print(f"  Title:       {row[2]}")
            print(f"  URL:         {row[3]}")
            print(f"  Mod IDs:     {row[4]}")
            print(f"  Map Folders: {row[5]}")
            print("-" * 50)

    def clear_database(self):
        """Delete all mods from the database."""
        conn = sqlite3.connect(self.db_name)
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS mods")
        conn.commit()
        conn.close()
        self.create_mod_db()
