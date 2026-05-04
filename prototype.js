const commandInput = document.querySelector("#commandInput");
const addWorkbench = document.querySelector("#addWorkbench");
const searchWorkbench = document.querySelector("#searchWorkbench");

const openSearchButtons = [
  document.querySelector("#openSearch"),
  document.querySelector("#openSearchHero"),
].filter(Boolean);

const openAddButtons = [
  document.querySelector("#openAdd"),
  document.querySelector("#openAddFromPanel"),
  document.querySelector("#openAddDock"),
].filter(Boolean);

function highlightPanel(panel) {
  panel.classList.remove("focus-flash");
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  requestAnimationFrame(() => panel.classList.add("focus-flash"));
}

function focusSearch() {
  highlightPanel(searchWorkbench);
  requestAnimationFrame(() => commandInput?.focus());
}

function focusAdd() {
  highlightPanel(addWorkbench);
}

function toast(message) {
  const existing = document.querySelector(".toast");
  existing?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 180);
  }, 1800);
}

openSearchButtons.forEach((button) => button.addEventListener("click", focusSearch));
openAddButtons.forEach((button) => button.addEventListener("click", focusAdd));

document.querySelector("#saveMock")?.addEventListener("click", () => {
  toast("已保存到「生图生视频」，并加入 Dock 常用");
});

document.querySelector("#showDropState")?.addEventListener("click", () => {
  document.querySelector(".selected-drop")?.classList.add("active");
  toast("原型提示：网址可拖到左侧文件夹，也可拖到底部 Dock");
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusSearch();
  }
});
