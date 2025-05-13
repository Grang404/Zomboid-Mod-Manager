let mods = [];
let subMods = [];
let isLoading = false;

// ====================== API Integration Functions ======================

async function getMods() {
  const response = await fetch("/api/mods");

  if (!response.ok) {
    throw new Error(
      `Server returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data || Object.keys(data).length === 0) {
    showNotification("There are no mods to load 😢");
  } else {
    showNotification("Mods loaded successfully", "success");
  }

  return data;
}

async function getSubMods() {
  const response = await fetch("/api/submods");

  if (!response.ok) {
    throw new Error(
      `Server returned ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data || Object.keys(data).length === 0) {
    showNotification("There are no mods to load 😢");
  } else {
    return data;
  }
}

async function loadMods() {
  try {
    showLoadingIndicator();
    mods = await getMods();
    // subMods = await getSubMods();
    renderMods();
  } catch (error) {
    console.error("Error loading mods:", error);
    showNotification("Failed to load mods. Please try again.", "error");
  } finally {
    hideLoadingIndicator();
  }
}

async function saveMods() {
  try {
    mods.forEach((mod, index) => {
      mod.load_order = index + 1;
    });

    const payload = Array.from(document.querySelectorAll(".mod-item")).map(
      (item, index) => ({
        id: parseInt(item.dataset.id),
        enabled: item.querySelector(".mod-checkbox").checked,
        load_order: index + 1,
      }),
    );

    const response = await fetch("/api/mods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error saving changes:", error);
    showNotification("Failed to save changes. Please try again.", "error");
  } finally {
    hideLoadingIndicator();
  }
}

async function saveSubMods() {
  try {
    const payload = Array.from(document.querySelectorAll(".submod-item")).map(
      (item) => {
        const checkbox = item.querySelector(".submod-checkbox");
        const submodId = parseInt(item.dataset.id);
        const submod = subMods.find((s) => s.mod_id === submodId);

        return {
          parent_mod_id: submod?.parent_mod_id ?? null,
          enabled: checkbox.checked,
        };
      },
    );

    const response = await fetch("/api/submods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error saving submods:", error);
    showNotification(
      "Failed to save submod changes. Please try again.",
      "error",
    );
  } finally {
    hideLoadingIndicator();
  }
}
// TODO: Delete submod in db as well but doesn't really matter for it to work
async function deleteMod(index) {
  const mod = mods[index];
  const modId = mod.id;
  const modTitle = mod.title;

  try {
    const modElement = document.querySelector(`.mod-item[data-id="${modId}"]`);

    modElement.classList.add("moving");
    modElement.classList.add("deleting");

    // Wait for animation to complete before making the API call
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/mods/${modId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(
            `Server returned ${response.status}: ${response.statusText}`,
          );
        }

        mods.splice(index, 1);

        // Update load_order for all remaining mods
        mods.forEach((mod, index) => {
          mod.load_order = index + 1;
        });

        showNotification(`${modTitle} deleted successfully`, "warning");
        saveMods();
        renderMods();
      } catch (error) {
        console.error("Error deleting mod:", error);
        showNotification(`Failed to delete "${modTitle}"`, "error");

        // Remove the deleting class if there's an error
        modElement.classList.remove("moving");
        modElement.classList.remove("deleting");
      }
    }, 400);
  } catch (error) {
    console.error("Error preparing to delete mod:", error);
    showNotification(`Failed to delete "${modTitle}"`, "error");
  }
}

// ====================== UI Rendering ======================

/**
 * Renders the mod list in the DOM
 */

function renderMods() {
  // Sort mods based on their load order (if applicable)
  mods.sort((a, b) => a.load_order - b.load_order);

  const modList = document.getElementById("modList");
  if (!modList) return;

  // Render all mods (no filters or search for now)
  modList.innerHTML = mods
    .map((mod) => renderModItem(mod)) // Just pass the mod object, no need for index
    .join("");

  initializeSortable();
}

/**
 * Renders a single mod item
 * @param {Object} mod - The mod object
 * @param {number} index - The index of the mod in the mods array
 * @returns {string} HTML string for the mod item
 */
function renderModItem(mod, index, subindex) {
  // Parse mod_ids into an array
  const modIdArray = mod.mod_ids
    ? mod.mod_ids
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id)
    : [];
  const hasMultipleIds = modIdArray.length > 1;

  return `
  <div class="mod-item ${mod.enabled ? "enabled" : "disabled"}" data-id="${mod.id}">
      <div class="mod-order-section">
        <span class="mod-order">${mod.load_order}</span>
        <label class="checkbox">
          <input type="checkbox" class="mod-checkbox" 
                 ${mod.enabled ? "checked" : ""} 
                 onchange="toggleMod(${index})">
          <span class="material-symbols-outlined unchecked">check_box_outline_blank</span>
          <span class="material-symbols-outlined checked">check_box</span>
        </label>
      </div>
      
      <span class="mod-title">
          <a href="${mod.url}" target="_blank" title="${mod.title}">${mod.title}</a>
          ${
            hasMultipleIds
              ? `<button class="icon-button toggle-details" onclick="toggleModDetails(${mod.id})" title="Show mod details">
               <span class="material-symbols-outlined">keyboard_arrow_down</span>
             </button>`
              : ""
          }
      </span>
      
      <div class="mod-controls">
          <button class="icon-button move-top" onclick="moveToTop(${index});" title="Move to top">
            <span class="material-symbols-outlined">keyboard_double_arrow_up</span>
          </button>
          <button class="icon-button move-bottom" onclick="moveToBottom(${index});" title="Move to bottom">
            <span class="material-symbols-outlined">keyboard_double_arrow_down</span>
          </button>
          <button class="icon-button move-up" onclick="moveModUp(${index});" title="Move up">
            <span class="material-symbols-outlined">keyboard_arrow_up</span>
          </button>
          <button class="icon-button move-down" onclick="moveModDown(${index});" title="Move down">
            <span class="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
      </div>
      
      <div class="mod-actions">
          <button class="icon-button delete-mod" onclick="deleteMod(${index})" title="Delete mod">
              <span class="material-symbols-outlined">delete</span>
          </button>
      </div>
      
      ${
        hasMultipleIds
          ? `<div class="mod-details" id="mod-details-${mod.id}" style="display: none;">
           <ul class="submod-list">
            ${modIdArray
              .map(
                (id) => `<div class="submod-item"><p><label class="checkbox">
                          <input type="checkbox" class="submod-checkbox"
                            data-entry-id="${id}" 
                            ${subMods.enabled ? "checked" : "checked"} 
                            onchange="toggleSubmod(${subindex})">
                          <span class="material-symbols-outlined unchecked">check_box_outline_blank</span>
                          <span class="material-symbols-outlined checked">check_box</span>
                        </label>
                        ${id}</p></div>`,
              )
              .join("")}
           </ul>
         </div>`
          : ""
      }
  </div>
  `;
}

/**
 * Toggle visibility of mod details
 * @param {number} modId - The mod ID
 */
function toggleModDetails(modId) {
  const detailsElement = document.getElementById(`mod-details-${modId}`);
  const button = document.querySelector(
    `.mod-item[data-id="${modId}"] .toggle-details span`,
  );

  if (detailsElement.style.display === "none") {
    detailsElement.style.display = "block";
    button.textContent = "keyboard_arrow_up";
  } else {
    detailsElement.style.display = "none";
    button.textContent = "keyboard_arrow_down";
  }
}

// ====================== UI Event Handlers ======================

function toggleMod(index) {
  mods[index].enabled = !mods[index].enabled;
  saveMods();

  // Update UI without full re-render
  const modItem = document.querySelector(
    `.mod-item[data-id="${mods[index].id}"]`,
  );
  if (modItem) {
    if (mods[index].enabled) {
      modItem.classList.add("enabled");
      modItem.classList.remove("disabled");
    } else {
      modItem.classList.add("disabled");
      modItem.classList.remove("enabled");
    }
  }
}

function toggleSubmod(index) {
  subMods[index].enabled = !subMods[index].enabled;
  saveSubMods();

  const submodItem = document.querySelector(
    `.submod-item[data-id="${subMods[index].mod_id}"]`,
  );
  if (submodItem) {
    if (subMods[index].enabled) {
      submodItem.classList.add("enabled");
      submodItem.classList.remove("disabled");
    } else {
      submodItem.classList.add("disabled");
      submodItem.classList.remove("enabled");
    }
  } else {
    console.log("submodItem not found");
  }
}

function moveToTop(index) {
  const item = mods[index];
  mods.splice(index, 1);
  mods.unshift(item);

  mods.forEach((mod, idx) => {
    mod.load_order = idx + 1;
  });
  saveMods();
  renderMods();
}

function moveToBottom(index) {
  const item = mods[index];
  mods.splice(index, 1);
  mods.push(item);

  mods.forEach((mod, idx) => {
    mod.load_order = idx + 1;
  });
  saveMods();
  renderMods();
}

function moveModUp(index) {
  if (index <= 0) return;
  const temp = mods[index];
  mods[index] = mods[index - 1];
  mods[index - 1] = temp;
  saveMods();
  renderMods();
}

function moveModDown(index) {
  if (index >= mods.length - 1) return;
  const temp = mods[index];
  mods[index] = mods[index + 1];
  mods[index + 1] = temp;
  saveMods();
  renderMods();
}

/**
 * TODO: Implement this
 */
function enableAllMods() {}

/**
 * TODO: Implement this
 */
function disableAllMods() {}

/**
 * Initializes sortable functionality for the mod list
 */
function initializeSortable() {
  if (window.sortable) {
    window.sortable.destroy();
  }

  const modList = document.getElementById("modList");
  if (!modList) return;

  window.sortable = new Sortable(modList, {
    animation: 150,
    handle: ".mod-item",
    filter: ".checkbox, .delete-mod, .toggle-details",
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

      // Get the moved item and current mods array
      const currentMods = Array.from(modList.querySelectorAll(".mod-item")).map(
        (el) => mods.find((mod) => mod.id === parseInt(el.dataset.id)),
      );

      // Update mods array with the new order
      mods = currentMods;

      // Update load_order for all mods based on the new positions
      mods.forEach((mod, index) => {
        mod.load_order = index + 1;
      });
      renderMods();
      saveMods();
    },
  });
}

function handleWheel(e) {
  e.preventDefault();
  const modList = document.getElementById("modList");
  if (window.sortable && window.sortable.dragging) {
    modList.scrollTop += e.deltaY;
  }
}

function handleSearch() {
  renderMods();
}

function createModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return null;
  const closeBtn = modal.querySelector(".close-modal");
  modal.style.display = "block";
  function closeModal() {
    modal.style.display = "none";
    // Reset form fields
    const inputs = modal.querySelectorAll(
      "input:not([type=checkbox]), textarea",
    );
    inputs.forEach((input) => (input.value = ""));
  }
  if (closeBtn) closeBtn.onclick = closeModal;
  window.onclick = function (event) {
    if (event.target === modal) {
      closeModal();
    }
  };
  return {
    element: modal,
    close: closeModal,
  };
}

function showAddModsModal() {
  const modalControls = createModal("addModsModal");

  const submitButton = document.querySelector(
    "#addModsModal .modal-button.submit",
  );
  if (submitButton) {
    submitButton.onclick = function () {
      const collectionInput = document.getElementById("collectionUrl");
      const workshopInput = document.getElementById("workshopUrl");
      const collectionInputUrl = collectionInput.value.trim();
      const workshopInputUrl = workshopInput.value.trim();

      if (!collectionInputUrl && !workshopInputUrl) {
        showNotification("Please enter a valid URL", "warning");
        return;
      }
      if (collectionInputUrl && workshopInputUrl) {
        showNotification("Please enter only one URL type", "warning");
        return;
      }

      try {
        showLoadingIndicator();
        let loadingText = document.createElement("p");
        loadingText.classList.add("loading-text");
        let spinner = document.getElementById("globalLoader");
        spinner.appendChild(loadingText);
        submitButton.disabled = true;

        const url = collectionInputUrl || workshopInputUrl;
        const urlType = collectionInputUrl ? "collection" : "workshop";

        fetch("/get_mods_from_url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: url,
            type: urlType,
          }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `Server returned ${response.status}: ${response.statusText}`,
              );
            }
            showNotification("Mods added successfully", "success");
            loadMods();
            renderMods;
            modalControls.close();
          })
          .catch((error) => {
            console.error("Error processing mods:", error);
            showNotification(
              "Failed to add mods. Please check the URL and try again.",
              "error",
            );
          })
          .finally(() => {
            hideLoadingIndicator();
            if (loadingText && spinner) {
              spinner.removeChild(loadingText);
            }
            submitButton.disabled = false;
          });
      } catch (error) {
        console.error("Error in mod processing setup:", error);
        hideLoadingIndicator();
        submitButton.disabled = false;
        showNotification("An unexpected error occurred", "error");
      }
    };
  }
}

// ====================== Utility Functions ======================

function showLoadingIndicator() {
  isLoading = true;
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.style.display = "flex";
  }
}

function hideLoadingIndicator() {
  isLoading = false;
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.style.display = "none";
  }
}

function showNotification(message, type = "info") {
  const container =
    document.getElementById("notification-container") ||
    (() => {
      const newContainer = document.createElement("div");
      newContainer.id = "notification-container";
      document.body.appendChild(newContainer);
      return newContainer;
    })();

  // Remove existing notifications of the same type
  // const existing = container.querySelectorAll(`.notification.${type}`);
  // existing.forEach((el) => {
  //   el.classList.remove("show");
  //   setTimeout(() => el.remove(), 300);
  // });

  const note = document.createElement("div");
  note.className = `notification ${type}`;
  note.textContent = message;
  container.appendChild(note);

  requestAnimationFrame(() => note.classList.add("show"));

  setTimeout(() => {
    note.classList.remove("show");
    setTimeout(() => note.remove(), 300);
  }, 3000);
}

// TODO: either make bespoke or delete
function confirmAction(message) {
  return window.confirm(message);
}

// ====================== Initialize the Application ======================

/**
 * Initialize the app when the DOM is loaded
 */
document.addEventListener("DOMContentLoaded", function () {
  loadMods();

  // Set up event listeners
  const searchInput = document.getElementById("modSearch");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }

  const enabledFilter = document.getElementById("filterEnabled");
  if (enabledFilter) {
    enabledFilter.addEventListener("change", handleSearch);
  }

  const enableAllButton = document.getElementById("enableAllButton");
  if (enableAllButton) {
    enableAllButton.addEventListener("click", enableAllMods);
  }

  const disableAllButton = document.getElementById("disableAllButton");
  if (disableAllButton) {
    disableAllButton.addEventListener("click", disableAllMods);
  }

  const addModsButton = document.getElementById("addModsButton");
  if (addModsButton) {
    addModsButton.addEventListener("click", showAddModsModal);
  }

  const configButton = document.getElementById("configButton");
  if (configButton) {
    configButton.addEventListener("click", showConfigModal);
  }
});
