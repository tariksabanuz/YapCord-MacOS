'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  ['Syntax', 'check-syntax.js'],
  ['Unit', 'unit.js'],
  ['Electron main + preload (mocked)', 'smoke-main.js'],
  ['Inside the official Yapper app: installer + inject (mocked)', 'smoke-inject.js'],
  ['Zip reader + updater (local GitHub-like server)', 'smoke-updater.js'],
  ['YapCord Installer: staging + install / repair / uninstall (fake Yapper)', 'smoke-installer.js'],
];
const e2e = [
  ['Browser: module finder', 'e2e-finder.js'],
  ['Browser: network hooks', 'e2e-net.js'],
  ['Browser: plugins', 'e2e-plugins.js'],
  ['Browser: settings UI', 'e2e-settings.js'],
  ['Browser: extra plugins', 'e2e-extras.js'],
  ['Browser: 1.1 plugins (uploads, screen share, chat)', 'e2e-new.js'],
  ['Browser: core regressions (bodies, patches, lifecycle, themes)', 'e2e-core.js'],
  ['Browser: /petpet command and GIF', 'e2e-petpet.js'],
  ['Browser: installer window', 'e2e-installer.js'],
  ['Browser: 1.4 features (PinDMs, icons, layout, update-ready toast)', 'e2e-v14.js'],
  ['Browser: 1.5 plugins (24 new Vencord ports)', 'e2e-v15.js'],
  ['Browser: 1.6 plugins (custom server icons, friend nicknames)', 'e2e-v16.js'],
  ['Browser: 1.7 (new Plugins page, look-and-feel plugins)', 'e2e-v17.js'],
  ['Browser: 1.8 (word filter, reply dots, ringtone, name effects, transitions, server colours)', 'e2e-v18.js'],
  ['Browser: 1.9 (name style, hide badges, schedule message)', 'e2e-v19.js'],
  ['Browser: 1.10 (channel notes, avatar effects, more name effects)', 'e2e-v110.js'],
  ['Browser: 1.11 (chat export, pins, idle, keybinds, image zoom, PiP, and more)', 'e2e-v111.js'],
  ['Browser: 1.12 (message FX, reminders, double-tap react, voice changer)', 'e2e-v112.js'],
  ['Browser: 1.13 (slash moderation commands, the "/" command picker)', 'e2e-v113.js'],
  ['Browser: SlashModeration against the real build (no finder mock)', 'e2e-slashmod-real.js'],
  ['Browser: RecentEmojis (Discord-style "recently used" section in the emoji picker)', 'e2e-recentemojis.js'],
  ['Browser: PushToTalk (hold a key to unmute in voice calls)', 'e2e-ptt.js'],
  ['Browser: HideChannels (hide a channel from your own sidebar)', 'e2e-hidechannels.js'],
  ['Browser: AutoTranslate (auto-runs Yapper\'s own real Translate on new messages)', 'e2e-autotranslate.js'],
  ['Browser: UIPolish (subtle hover/press/focus/scrollbar touches)', 'e2e-uipolish.js'],
  ['Browser: OnboardingPolish (clearer Server Settings > Onboarding page)', 'e2e-onboardingpolish.js'],
  ['Browser: IdleVoiceControls (idle mic/deafen pair in the account bar)', 'e2e-idlevoicecontrols.js'],
  ['Browser: EmojiPreview (click an emoji for its name, preview and source server)', 'e2e-emojipreview.js'],
  ['Browser: EmojiPickerOrder (emoji picker sections follow the real server list)', 'e2e-emojipickerorder.js'],
  ['Browser: RestartShortcut (Ctrl+R reloads YapCord in place, like Discord\'s)', 'e2e-restartshortcut.js'],
  ['Browser: SwipeNavigation (swipe left/right to go back/forward, mobile)', 'e2e-swipenavigation.js'],
  ['Browser: SpellcheckGuard (message box spellcheck always stays on)', 'e2e-spellcheckguard.js'],
  ['Browser: ScreenShareAudioToggle (screen share always offers the audio choice, in the browser)', 'e2e-screenshareaudiotoggle.js'],
  ['Browser: MessageEncryption (per-chat shared-key text scrambling)', 'e2e-messageencryption.js'],
  ['Browser: RoleReorderConfirm (confirm before a dragged role reorder saves)', 'e2e-rolereorderconfirm.js'],
  ['Browser: the real Chrome/Edge/Brave extension, loaded unpacked', 'e2e-extension.js'],
  ['Browser: the bookmarklet (any phone, booted after the page already loaded)', 'e2e-bookmarklet.js'],
  ['Browser: ImageZoom enabled at boot, before <body> necessarily exists', 'e2e-imagezoom-boot.js'],
  ['Browser: YapCordBadge (bio marker, badge, no truncation, no toggle)', 'e2e-yapcordbadge.js'],
  ['Browser: NavigationFX (server-switch pulse against the real rail markup)', 'e2e-navigationfx.js'],
];

const results = [];
function run(label, file) {
  process.stdout.write('\n=== ' + label + ' (' + file + ') ===\n');
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', env: process.env });
  results.push([label, r.status === 0 ? 'passed' : 'FAILED']);
}

for (const [label, file] of suites) run(label, file);
if (process.env.YM_CACHE_DIR) {
  for (const [label, file] of e2e) run(label, file);
} else {
  for (const [label] of e2e) results.push([label, 'skipped (set YM_CACHE_DIR to run)']);
}

process.stdout.write('\n=== Summary ===\n');
for (const [label, status] of results) process.stdout.write('  ' + status.padEnd(8) + ' ' + label + '\n');
process.exit(results.some(([, s]) => s === 'FAILED') ? 1 : 0);
