let importOk = true;
try {
  importScripts("solver-core.js");
} catch (err) {
  importOk = false;
}

self.onmessage = function (e) {
  if (!importOk) {
    self.postMessage({ solvable: false, error: "import failed" });
    return;
  }
  try {
    const { deal } = e.data;
    const testState = {
      suits: deal.suits,
      tableau: deal.tableau,
      stock: deal.stock,
      foundation: 0,
    };
    // 先用贪心模拟快速筛选（毫秒级）
    const solvable = isSolvableByGreedy(testState);
    self.postMessage({ solvable, tableau: deal.tableau, stock: deal.stock });
  } catch {
    self.postMessage({ solvable: false });
  }
};
