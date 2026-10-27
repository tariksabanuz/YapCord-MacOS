'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installer', {
  info: () => ipcRenderer.invoke('installer:info'),
  choose: () => ipcRenderer.invoke('installer:choose'),
  run: (action, dir) => ipcRenderer.invoke('installer:run', action, dir),
  launch: (dir) => ipcRenderer.invoke('installer:launch', dir),
  openHome: () => ipcRenderer.invoke('installer:home'),
  onLog: (fn) => {
    const h = (_e, line) => fn(String(line));
    ipcRenderer.on('installer:log', h);
    return () => ipcRenderer.removeListener('installer:log', h);
  },
});
