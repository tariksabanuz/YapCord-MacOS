'use strict';

const fs = require('fs');
const path = require('path');

const MAX_DATA_URL = 4500000;
const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

class AppIcon {

  constructor(o) {
    this.dir = o.dir;
    this.nativeImage = o.nativeImage;
    this.isEnabled = o.isEnabled;
    this.originalWindow = o.originalWindow || (() => null);
    this.log = o.log || { warn() {}, error() {}, info() {} };
    this.windows = new Set();
    this.trays = new Map();
  }

  get file() {
    return path.join(this.dir, 'app-icon.png');
  }

  has() {
    try {
      return fs.statSync(this.file).size > 0;
    } catch (_) {
      return false;
    }
  }

  custom() {
    if (!this.has() || !this.isEnabled()) return null;
    try {
      const img = this.nativeImage.createFromPath(this.file);
      return img && !img.isEmpty() ? img : null;
    } catch (_) {
      return null;
    }
  }

  previewDataUrl() {
    try {
      return 'data:image/png;base64,' + fs.readFileSync(this.file).toString('base64');
    } catch (_) {
      return '';
    }
  }

  set(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_DATA_URL) throw new Error('That picture is too large.');
    const m = DATA_URL.exec(dataUrl);
    if (!m) throw new Error('That is not a picture I can use.');
    const img = this.nativeImage.createFromBuffer(Buffer.from(m[2], 'base64'));
    if (!img || img.isEmpty()) throw new Error('That is not a picture I can use.');
    const sized = img.resize({ width: 256, height: 256, quality: 'best' });
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, sized.toPNG());
    fs.renameSync(tmp, this.file);
    this.refresh();
  }

  clear() {
    try {
      fs.rmSync(this.file, { force: true });
    } catch (err) {
      this.log.warn('could not remove the app icon:', err && err.message);
    }
    this.refresh();
  }

  attachWindow(win) {
    this.windows.add(win);
    try { win.once('closed', () => this.windows.delete(win)); } catch (_) {  }
    this._applyWindow(win);
  }

  attachTray(tray, original) {
    this.trays.set(tray, original);
    try { tray.once('destroyed', () => this.trays.delete(tray)); } catch (_) {  }
    this._applyTray(tray);
  }

  _applyWindow(win) {
    try {
      if (!win || (win.isDestroyed && win.isDestroyed()) || typeof win.setIcon !== 'function') return;
      const img = this.custom() || this.originalWindow();
      if (img) win.setIcon(img);
    } catch (err) {
      this.log.warn('could not set the window icon:', err && err.message);
    }
  }

  _applyTray(tray) {
    try {
      if (tray.isDestroyed && tray.isDestroyed()) return;
      const custom = this.custom();
      const img = custom ? custom.resize({ width: 32, height: 32, quality: 'best' }) : this.trays.get(tray);
      if (img) tray.setImage(img);
    } catch (err) {
      this.log.warn('could not set the tray icon:', err && err.message);
    }
  }

  trayImage() {
    const c = this.custom();
    return c ? c.resize({ width: 32, height: 32, quality: 'best' }) : null;
  }

  refresh() {
    for (const w of [...this.windows]) this._applyWindow(w);
    for (const t of [...this.trays.keys()]) this._applyTray(t);
  }
}

module.exports = { AppIcon, DATA_URL };
