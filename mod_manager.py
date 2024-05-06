import os
import requests
from bs4 import BeautifulSoup
import sqlite3

def create_mod_db():
    # Connect to database
    conn = sqlite3.connect("mod_database.db")
    cursor = conn.cursor()

    # Create table if it does not exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS mods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workshop_id TEXT UNIQUE,
        title TEXT,
        url TEXT,
        mod_ids TEXT
    )
    ''')

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
                return server_path
            else:
                print("Invalid path. Please enter a valid path.")

def init_db(filepath):
    create_mod_db()
    # Connect to database
    conn = sqlite3.connect("mod_database.db")
    cursor = conn.cursor()

    workshop_items = extract_workshop_items(filepath)

    for i, workshop_id in enumerate(workshop_items, 1):
        url = get_url_from_workshopid(workshop_id)
        title = get_mod_title(url)
        mod_ids = get_mod_ids(url)
        mod_ids_str = ','.join(mod_ids)
        print(f"Adding Mod #{i} into database...\n"
            f"URL: {url}\n"
            f"Title: {title}\n"
            f"Workshop ID: {workshop_id}\n"
            f"Mod IDs: {mod_ids_str}\n")

        cursor.execute("INSERT INTO mods (workshop_id, title, url, mod_ids) VALUES (?, ?, ?, ?)", (workshop_id, title, url, mod_ids_str))

    conn.commit()
    conn.close()

def extract_workshop_items(filepath):
    # Pulls the WorkshopItems from the server.ini file.
    workshop_items = []
    with open(filepath, 'r') as file:
        for line in file:
            if line.startswith('WorkshopItems='):
                item_line = line.strip().split('=')[1]
                workshop_ids = item_line.split(';')
                for item in workshop_ids:
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
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')

        workshop_div = soup.find('div', {'class': 'workshopItemDescription'})

        if workshop_div:
            mod_ids = workshop_div.find_all(string=lambda text: "Mod ID:" in text)

            ids = []
            for mod_id in mod_ids:
                parts = mod_id.split(':')
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

def menu():

    while True:
        print(f"\n{" Menu ":=^50}")
        print("1. test")
        print("2. list db uwu")
        print("3. drop tables :O")
        print("4. Exit\n")

        choice = input("Enter your choice: \n")

        if choice == "1":
            # print("You selected Option 1.")
            serverpath = get_server_path()
            init_db(serverpath)
        elif choice == "2":
            # Connect to database
            conn = sqlite3.connect('mod_database.db')
            cursor = conn.cursor()

            # Execute SELECT query to retrieve all columns
            cursor.execute("SELECT * FROM mods")
            rows = cursor.fetchall()

            # Print the Workshop ID, URL, and any other relevant information
            for row in rows:
                print(f"Mod #{row[0]}:")
                print(f"Title: {row[2]}")
                print(f"URL: {row[3]}")
                print(f"Workshop ID: {row[1]}\n")

            # Close the connection
            conn.close()
        elif choice == "3":
            # print("You selected Option 3.")
            # Connect to the database

            conn = sqlite3.connect('mod_database.db')
            cursor = conn.cursor()

            # Execute the DROP TABLE statement
            cursor.execute("DROP TABLE IF EXISTS mods")

            # Commit the changes and close the connection
            conn.commit()
            conn.close()
        elif choice == "4":
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
