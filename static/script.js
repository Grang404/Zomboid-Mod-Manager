// Initialize the mod list
let mods = [];

async function loadMods() {
  try {
    const response = await fetch("/api/mods");
    mods = await response.json();
    renderMods();
  } catch (error) {
    console.error("Error loading mods:", error);
    alert("Error loading mods. Please check the console for details.");
  }
}

function renderMods() {
  const modList = document.getElementById("modList");
  modList.innerHTML = mods
    .map(
      (mod, index) => `
        <div class="mod-item" data-id="${mod.id}">
            <span class="drag-handle">⋮⋮</span>
            <input type="checkbox" class="mod-checkbox" 
                   ${mod.enabled ? "checked" : ""} 
                   onchange="toggleMod(${index})">
            <span class="mod-title">${mod.title}</span>
            <span class="mod-workshop-id">${mod.workshop_id}</span>
        </div>
    `,
    )
    .join("");

  // Initialize Sortable
  if (!window.sortable) {
    window.sortable = new Sortable(modList, {
      animation: 150,
      handle: ".drag-handle",
      dragClass: "dragging",
      onEnd: function (evt) {
        const item = mods[evt.oldIndex];
        mods.splice(evt.oldIndex, 1);
        mods.splice(evt.newIndex, 0, item);
      },
    });
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
      load_order: index,
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
      alert("Changes saved successfully!");
    } else {
      throw new Error("Failed to save changes");
    }
  } catch (error) {
    console.error("Error saving changes:", error);
    alert("Error saving changes. Please check the console for details.");
  }
}

// Load mods when the page loads
document.addEventListener("DOMContentLoaded", loadMods);
