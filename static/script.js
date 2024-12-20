// Initialize the mod list
let mods = [];

async function loadMods() {
  try {
    const response = await fetch("/api/mods");
    mods = await response.json();
    console.log("Loaded mods:", mods); // Debug: Log the loaded mods
    renderMods();
  } catch (error) {
    console.error("Error loading mods:", error);
    alert("Error loading mods. Please check the console for details.");
  }
}

function moveToTop(index) {
  const item = mods[index];
  mods.splice(index, 1);
  mods.unshift(item);
  renderMods();
}

function moveToBottom(index) {
  const item = mods[index];
  mods.splice(index, 1);
  mods.push(item);
  renderMods();
}

function renderMods() {
  console.log("Rendering mods:", mods); // Debug: Log the mods before rendering
  const modList = document.getElementById("modList");
  modList.innerHTML = mods
    .map(
      (mod, index) => `
      <div class="mod-item" data-id="${mod.id}">
          <span class="mod-title">${mod.load_order}</span> <!-- Show load_order -->
          <span class="mod-title">${mod.title}</span>
          <div class="mod-controls">
              <button class="icon-button move-top" onclick="moveToTop(${index})" title="Move to top">
                <span class="material-symbols-outlined">
                keyboard_double_arrow_up
                </span>
              </button>
              <button class="icon-button move-bottom" onclick="moveToBottom(${index})" title="Move to bottom">
                <span class="material-symbols-outlined">
                keyboard_double_arrow_down
                </span>
              </button>
          </div>
          <div class="mod-actions">
              <input type="checkbox" class="mod-checkbox" 
                     ${mod.enabled ? "checked" : ""} 
                     onchange="toggleMod(${index})">
              <button class="icon-button delete-mod" onclick="deleteMod(${index})" title="Delete mod">
                  <span class="material-symbols-outlined">delete</span>
              </button>
          </div>
      </div>
      `,
    )
    .join("");
}

if (!window.sortable) {
  window.sortable = new Sortable(modList, {
    animation: 150,
    handle: ".mod-title",
    dragClass: "dragging",
    forceFallback: true,
    scroll: true,
    bubbleScroll: true,
    scrollSensitivity: 150,
    scrollSpeed: 20,
    onStart: function () {
      document.addEventListener("wheel", handleWheel, { passive: false });
    },
    onEnd: function (evt) {
      document.removeEventListener("wheel", handleWheel);

      // Get the moved item
      const item = mods[evt.oldIndex];

      // Re-arrange the mod list
      mods.splice(evt.oldIndex, 1);
      mods.splice(evt.newIndex, 0, item);

      // Update load_order for all mods based on the new positions
      mods.forEach((mod, index) => {
        mod.load_order = index + 1; // Assign load_order based on the position
      });

      // Re-render the updated list with new load_order
      renderMods();
    },
  });
}

function handleWheel(e) {
  e.preventDefault();
  const modList = document.getElementById("modList");
  if (window.sortable.dragging) {
    modList.scrollTop += e.deltaY;
  }
}

function toggleMod(index) {
  mods[index].enabled = !mods[index].enabled;
}

async function saveMods() {
  const modOrder = Array.from(document.querySelectorAll(".mod-item")).map(
    (item, index) => ({
      id: parseInt(item.dataset.id),
      enabled: item.querySelector(".mod-checkbox").checked,
      load_order: index + 1,
    }),
  );

  try {
    const response = await fetch("/api/mods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(modOrder),
    });
    if (response.ok) {
      alert("Changes saved successfully! ;3");
      window.location.reload();
    } else {
      throw new Error("Failed to save changes");
    }
  } catch (error) {
    console.error("Error saving changes:", error);
    alert("Error saving changes. Please check the console for details.");
  }
}

// TODO: Only delete mod on the front end and then delete any deleted mods from the db with the save button
function deleteMod(index) {
  const modId = mods[index].id; // Get the ID of the mod to be deleted

  if (confirm("Are you sure you want to delete this mod?")) {
    // Send a DELETE request to the Flask API
    fetch(`/api/mods/${modId}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.ok) {
          alert("Mod deleted successfully! ;3");
          mods.splice(index, 1); // Remove the mod from the list in the front-end
          renderMods(); // Re-render the updated mod list
        } else {
          throw new Error("Failed to delete mod");
        }
      })
      .catch((error) => {
        console.error("Error deleting mod:", error);
        alert("Error deleting mod. Please check the console for details.");
      });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("addCollection")
    .addEventListener("click", function () {
      document.getElementById("dialogBox").style.display = "block";
      document.getElementById("overlay").style.display = "block";
    });

  document.querySelector(".close-btn").addEventListener("click", function () {
    document.getElementById("dialogBox").style.display = "none";
    document.getElementById("overlay").style.display = "none";
  });

  document.getElementById("overlay").addEventListener("click", function () {
    document.getElementById("dialogBox").style.display = "none";
    document.getElementById("overlay").style.display = "none";
  });

  loadMods();
});
