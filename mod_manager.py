import os
import requests
from bs4 import BeautifulSoup
import sqlite3
from tabulate import tabulate


def create_mod_db():

    # try:
    #     sqlite3.connect("mod_database.db")
    # except sqlite3.OperationalError:
    #     print("SQLite is not installed. Installing...")
    #     install_sqlite()
    #     # Retry connection
    #     sqlite3.connect("mod_database.db")

    conn = sqlite3.connect("mod_database.db")
    cursor = conn.cursor()

    # Create table if it does not exist
    cursor.execute(
        """
    CREATE TABLE IF NOT EXISTS mods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workshop_id TEXT UNIQUE,
        title TEXT,
        url TEXT,
        mod_ids TEXT,
        map_folders TEXT
    )
    """
    )

    # Commit and close connection
    conn.commit()
    conn.close()


def get_server_path():
    # This function retrieves the location of the server.ini file.
    while True:
        if os.path.exists("server_config_path.txt"):
            with open("server_config_path.txt", "r") as file:
                server_path = file.read().strip()
                if os.path.exists(server_path):
                    return server_path
                else:
                    print("Invalid server path found in server_config_path.txt.")
                    os.remove("server_config_path.txt")
        else:
            server_path = input("Enter the path to your server.ini: \n")
            if os.path.exists(server_path):
                with open("server_config_path.txt", "w") as file:
                    file.write(server_path)
                    init_db(server_path)
                return server_path
            else:
                print("Invalid path. Please enter a valid path.")


def add_mod_to_database(workshop_id, title, url, mod_ids, map_folders):
    conn = sqlite3.connect("mod_database.db")
    cursor = conn.cursor()

    # Check if the item already exists in the database
    cursor.execute("SELECT * FROM mods WHERE workshop_id=?", (workshop_id,))
    existing_mod = cursor.fetchone()

    if existing_mod:
        print(
            f"Mod with Workshop ID {
              workshop_id} already exists in the database."
        )
    else:
        # Insert the new item into the database
        print(
            f"Adding Mod into database...\n"
            f"URL: {url}\n"
            f"Title: {title}\n"
            f"Workshop ID: {workshop_id}\n"
            f"Mod IDs: {', '.join(mod_ids)}\n"
            f"Map Folders: {', '.join(map_folders)}\n"
        )
        cursor.execute(
            "INSERT INTO mods (workshop_id, title, url, mod_ids, map_folders) VALUES (?, ?, ?, ?, ?)",
            (workshop_id, title, url, ", ".join(mod_ids), ", ".join(map_folders)),
        )

    conn.commit()
    conn.close()


def init_db(filepath):
    create_mod_db()
    workshop_items = extract_workshop_items(filepath)

    for workshop_id in workshop_items:
        url = get_url_from_workshopid(workshop_id)
        title = get_mod_title(url)
        mod_ids = get_mod_ids(url)
        map_folders = get_mod_map_folders(url)

        add_mod_to_database(workshop_id, title, url, mod_ids, map_folders)


def extract_workshop_items(filepath):
    # Pulls the WorkshopItems from the server.ini file.
    workshop_items = []
    with open(filepath, "w") as file:
        for line in file:
            if line.startswith("WorkshopItems="):
                item_line = line.strip().split("=")[1]
                workshop_ids = item_line.split(";")
                for item in workshop_ids:
                    if item:
                        workshop_items.append(int(item))
    return workshop_items


def get_url_from_workshopid(workshop_id):
    # This function gets the Steam Workshop URL by appending the Workshop ID and returns a list of URLs.
    url_prefix = "https://steamcommunity.com/sharedfiles/filedetails/?id="
    return f"{url_prefix}{workshop_id}"


def get_mod_title(url):
    # Grabs the title of the mod from the workshop URL.
    response = requests.get(url)

    if response.status_code == 200:
        html_content = response.text
        soup = BeautifulSoup(html_content, "html.parser")
        workshop_title = soup.find("div", class_="workshopItemTitle")

        if workshop_title:
            title = workshop_title.text.strip()
            return title
        else:
            return None


def get_mod_ids(url):
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        html = response.text
        soup = BeautifulSoup(html, "html.parser")

        workshop_div = soup.find("div", {"class": "workshopItemDescription"})

        if workshop_div:
            mod_ids = workshop_div.find_all(string=lambda text: "Mod ID:" in text)

            ids = []
            for mod_id in mod_ids:
                parts = mod_id.split(":")
                if len(parts) > 1:
                    mod_id_value = parts[1].strip()
                    ids.append(mod_id_value)
            return ids
        else:
            print(f"Div not found for mod at {url}.")
            return []
    else:
        print(f"Failed to retrieve the webpage for {url}.")
        return []


def get_mod_map_folders(url):
    response = requests.get(url)

    if response.status_code == 200:
        html = response.text
        soup = BeautifulSoup(html, "html.parser")

        map_folder_div = soup.find("div", {"class": "workshopItemDescription"})

        if map_folder_div:
            map_folders = map_folder_div.find_all(
                string=lambda text: "Map Folder" in text
            )

            folders = []
            for map_folder in map_folders:
                parts = map_folder.split(":")
                if len(parts) > 1:
                    folder_value = parts[1].strip()
                    folders.append(folder_value)
            return folders
        else:
            print(f"Div not found for mod at {url}")
            return []
    else:
        print(f"Failed to retrieve the webpage for {url}.")
        return []


def get_steam_collection_urls(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.content, "html.parser")

    # Find the collectionChildren div
    collection_children_div = soup.find("div", class_="collectionChildren")

    if collection_children_div:
        links = collection_children_div.find_all("a")
        desired_urls = set()
        for link in links:
            href = link.get("href")
            if (
                href
                and "https://steamcommunity.com/sharedfiles/filedetails/?id=" in href
            ):
                desired_urls.add(href)

        return list(desired_urls)
    else:
        print("the 'collectionChildren' div was not found on the webpage.")
        return []


def get_workshop_ids(url):
    workshop_id = "".join(filter(str.isdigit, url.split("?id=")[1]))

    return workshop_id


def get_mods_from_collection(url):
    url_list = get_steam_collection_urls(url)

    for url in url_list:
        mod_title = get_mod_title(url)
        mod_ids = get_mod_ids(url)
        workshop_id = get_workshop_ids(url)
        map_folders = get_mod_map_folders(url)

        add_mod_to_database(workshop_id, mod_title, url, mod_ids, map_folders)


def add_mods_to_config():
    conn = sqlite3.connect("mod_database.db")
    cursor = conn.cursor()

    # Fetch workshop_ids, mod_ids, and maps
    cursor.execute("SELECT workshop_id, mod_ids, map_folders FROM mods")
    rows = cursor.fetchall()
    conn.close()

    # Process workshop_ids, mod_ids, and maps
    workshop_ids = []
    all_mod_names = []
    all_map_names = []

    for row in rows:
        workshop_id = row[0]

        # Process mod_ids
        if row[1]:
            mod_groups = row[1].split(";;")
            for mod_group in mod_groups:
                # Split each group by comma and filter out empty strings
                mod_names = [mod.strip() for mod in mod_group.split(",") if mod.strip()]
                all_mod_names.extend(mod_names)

        # Process map_folders
        if row[2]:
            map_groups = row[2].split(";;")
            for map_group in map_groups:
                # Split each group by comma and filter out empty strings
                map_names = [
                    map_name.strip()
                    for map_name in map_group.split(",")
                    if map_name.strip()
                ]
                all_map_names.extend(map_names)

        # Add workshop_id if it's not empty
        if workshop_id:
            workshop_ids.append(workshop_id)

    # Get server path
    server_path = get_server_path()

    # Convert lists to semicolon-separated strings
    workshop_ids_string = ";".join(workshop_ids)
    mod_names_string = ";".join(all_mod_names)
    map_names_string = ";".join(all_map_names)

    # Read the file
    with open(server_path, "r") as file:
        lines = file.readlines()

    # Modify the lines
    for i, line in enumerate(lines):
        if line.startswith("WorkshopItems="):
            lines[i] = f"WorkshopItems={workshop_ids_string}\n"
        elif line.startswith("Mods="):
            lines[i] = f"Mods={mod_names_string}\n"
        elif line.startswith("Map="):
            lines[i] = f"Map={map_names_string}\n"

    # Write the modified lines
    with open(server_path, "w") as file:
        file.writelines(lines)

    print(f"Updated WorkshopItems with {len(workshop_ids)} workshop IDs")
    print(f"Updated Mods with {len(all_mod_names)} mod names")
    print(f"Updated Map with {len(all_map_names)} map names")


def menu():

    while True:
        print(f"\n{" Menu ":=^50}")
        print("1. Add mods from Steam Workshop collection")
        print("2. List installed mods")
        print("3. Delete all mods")
        print("4. Add mods to config")
        print("5. Exit\n")

        choice = input("Enter your choice: \n")

        if choice == "1":
            url = input("Enter your Steam Workshop collection URL.\n")
            get_mods_from_collection(url)

        elif choice == "2":
            conn = sqlite3.connect("mod_database.db")
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
        elif choice == "3":
            conn = sqlite3.connect("mod_database.db")
            cursor = conn.cursor()
            # Execute the DROP TABLE statement
            cursor.execute("DROP TABLE IF EXISTS mods")
            conn.commit()
            conn.close()

        elif choice == "4":
            add_mods_to_config()

        elif choice == "5":
            print("Exiting the program.")
            break
        else:
            print("Invalid choice. Please try again.")


def main():
    create_mod_db()
    get_server_path()
    menu()


if __name__ == "__main__":
    main()
