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
  const modList = document.getElementById("modList");
  modList.innerHTML = mods
    .map(
      (mod, index) => `
                <div class="mod-item" data-id="${mod.id}">
                    <div class="mod-controls">
                        <button class="icon-button move-top" onclick="moveToTop(${index})" title="Move to top">↑</button>
                        <button class="icon-button move-bottom" onclick="moveToBottom(${index})" title="Move to bottom">↓</button>
                    </div>
                    <span class="mod-title">${mod.title}</span>
                    <div class="mod-actions">
                        <input type="checkbox" class="mod-checkbox" 
                               ${mod.enabled ? "checked" : ""} 
                               onchange="toggleMod(${index})">
                        <button class="icon-button delete-mod" title="Delete mod">🗑️</button>
                    </div>
                </div>
            `,
    )
    .join("");

  // Initialize Sortable with improved scrolling
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
        const item = mods[evt.oldIndex];
        mods.splice(evt.oldIndex, 1);
        mods.splice(evt.newIndex, 0, item);
      },
    });
  }
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
      alert("Changes saved successfully! ;3");
    } else {
      throw new Error("Failed to save changes");
    }
  } catch (error) {
    console.error("Error saving changes:", error);
    alert("Error saving changes. Please check the console for details.");
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
