// Initialize the mod list
let mods = [];

async function loadMods() {
  try {
    const response = await fetch("/api/mods");
    mods = await response.json();
    console.log("Loaded mods:", mods);
    renderMods();
  } catch (error) {
    console.error("Error loading mods:", error);
    alert("Error loading mods. Please check the console for details.");
  }
}

// Trigger the modal after saving mods (in saveMods function)
async function saveMods() {
  const modOrder = Array.from(document.querySelectorAll(".mod-item")).map(
    (item, index) => ({
      id: parseInt(item.dataset.id),
      enabled: item.querySelector(".mod-checkbox").checked,
      load_order: index + 1,
    }),
  );
  // TODO: Change alert(), kinda ugly
  try {
    const response = await fetch("/api/mods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(modOrder),
    });

    if (response.ok) {
      console.log("mods saved");
    } else {
      throw new Error("Failed to save changes");
    }
  } catch (error) {
    console.error("Error saving changes:", error);
    alert("Error saving changes. Please check the console for details.");
  }
}

async function checkMissingModID() {
  try {
    const response = await fetch("/api/mods");
    const mods = await response.json();
    console.log("Mods:", mods);

    const missingModIDs = mods.filter((mod) => {
      const modId = String(mod.mod_ids);
      console.log(`Checking mod.mod_ids for mod "${mod.title}":`, modId);
      return !modId || modId.trim() === "";
    });

    const warningIcon = document.getElementById("warning-icon");
    warningIcon.addEventListener("click", () => {
      if (missingModIDs.length > 0) {
        // Get modal
        const modal = document.getElementById("modIdsModal");
        const modalBody = modal.querySelector(".modal-body");
        const modList = missingModIDs
          .map((mod) => `<p>${mod.title}</p>`)
          .join("");
        modalBody.innerHTML = `${modList}`;
        modal.style.display = "block";

        const closeModal = modal.querySelector(".close-modal");
        closeModal.addEventListener("click", () => {
          modal.style.display = "none";
        });

        window.addEventListener("click", (event) => {
          if (event.target === modal) {
            modal.style.display = "none";
          }
        });
      }
    });
  } catch (error) {
    console.error("Error checking missing mod_id:", error);
    alert("Error checking mods. Please check the console for details.");
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
  console.log("Rendering mods:", mods);
  const modList = document.getElementById("modList");
  modList.innerHTML = mods
    .map(
      (mod, index) => `
      <div class="mod-item" data-id="${mod.id}">
          <span class="mod-title">${mod.load_order}</span>
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
  window.sortable = new Sortable(document.getElementById("modList"), {
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
      saveMods();
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

function updateConfig() {
  const modal = document.getElementById("configModal");
  const closeBtn = modal.querySelector(".close-modal");
  const cancelBtn = modal.querySelector(".modal-button.cancel");
  const saveBtn = modal.querySelector(".modal-button.save");
  const fileUpload = document.getElementById("fileUpload");
  const dropZone = document.getElementById("dropZone");
  const fileName = document.getElementById("fileName");

  // Show modal
  modal.style.display = "block";

  // Close modal functions
  function closeModal() {
    modal.style.display = "none";
    // Reset form
    fileUpload.value = "";
    fileName.textContent = "No file selected";
    document.getElementById("configTextarea").value = "";
  }

  // Close button event
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  // Close modal when clicking outside
  window.onclick = function (event) {
    if (event.target === modal) {
      closeModal();
    }
  };

  // File upload handling
  fileUpload.onchange = function (e) {
    if (e.target.files[0]) {
      fileName.textContent = e.target.files[0].name;
    }
  };

  // Process button handling
  saveBtn.onclick = async function () {
    const file = fileUpload.files[0];
    if (!file) {
      alert("Please select a file first");
      return;
    }

    const formData = new FormData();
    formData.append("config_file", file);

    try {
      const response = await fetch("/api/process_config", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the processed file from the response
      const blob = await response.blob();

      // Create a download link and trigger it
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "processed_config.txt"; // You can customize the filename

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(downloadUrl);
      closeModal();
    } catch (error) {
      console.error("Error:", error);
      alert("Error processing file. Please try again.");
    }
  };

  // Drag and drop functionality
  dropZone.onclick = function () {
    fileUpload.click();
  };

  dropZone.ondragover = function (e) {
    e.preventDefault();
    this.style.backgroundColor = "#f8f9fa";
  };

  dropZone.ondragleave = function (e) {
    e.preventDefault();
    this.style.backgroundColor = "";
  };

  dropZone.ondrop = function (e) {
    e.preventDefault();
    this.style.backgroundColor = "";

    if (e.dataTransfer.files[0]) {
      fileUpload.files = e.dataTransfer.files;
      fileName.textContent = e.dataTransfer.files[0].name;
    }
  };
}

function addMods() {
  const modal = document.getElementById("addModsModal");
  const closeBtn = modal.querySelector(".close-modal");
  const cancelBtn = modal.querySelector(".modal-button.cancel");
  const saveBtn = modal.querySelector(".modal-button.save");
  const urlInput = document.getElementById("modUrl");
  const spinner = document.getElementById("loadingSpinner");

  // Show modal
  modal.style.display = "block";

  // Close modal functions
  function closeModal() {
    modal.style.display = "none";
    urlInput.value = ""; // Clear input when closing
    spinner.style.display = "none"; // Hide spinner when closing
  }

  // Close button event
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  // Close modal when clicking outside
  window.onclick = function (event) {
    if (event.target === modal) {
      closeModal();
    }
  };

  // Process button handling
  saveBtn.onclick = async function () {
    const url = urlInput.value.trim();

    if (!url) {
      alert("Please enter a valid URL");
      return;
    }

    try {
      // Show spinner and disable save button
      spinner.style.display = "block";
      saveBtn.disabled = true;

      const response = await fetch("/get_mods_from_url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Mods retrieved successfully:", data);
      closeModal();
    } catch (error) {
      console.error("Error processing mods:", error);
      alert("Error processing mods. Please try again.");
    } finally {
      // Hide spinner and re-enable save button
      spinner.style.display = "none";
      saveBtn.disabled = false;
    }
  };
}

// Add click handler to the Add Mod button
document.getElementById("addMod").addEventListener("click", addMods);

function deleteMod(index) {
  const modId = mods[index].id;

  if (confirm("Are you sure you want to delete this mod?")) {
    // Find the DOM element for this mod
    const modElement = document.querySelector(`.mod-item[data-id="${modId}"]`);

    // Add the deleting class to start the animation
    modElement.classList.add("moving");

    modElement.classList.add("deleting");

    // Wait for animation to complete before making the API call
    setTimeout(() => {
      fetch(`/api/mods/${modId}`, {
        method: "DELETE",
      })
        .then((response) => {
          if (response.ok) {
            // Remove the mod from the array
            mods.splice(index, 1);

            // Update load_order for all remaining mods
            mods.forEach((mod, index) => {
              mod.load_order = index + 1;
            });

            saveMods();
            renderMods();
          } else {
            throw new Error("Failed to delete mod");
          }
        })
        .catch((error) => {
          console.error("Error deleting mod:", error);
          alert("Error deleting mod. Please check the console for details.");
          // Remove the deleting class if there's an error
          modElement.classList.remove("moving");
          modElement.classList.remove("deleting");
        });
    }, 300); // Match this to your CSS transition duration
  }
}

checkMissingModID();
loadMods();
