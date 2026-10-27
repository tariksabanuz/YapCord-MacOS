'use strict';

const fs = require('fs');
const path = require('path');

const NAME = 'YapCord';
const OLD_NAME = 'YapperMod';

function resolveDataDir(appData, fsImpl = fs) {
  const next = path.join(appData, NAME);
  const old = path.join(appData, OLD_NAME);
  if (fsImpl.existsSync(next) || !fsImpl.existsSync(old)) return { dir: next, migrated: false, legacy: false };
  try {
    fsImpl.renameSync(old, next);
    return { dir: next, migrated: true, legacy: false };
  } catch (error) {
    return { dir: old, migrated: false, legacy: true, error };
  }
}

module.exports = { resolveDataDir, NAME, OLD_NAME };
