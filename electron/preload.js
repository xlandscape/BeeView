const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Expose APIs to the renderer process
});