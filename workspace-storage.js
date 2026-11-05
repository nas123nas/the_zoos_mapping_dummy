(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WorkspaceStorage = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function compactMaster(master) {
    if (!master) return master;
    const { content, encoding, productCatalog, ...metadata } = master;
    return metadata;
  }

  function createPersistableWorkspace(workspace) {
    return {
      ...workspace,
      fixedMaster: compactMaster(workspace.fixedMaster),
      masterHistory: (workspace.masterHistory || []).map(compactMaster),
    };
  }

  function parseStoredWorkspace(stored) {
    try {
      return JSON.parse(stored);
    } catch (_) {
      return null;
    }
  }

  return { createPersistableWorkspace, parseStoredWorkspace };
});
