'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pickerAPI', {
  onSources: (cb) => ipcRenderer.on('picker:sources', (_e, sources) => cb(sources)),
  choose: (id, audio) => ipcRenderer.send('picker:choose', { id, audio: !!audio }),
  cancel: () => ipcRenderer.send('picker:choose', null),
  platform: process.platform,
});
