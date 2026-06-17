const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  extractSkill: (payload) => ipcRenderer.invoke('extract-skill', payload),
  getExtractedSkills: () => ipcRenderer.invoke('get-extracted-skills'),
  readSkillContent: (filePath) => ipcRenderer.invoke('read-skill-content', filePath),
  deleteSkill: (filePath) => ipcRenderer.invoke('delete-skill', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  startDrag: (filePath) => ipcRenderer.send('start-drag', filePath),
  
  // Settings API
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  selectSaveDirectory: () => ipcRenderer.invoke('select-save-directory'),
  getDefaultSavePath: () => ipcRenderer.invoke('get-default-save-path'),

  onExtractionProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('extraction-progress', subscription);
    return () => ipcRenderer.removeListener('extraction-progress', subscription);
  }
});
