import PySimpleGUI as sg
import sqlite3
from typing import List, Tuple


def load_mods_from_db() -> List[Tuple]:
    try:
        conn = sqlite3.connect("mod_database.db")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM mods ORDER BY load_order")
        mods = cursor.fetchall()
        conn.close()
        return mods
    except sqlite3.Error as e:
        sg.popup_error(f"Error loading mods: {str(e)}")
        return []


def save_mods_to_db(table_data):
    try:
        conn = sqlite3.connect("mods.db")
        cursor = conn.cursor()

        for i, row in enumerate(table_data):
            cursor.execute(
                """
                UPDATE mods 
                SET load_order = ?, enabled = ? 
                WHERE id = ?
                """,
                (i, row[1], row[0]),
            )

        conn.commit()
        conn.close()
        sg.popup("Changes saved successfully!")
    except sqlite3.Error as e:
        sg.popup_error(f"Error saving changes: {str(e)}")


def create_window():
    # Set the theme
    sg.theme("DefaultNoMoreNagging")

    # Load mods from database
    mods = load_mods_from_db()

    # Convert mods data for table
    table_data = [[mod[0], bool(mod[7]), mod[2]] for mod in mods]  # ID, Enabled, Title

    # Define the layout
    layout = [
        [sg.Text("Project Zomboid Mod Manager", font=("Helvetica", 16))],
        [
            sg.Table(
                values=table_data,
                headings=["ID", "Enabled", "Mod Title"],
                col_widths=[10, 8, 50],
                auto_size_columns=False,
                display_row_numbers=True,
                justification="left",
                num_rows=min(25, len(table_data)),
                key="-TABLE-",
                enable_events=True,
                enable_click_events=True,
                right_click_selects=True,
                bind_return_key=True,
            )
        ],
        [
            sg.Button("Move Up", key="-UP-"),
            sg.Button("Move Down", key="-DOWN-"),
            sg.Button("Toggle Enable", key="-TOGGLE-"),
            sg.Push(),
            sg.Button("Save Changes", key="-SAVE-"),
        ],
    ]

    return sg.Window(
        "Project Zomboid Mod Manager", layout, finalize=True, resizable=True
    )


def main():
    window = create_window()

    while True:
        event, values = window.read()

        if event == sg.WIN_CLOSED:
            break

        if event == "-UP-" and values["-TABLE-"]:
            selected_idx = values["-TABLE-"][0]
            if selected_idx > 0:
                table_data = window["-TABLE-"].get()
                # Swap rows
                table_data[selected_idx], table_data[selected_idx - 1] = (
                    table_data[selected_idx - 1],
                    table_data[selected_idx],
                )
                window["-TABLE-"].update(values=table_data)
                # Keep the moved item selected
                window["-TABLE-"].update(select_rows=[selected_idx - 1])

        if event == "-DOWN-" and values["-TABLE-"]:
            selected_idx = values["-TABLE-"][0]
            table_data = window["-TABLE-"].get()
            if selected_idx < len(table_data) - 1:
                # Swap rows
                table_data[selected_idx], table_data[selected_idx + 1] = (
                    table_data[selected_idx + 1],
                    table_data[selected_idx],
                )
                window["-TABLE-"].update(values=table_data)
                # Keep the moved item selected
                window["-TABLE-"].update(select_rows=[selected_idx + 1])

        if event == "-TOGGLE-" and values["-TABLE-"]:
            selected_idx = values["-TABLE-"][0]
            table_data = window["-TABLE-"].get()
            # Toggle the enabled status
            table_data[selected_idx][1] = not table_data[selected_idx][1]
            window["-TABLE-"].update(values=table_data)
            # Keep the item selected
            window["-TABLE-"].update(select_rows=[selected_idx])

        if event == "-SAVE-":
            table_data = window["-TABLE-"].get()
            save_mods_to_db(table_data)

    window.close()


if __name__ == "__main__":
    main()
