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

    let missingModIDs = mods.filter((mod) => {
      const modId = String(mod.mod_ids);
      return !modId || modId.trim() === "";
    });

    const warningIcon = document.getElementById("warningIcon");

    // Show or hide warning icon based on missing mod IDs
    if (missingModIDs.length === 0) {
      warningIcon.style.display = "none";
    } else {
      warningIcon.style.display = "block";
    }

    warningIcon.addEventListener("click", () => {
      if (missingModIDs.length > 0) {
        const modal = document.getElementById("modIdsModal");
        const modalBody = modal.querySelector(".modal-body");

        // Clear existing modal content
        modalBody.innerHTML = "";

        const modList = missingModIDs
          .map(
            (mod) => `
              <div class="missing-item" data-mod-id="${mod.id}">
                <p><a href="${mod.url}" target="_blank">${mod.title}</a></p>
                <input type="text" class="mod-input" placeholder="Enter Mod ID" data-mod-id="${mod.id}" data-mod-title="${mod.title}" />
                <button class="submit-mod-id" data-mod-id="${mod.id}" data-mod-title="${mod.title}">Submit</button>
              </div>
            `,
          )
          .join("");

        modalBody.innerHTML = modList;
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

        // Use event delegation for the submit buttons
        modalBody.addEventListener("click", async (event) => {
          if (event.target.classList.contains("submit-mod-id")) {
            const button = event.target;
            const modTitle = button.getAttribute("data-mod-title");
            const modIdData = button.getAttribute("data-mod-id");
            const input = button.previousElementSibling;
            const modID = input.value.trim();

            if (modID) {
              try {
                const response = await fetch("/api/update-mod-id", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ id: modIdData, mod_id: modID }),
                });

                if (response.ok) {
                  // Remove the parent "missing-item" element from the DOM
                  const parentElement = button.closest(".missing-item");
                  if (parentElement) {
                    parentElement.remove(); // This will remove the entire parent div
                  }

                  // Update the missingModIDs list and re-render modal content
                  missingModIDs = missingModIDs.filter(
                    (mod) => mod.id !== modIdData,
                  );
                  checkMissingModID(); // Re-run to reflect the updated missing mods
                  saveMods();
                } else {
                  alert(`Failed to update Mod ID for "${modTitle}".`);
                }
              } catch (error) {
                console.error("Error updating Mod ID:", error);
                alert(
                  "Error sending Mod ID. Please check the console for details.",
                );
              }
            } else {
              alert("Please enter a valid Mod ID before submitting.");
            }
          }
        });
      }
    });
  } catch (error) {
    console.error("Error checking missing mod_id:", error);
    alert("Error checking mods. Please check the console for details.");
  }
}
// TODO: add update for mod index
function moveToTop(index) {
  const item = mods[index];
  mods.splice(index, 1);
  mods.unshift(item);
  saveMods();
  renderMods();
}

function moveToBottom(index) {
  const item = mods[index];
  mods.splice(index, 1);
  mods.push(item);
  saveMods();
  renderMods();
}

function renderMods() {
  // Update load_order for all mods before rendering
  mods.forEach((mod, index) => {
    mod.load_order = index + 1;
  });

  const modList = document.getElementById("modList");
  modList.innerHTML = mods
    .map(
      (mod, index) => `
      <div class="mod-item" data-id="${mod.id}">
          <div class="mod-order-section">
            <span class="mod-title">${mod.load_order}</span>
            <label class="custom-checkbox">
              <input type="checkbox" class="mod-checkbox" 
                     ${mod.enabled ? "checked" : ""} 
                     onchange="toggleMod(${index})">
              <span class="material-symbols-outlined unchecked">check_box_outline_blank</span>
              <span class="material-symbols-outlined checked">check_box</span>
            </label>
          </div>
          <span class="mod-title">
              <a href="${mod.url}" target="_blank">${mod.title}</a>
          </span>
          <div class="mod-controls">
              <button class="icon-button move-top" onclick="moveToTop(${index}); saveMods();" title="Move to top">
                <span class="material-symbols-outlined">
                keyboard_double_arrow_up
                </span>
              </button>
              <button class="icon-button move-bottom" onclick="moveToBottom(${index}); saveMods();" title="Move to bottom">
                <span class="material-symbols-outlined">
                keyboard_double_arrow_down
                </span>
              </button>
          </div>
          <div class="mod-actions">
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
    handle: ".mod-item",
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
  saveMods();
}

function updateConfig() {
  const modal = document.getElementById("configModal");
  const closeBtn = modal.querySelector(".close-modal");
  const cancelBtn = modal.querySelector(".modal-button.cancel");
  const saveBtn = modal.querySelector(".modal-button.save");
  const fileUpload = document.getElementById("fileUpload");
  const dropZone = document.getElementById("dropZone");
  const fileName = document.getElementById("fileName");
  const textarea = document.getElementById("configTextarea");

  // Show modal
  modal.style.display = "block";

  // Fetch and update config content every time the modal is opened
  fetch("/get_mods_config")
    .then((response) => response.json())
    .then((data) => {
      const configContent = data.config_content;
      textarea.value = configContent;
      console.log(data.config_content); // Debug
      textarea.style.whiteSpace = "pre-wrap";
    })
    .catch((error) => {
      console.error("Error fetching config content:", error);
    });

  // Close modal functions
  function closeModal() {
    modal.style.display = "none";
    // Reset form
    fileUpload.value = "";
    fileName.textContent = "No file selected";
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
    const missingModIDs = mods.filter(
      (mod) => !mod.mod_ids || mod.mod_ids.trim() === "",
    );

    if (missingModIDs.length > 0) {
      alert("Warning");
    }
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
      link.download = "processed_config.txt"; // Customize filename

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

async function addMods() {
  const modal = document.getElementById("addModsModal");
  const closeBtn = modal.querySelector(".close-modal");
  const cancelBtn = modal.querySelector(".modal-button.cancel");
  const saveBtn = modal.querySelector(".modal-button.save");
  const collectionInput = document.getElementById("collectionUrl");
  const workshopInput = document.getElementById("workshopUrl");
  const spinner = document.getElementById("loadingSpinner");

  // Show modal
  modal.style.display = "block";

  // Close modal functions
  function closeModal() {
    modal.style.display = "none";
    collectionInput.value = "";
    workshopInput.value = "";
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
    const collectionInputUrl = collectionInput.value.trim();
    const workshopInputUrl = workshopInput.value.trim();

    if (!collectionInputUrl && !workshopInputUrl) {
      alert("Please enter a valid URL");
      return;
    }

    if (collectionInputUrl && workshopInputUrl) {
      alert("Please enter only one field");
      return;
    }

    try {
      // Show spinner and disable save button
      spinner.style.display = "block";
      saveBtn.disabled = true;

      const url = collectionInputUrl || workshopInputUrl;
      const urlType = collectionInputUrl ? "collection" : "workshop";

      const response = await fetch("/get_mods_from_url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url,
          type: urlType,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      checkMissingModID();
      loadMods(); // Re-fetch mods and render them

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

document.getElementById("copyButton").addEventListener("click", function () {
  const textarea = document.getElementById("configTextarea");

  // Create a temporary textarea element to copy text from without highlighting
  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = textarea.value;
  document.body.appendChild(tempTextArea);

  tempTextArea.select();
  document.execCommand("copy");

  // Remove the temporary textarea
  document.body.removeChild(tempTextArea);

  const icon = document.querySelector("#copyButton .material-symbols-outlined");

  // Apply shake effect and enlarge the icon
  icon.classList.add("copied");

  // Reset after animation
  setTimeout(function () {
    icon.classList.remove("copied");
  }, 1000); // Time duration of the animation
});

document.addEventListener("DOMContentLoaded", function () {
  fetch("/get_mods_config")
    .then((response) => response.json())
    .then((data) => {
      const configContent = data.config_content;

      const textarea = document.getElementById("configTextarea");
      textarea.value = configContent;

      // Ensure that the textarea uses pre-wrap to show newlines correctly
      textarea.style.whiteSpace = "pre-wrap";

      // Keep pre-wrap for line wrapping while preserving line breaks
      textarea.style.whiteSpace = "pre-wrap";
    })
    .catch((error) => {
      console.error("Error fetching config content:", error);
    });
});

checkMissingModID();
loadMods();
