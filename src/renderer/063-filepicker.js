

const FilePicker = (YM.filePicker = { busy: false, picks: 0, failures: 0 });
const nativeClick = HTMLInputElement.prototype.click;

function enabled() {
  return YM.inApp && !YM.official && YM.native && YM.native.files && typeof YM.native.files.pick === 'function' && YM.settings.get('window.ownFilePicker', true) !== false;
}

function toast(text) {
  try {
    if (YM.toast) YM.toast(text, { type: 'error' });
  } catch (_) {}
}

async function pick(input, nativeArgs) {
  FilePicker.busy = true;
  try {
    const multiple = !!input.multiple;
    const picked = await YM.native.files.pick({ accept: input.accept || '', multiple });
    if (!picked || !picked.length) return;
    const files = [];
    for (const f of picked) {
      if (f.error === 'too-large') {
        toast(f.name + ' is too large to send (over 500 MB).');
        continue;
      }
      if (f.error || !f.data) {
        toast('Could not read ' + f.name + '.');
        continue;
      }
      files.push(new File([f.data], f.name, { type: f.type || '', lastModified: f.lastModified || Date.now() }));
    }
    if (!files.length) return;
    const dt = new DataTransfer();
    for (const f of multiple ? files : files.slice(0, 1)) dt.items.add(f);
    input.files = dt.files;
    FilePicker.picks++;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (err) {
    FilePicker.failures++;
    YM.log.error('own file dialog failed, falling back to the browser chooser', err);
    try {
      nativeClick.apply(input, nativeArgs);
    } catch (_) {}
  } finally {
    FilePicker.busy = false;
  }
}

HTMLInputElement.prototype.click = function click() {
  if (this.type !== 'file' || this.disabled || this.webkitdirectory || !enabled()) return nativeClick.apply(this, arguments);
  if (FilePicker.busy) return undefined;
  pick(this, arguments);
  return undefined;
};
