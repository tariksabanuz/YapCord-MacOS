# Feature overview

This document says honestly what of Vencord is in YapCord. It is based on the source code of **Vencord 1.15.11** (166 plugins) and a scan of Yapper's own code. The "Status" column is my estimate per plugin; if something is classified wrongly, let me know.

| Status | Count |
|---|---|
| ✅ Built | 66 |
| 🔵 Built in / replaced | 18 |
| 🟡 Possible later | 2 |
| ⚪ Not applicable | 78 |
| ⛔ Deliberately not built | 2 |
| **Total Vencord plugins** | **166** |

> **Why are there so many "not applicable"?** Vencord is made for Discord. Many plugins work with things Yapper does not have (Nitro, stickers, forums, Rich Presence, Spotify, server profiles) or fix Discord-specific bugs. Plugins also cannot be taken over 1-to-1, because Vencord writes patches against Discord's code; YapCord has to rewrite every plugin against Yapper's own code.

## Core Vencord features that are included

| Vencord feature | In YapCord |
|---|---|
| Plugins page with on/off switches and options | ✅ Section **YapCord Settings → Plugins** in Yapper's own settings window, with search, filter and per-plugin options; switching a plugin on or off only saves the choice; a "Restart required" notice then explains that it takes effect after a reload (you stay logged in) and offers a Reload button. Always-on features that have their own options (RoundedCorners' corner size, PushToTalk's key, and so on) get a separate **Always-on** page instead, since they have nothing to switch on or off. |
| Themes (`.theme.css`, with `@name`/`@author` header) | ✅ Folder `%APPDATA%\YapCord\themes`; switch on, import, delete; files are reloaded live. 22 themes are included (Dracula, Nord, Tokyo Night, Catppuccin, Gruvbox, Solarized, One Dark and more); BetterDiscord themes do not work directly, because Yapper has different class names. Local Themes and Online Themes are two tabs on the **Themes** page, like Vencord. |
| Online themes (links to CSS) | ✅ Through the `themeLinks` setting - one link per line in a single box on the **Themes → Online Themes** tab, same as Vencord's. |
| QuickCSS | ✅ A Custom CSS editor, saved in `quickCss.css` and applied live - no longer its own tab (like Vencord, it wasn't meant to be one); reached through the "Edit Custom CSS" quick action on the **YapCord** and **Themes** pages. |
| Settings backup/restore | ✅ **Backup & Restore** page: exports plugin settings, layout/window settings, Custom CSS, theme links and your local theme files to one JSON file. |
| Patch system for plugins (`patches`) | ✅ `YM.patches` (comparable to Vencord) on top of Yapper's Turbopack modules. |
| Plugin API (`definePlugin`, options, cleanup) | ✅ `YM.definePlugin`; see the README for an example. |
| Web/Electron features of Vesktop (tray, autostart, screen sharing, badge) | ✅ System tray, "close to tray", autostart, screen-share picker, taskbar badge - now set from the **YapCord** page's Settings list (the old separate "App" tab was folded into it). |
| Diagnostics / support info | ✅ `window.YapperMod.diagnostics()` in DevTools (no personal data) - the old "About & Diagnostics" settings page was removed by request; the data itself is unchanged, there's just no page to view it on any more. |
| Updater (Vencord settings → Updater) | ✅ No settings page (removed by request) - updating still happens automatically in the background through a GitHub repository, with a toast when an update is ready; it becomes active at the next start of Yapper (falling back to the previous version if it does not start). |
| Installer (Vencord Installer) | ✅ **YapCord Installer**: one `.exe` with Install, Reinstall / Repair, Uninstall and Start Yapper for the official Yapper app. |
| Own layout (not in Vencord) | ✅ **Layout** page: drag the three columns (servers, channels/DMs, chat) into any order, or use the arrows, plus size of server icons, list width, message avatar size, text size, spacing between messages and zoom of the whole app. CSS only; *Reset* brings everything back. |

## Always-on features

Most of these used to be plugins, or could have been; they are now just part of YapCord, running for everyone, with no on/off switch and no entry in **YapCord → Plugins** (options for the ones that have them live on the **YapCord → Always-on** page instead). **YapCordBadge**, **UIPolish**, **ParticleFX**, **MotionSuite**, **OnboardingPolish** and **NoGifAds** are the exceptions - they were never toggleable plugins: YapCordBadge because a "who uses YapCord" signal only makes sense if everyone has it, UIPolish, ParticleFX and MotionSuite because their whole point - a handful of small touches, a burst of particles, motion on YapCord's own menus and components - is something you'd expect to just be there, not something you have to remember to switch on, OnboardingPolish because it restyles a Yapper settings page you'd only ever half-use with it off, and NoGifAds because nobody wants to see the ad it hides.

| Feature | What it does |
|---|---|
| **AvatarEffects** | Recolour the avatar decorations Yapper already shows (ice, rainbow, toxic, ...) with a filter: black & white, sepia, inverted, or your own hue shift. Off by default - local to you; doesn't grant or change anyone's decoration. |
| **CallPing** | Shows your connection ping (ms) in the user bar while you're in a voice channel, read from the browser's own WebRTC stats. Only visible during a call. How often it refreshes is adjustable in the options. |
| **ChannelNotes** | Give any channel your own private note, like a sticky note only you see. Yapper has no channel descriptions yet, so this is local to you. |
| **CharacterCounter** | Shows a character counter in the message box that turns yellow and red near the limit. Set to always show, or only from 50% of the limit, in the options. |
| **DoubleTapReact** | Double-click a message's text to react with one emoji straight away, like a double-tap "like" on a phone. |
| **EmojiPickerOrder** | Orders each server's own section in the emoji picker to match your real server list - the server at the top of your list comes first - instead of Yapper's own order. |
| **EmojiPreview** | Click a custom emoji in a message to see its name, a bigger preview and which server it's from, with a way to jump to that server (never a fabricated invite link - if the server can't be found, it says so instead of making one up). Click a plain Yapper or device emoji and it just says "default emoji". |
| **FixCodeblockGap** | Removes the gap Yapper leaves between a code block and the text right below it in a message. |
| **FriendNicknames** | Give a friend a nickname that only you see, like on Roblox. It shows in the friends list, chats, messages, voice and profile cards. Right-click their message, their profile card, or their chat in your DM list to set it. |
| **HideChannels** | Right-click a channel to hide it from your own sidebar. Only you see it hidden; bring it back any time from this feature's own options. |
| **HideMedia** | Adds a button to messages with pictures or videos to hide or show their media. |
| **IdleVoiceControls** | Discord-style Mute/Unmute and Deafen/Undeafen buttons in the account bar (bottom-left), there even before you join a call - not just during one. Mute or deafen yourself ahead of time and it applies the instant you connect; replaces the "mentions" shortcut that used to sit there (the plugins button stays). Each button's small chevron opens a dropdown mirroring Yapper's own in-call menu: Input Device, Input Volume and Push to Talk for the mic; Output Device for the headphone; a Voice Settings link on both. Input/Output Device and Input Volume are real, working controls - not just for show. Two things are honestly out of scope: "Input Profile" (nothing in Yapper's own code says what it's for) and a real Yapper "Voice Settings" tab to link to (there isn't a confirmed one, so it opens YapCord's own Plugins page instead). |
| **ImageFilename** | Shows the file name of a picture or GIF as a tooltip, and uses it as the alt text (instead of just "GIF"). |
| **KeepCurrentChannel** | Reopens the chat or channel you were in when you start or reload Yapper. |
| **MemberCount** | Shows how many members are online and the server's total member count at the top of the member list - a green filled dot for online, a hollow grey dot for the total, the same style Discord uses. |
| **MessageEncryption** | Right-click a chat to set a shared key on it, and your messages there are scrambled (AES-256) before they ever reach Yapper's own servers - unreadable to anyone without that same key, Yapper included. Whoever you're chatting with needs the exact same key (share it however you already trust - that part is on you, same as any shared-password scheme). Text only, by design - see the note below the table for why voice calls aren't covered. |
| **MessageFX** | A reaction pops in when it appears on a message, and the send button flourishes when you send. Respects "reduce motion". |
| **MoreQuickReactions** | Adds extra emojis (12 by default) to the quick reactions in the right-click menu of a message (Yapper shows 4) - device/OS emoji pickers can't be used for a reaction at all, since reacting calls Yapper's own function with a plain codepoint, not whatever a device picker would insert into a text field. |
| **MotionSuite** | Motion for everything SmoothTransitions/UIPolish/ParticleFX/MessageFX never reached: YapCord's own menus and panels slide or pop in instead of just appearing - the Settings page chief among them, which now slides in from the right every time you open it or switch pages, instead of just snapping into view - and over 100 of YapCord's own smaller pieces across every plugin's menus and cards (badges, pills, rows, buttons, marks, spoilers, and more) get their own hover, press or entrance motion for the first time. Grouped into switches by family, so a part of it can be turned off without losing the rest. Respects "reduce motion" throughout. |
| **NameEffects** | Give names in chat an effect: rainbow, gradient, fire, ocean, ice, toxic, aurora, chrome, glow, neon, sparkle, or your own two colours. Only you see it. Choose whose names get it. |
| **NoGifAds** | Hides the sponsored product banner (e.g. an AliExpress ad) that Yapper's own GIF picker shows above the search results. |
| **NoMosaic** | Shows several pictures in one message one below the other, uncropped, instead of as a square grid. |
| **NoSystemBadge** | Disables the unread count badge on the taskbar/dock icon, so the icon stays plain. No longer has an off switch anywhere - an icon with nothing drawn over it is the only thing that makes sense as the default. |
| **NoTrack** | Blocks analytics and tracking requests (Vercel Analytics, Sentry, Google Analytics, ...). |
| **OnboardingPolish** | Restyles Server Settings → Onboarding (the server-owner page where you set up join questions) into clear, numbered sections - turning it on, where people land, the questions - and boxes off each question's own answers, so the page stays readable once you've added a few questions instead of turning into one long run-on list. Every real field, dropdown and button is Yapper's own, untouched - this only changes what groups and spacing wrap around them, so it quietly does nothing if a future Yapper update reshapes the page. |
| **ParticleFX** | A burst of colour when you send a message or react, and a sweep of your accent colour across the top when you switch channels or servers. |
| **PermissionsViewer** | Adds "Permissions" to a profile card (what the member can do in the open server) and "Roles and permissions" to the server menu. Calculated from the roles Yapper already loaded; channel-specific overrides are not included. |
| **PinDMs** | Pin chats to the top of your DM list. Right-click a chat and choose Pin chat; reorder or unpin in the options. Only ever adds that one entry to Yapper's own real right-click menu - it no longer builds a menu of its own, so Yapper's own menu is always the one you see. |
| **PreviewMessage** | Adds a Preview button next to the message box that shows how your message will look (bold, quotes, code, links, mentions) without sending it. |
| **PushToTalk** | Stay muted in voice calls by default; hold a key to talk, let go to mute again - like push-to-talk in a game. The feature itself is always loaded, but the actual muting is off until you switch it on with its own "Enabled" option - pick your key and whether it mutes you automatically on joining a call there too. |
| **ReadAllNotificationsButton** | Adds a "Read All" button under the logo in the server list that marks all chats as read. A right-clicked folder also gets its own "Mark as Read" entry, next to Yapper's own folder options, that marks every channel of every server in that folder read. |
| **ReplyPingDot** | Shows a dot (amber for replies, red for pings and DMs) on the server and the chat when someone replies to you, pings you or DMs you. It stays until you open that chat. Off by default for every reason - switch on whichever you want on the **YapCord → Always-on** page. |
| **RestartShortcut** | Ctrl+R (Cmd+R on Mac) reloads YapCord in place - the same soft restart every Reload button in Settings already does - instead of a hard browser refresh, and without closing the app. |
| **RoleReorderConfirm** | Asks "are you sure?" before a dragged role reorder in Server Settings → Roles is actually saved, so a drag triggered by accident while scrolling the list (easy on a touch screen) doesn't quietly go through. **Honest limit:** Yapper's current build exports the function behind this as frozen - JavaScript won't let anything replace a frozen property, YapCord included - so the confirmation cannot actually install itself right now. It detects this safely (never crashes, never blocks a real reorder) and simply does nothing rather than pretending to work; real reorders go through exactly as they would without YapCord. A real fix needs a different technique - rewriting that function's own source before Yapper runs it, the way `YM.patches` already does elsewhere - anchored on something sturdier than the one-letter variable name a minifier happened to pick in the one cached build this was checked against. |
| **RoundedCorners** | Make menus, dialogs, the message box and buttons sharper or rounder, and choose round, rounded or square avatars, in the options. |
| **ScreenShareAudioToggle** | Makes sure starting a screen share always offers a real choice to include its audio or leave it off, in the browser extension and bookmarklet. The desktop app already has its own picker for this (see 1.6.0 below); this closes the same gap for the web-based ways of running YapCord. |
| **ScreenShareQuality** | Makes the screen share sender deliver the size and frame rate Yapper captured (instead of the video SDK's 15 fps / 3 Mbps cap) and lets you pick sharp text or smooth motion. Never asks for more than Yapper captured. |
| **ServerInfo** | Adds "Server info" to the menu of a server (click the server name): owner, creation date, members, channels, roles and emojis. |
| **ShikiCodeblocks** | Adds syntax colours to code blocks in messages (JavaScript, Python, C-like languages, Go, Rust, shell, SQL, JSON, HTML, CSS...). Uses a small built-in highlighter, not the Shiki library. |
| **SlashModeration** | Type /kick, /ban, /unban, /mute, /unmute, /nick, or /vmute, /vunmute, /vkick, /vban, /vunban for voice, in the message box - the same real actions and the same real permissions as Yapper's own right-click menu, just faster to reach. While you're still typing the command word, a suggestion popup lists the matches, built from the exact same real markup as Yapper's own "/" picker, so it looks like part of the same list. |
| **SmoothTransitions** | Smoother motion: menus ease in, dialogs slide in from the right instead of just appearing, hover colours fade, new messages slide in and switching chats fades. Respects "reduce motion". |
| **SpellcheckGuard** | Keeps the message box's spellcheck switched on, so right-clicking a misspelled word always offers real suggestions - the browser's or Electron's own native spellchecker, just guaranteed never to get switched off under you. |
| **SwipeNavigation** | On a touch screen, swipe left-to-right anywhere to go back, like Discord's own mobile swipe-back gesture - calls the browser's own `history.back()`, since there's no confirmed real selector for Yapper's own back button to anchor on. Right-to-left is deliberately left doing nothing rather than `history.forward()`, which only ever replayed you straight back into the channel you'd just left. Also takes over Yapper's own swipe-to-reply on messages (caught before it reaches the message's own listener), so a swipe never also fires a reply - reply stays reachable the one way: hold a message, then tap Reply. Has no effect on a device with no touchscreen. |
| **UIPolish** | Tasteful touches on top of Yapper's own look, no new theme: buttons and server icons lift and glow on hover (with a springy, slightly bouncy feel instead of a flat ease), avatars pop up with a gradient accent ring on hover, a smoother ease on the server list's unread/active indicator, the server icon you currently have open gently pulses with your accent colour (the one distinctly "YapCord" always-visible touch), a wider, softer glow around the message box while it's focused, and a slimmer accent-tinted scrollbar for the chat list and emoji picker. Each touch can be switched off on its own; respects "reduce motion" (the scrollbar recolour isn't motion, so it stays). |
| **Unindent** | Removes the extra indentation from code blocks in messages you send (handy when you paste code from the middle of a file). |
| **UploadCompressor** | Shrinks images and videos to fit Yapper's upload limit (10 MB without Plus) before they are sent. Videos are re-encoded in real time. |
| **UserVoiceShow** | Shows a speaker icon next to the name of people who are in a voice channel (in messages and your chat list). |
| **VoiceDownload** | Adds a download button to voice messages and audio files in chat. |
| **YapCordBadge** | Lets YapCord users spot each other. Adds an invisible marker to the end of your own profile bio (your real, visible bio text is never touched or cut short to make room) and shows a small round accent-gradient "Y" badge next to the name of anyone else whose bio carries the same marker - mutual by construction, since your badge only exists because your own bio carries it too, and it works the same on every build (desktop, extension, bookmarklet, Android) since it's the same shared code underneath. No toggle: there is nothing to turn off, because without it running on both ends neither side would show up for the other. See the note below the table. |

> **Why isn't MessageEncryption's key shared automatically, and why no voice-call encryption?** Agreeing on a key is deliberately left to you and whoever you're talking to - there's no secure way for YapCord to hand it over on its own without first solving the much harder problem of verifying who's actually on the other end, and a false sense of security there would be worse than being upfront that this is a shared-password scheme. Voice calls are left uncovered on purpose, for the same honesty reason: Yapper's calls run through its own voice infrastructure that YapCord does not control end-to-end, and bolting encryption onto that from the outside risks either breaking calls outright or giving a false impression of a secure call that isn't one - text, where YapCord fully controls what gets sent, is the part this can actually promise.

> **YapCordBadge writes to your real profile.** There is no YapCord server of any kind, so the only place two YapCord clients can leave a signal for each other is a place already shared between any two Yapper accounts - the profile bio. On first start, YapCordBadge adds a handful of invisible characters to the end of your bio through Yapper's own real profile-save call (the same one the Edit Profile page uses); nothing else on your profile is touched, your visible bio text is never shortened to make room (if there isn't room for the marker, it leaves your bio alone and says so), and it only tries once per app start, not on a timer. Run `YM.plugins.get('YapCordBadge').api.statusText()` in DevTools for its status (or `.retry()` / `.removeFromBio()` to retry or undo it), or check `lastStatus` in `window.YapperMod.diagnostics()`.
>
> **Why doesn't the badge always show up right away?** The badge only appears once *your* Yapper client has actually loaded the other person's full profile (their bio) - it watches for that and re-checks automatically, but if you've genuinely never opened their profile card this session, Yapper itself hasn't fetched their bio yet and there's nothing for YapCord to check. There's no confirmed way to force an eager fetch of someone's full profile without guessing at an unconfirmed Yapper function, so this is a real, honest limit rather than a bug that can be patched away: open their profile once (or just wait - any later profile load re-checks every visible message) and the badge catches up.

## YapCord plugins

Nothing is on by default: every plugin below starts off, and you switch it on yourself in **YapCord → Plugins**. Every plugin was tested against a copy of Yapper's real code, but not on the live site or in a real Windows Electron window.

| Plugin | What it does | Options |
|---|---|---|
| **AccentColor** | Choose your own accent colour for buttons, highlights, switches and unread dots in all of Yapper. | `color` |
| **AnonymiseFileNames** | Gives uploaded files a random name so the original file name (which may contain your name or details) is not shared. | `method`, `length`, `consistent` |
| **AutoTranslate** | Automatically translates new messages from other people to English as they come in, using Yapper's own real Translate feature - no setup, no API key. Only acts where a server already has Translate turned on, and only for messages that arrive after you turn this on. | - |
| **BackgroundImage** | Put your own picture behind Yapper. Panels become see-through so it shows; blur and dimming are adjustable. | `picture`, `dim`, `blur`, `glass` |
| **BetterFolders** | Shows the servers of an open folder in a dedicated sidebar and adds folder related improvements. | `sidebar`, `sidebarAnim`, `keepIcons`, `showFolderIcon`, `closeOthers`, `closeAllFolders`, `closeAllHomeButton`, `closeServerFolder`, `forceOpen` |
| **BetterRoleContext** | Right-click a role on someone's profile card to copy its colour as a hex code. | - |
| **BiggerStreamPreview** | Hover a screen share preview (the small picture of someone's stream) to see a much bigger version of it. | `width` |
| **CallTimer** | Shows how long you have been in the current voice channel or call. | `format` |
| **ClearURLs** | Removes tracking parameters (utm_*, fbclid, ...) from links before your message is sent. | `extraParams` |
| **ConsoleShortcuts** | Adds shortcuts to the console: ym, ymState(), ymStore, ymFind("name", ...), ymFindSource("text"), ymPlugins, ymDiag(). | - |
| **CopyEmojiMarkdown** | Right-click a custom emoji to copy it as <:name:id> (to use it somewhere else) or to copy the link to its picture. | - |
| **CopyFileContents** | Adds a button to text and code file attachments that copies the contents to your clipboard (files up to 1 MB). | - |
| **CopyUserURLs** | Right-click a username or avatar in chat and choose "Copy user ID". Yapper has no public profile link to copy instead, so this is the id. | - |
| **CustomCommands** | Make your own slash commands: /name sends a text you wrote. Use {args} for the words after the command, $1 $2 for single words, {user}, {channel}, {date} and {time}. | `commands` |
| **CustomFont** | Change the font of all of Yapper (system, rounded, serif, monospace, easy-to-read, or any font installed on your computer). | `preset`, `custom`, `size` |
| **CustomIcons** | Use your own picture for the Home button in the server list and for the app icon (window, taskbar and tray). | `homeIcon`, `appIcon` |
| **CustomIdle** | Set your own delay before Yapper marks you Idle (longer than its fixed 10 minutes), or turn auto-idle off. Doesn't touch Do Not Disturb or Invisible. | `mode`, `minutes` |
| **CustomKeybinds** | Your own hotkeys for: jump to the next unread chat, swap to the chat you were just in, open YapCord's settings, and focus the message box. Each is off until you set a combo like "ctrl+j". | `nextUnread`, `lastChannel`, `openSettings`, `focusComposer` |
| **CustomRingtone** | Choose the sound you hear when someone calls you: a built-in tune or your own audio file. Only you hear it. | `tune`, `volume`, `file` |
| **CustomServerIcons** | Give any server your own icon (a picture or an emoji) in your server list, just for you. Right-click a server and choose "Custom icon...". | `manage` |
| **GithubRepos** | Shows a small card (stars, description, language) under a message that links a plain github.com/owner/repo URL, fetched live from GitHub's public API. | - |
| **HideBadges** | Hide the badges next to names in chat (and optionally the verified, Plus and server-tag labels), and tidy up the badge row on profile cards. | `badges`, `verified`, `plus`, `tags`, `tidy` |
| **HideClutter** | Hide buttons you never use: GIF, polls, create server, discover, download app, the character counter and more. | `gif`, `poll`, `createServer`, `discover`, `download`, `charCount`, `emoji` |
| **ImageZoom** | Hover a picture in chat for a magnifier that follows your cursor. Scroll to zoom, Shift+scroll to resize the lens. | `zoom`, `size` |
| **IrcColors** | Gives every user a unique name color (like IRC clients). The same person always gets the same color. | `saturation`, `lightness`, `keepRoleColors` |
| **JumpToUnread** | A button next to the message box that jumps to about where your unread messages start in the open chat, counting back from Yapper's own unread count. Approximate, not exact. | - |
| **MarkAsUnread** | A hover button on each chat that marks it unread again as a reminder to come back - or marks a genuinely unread one read. The unread mark you set yourself is local-only (Yapper has no call to push a made-up unread state); a real new message, reload, or opening the chat overrides it. | - |
| **MarkdownTables** | Renders a GitHub-style markdown table typed in a message (\| a \| b \| / \|---\|---\|) as a real table underneath it. | - |
| **MentionAvatars** | Shows the avatar of the person inside @mentions in messages. | - |
| **MessageClickActions** | Double-click a message to edit it (your own messages) or reply to it (other people's messages). | `mode` |
| **MessageLatency** | Flags your own messages that took a while to appear after being sent, so a slow connection or a struggling server doesn’t go unnoticed. | `threshold` |
| **MessageLogger** | Keeps deleted messages on screen and shows what edited messages said before. Cleared when you reload. | `logDeletes`, `logEdits`, `deleteStyle`, `ignoreSelf`, `ignoreBots`, `ignoreUsers`, `ignoreChannels`, `log` |
| **MessageReminders** | Right-click a message and pick a time to be reminded about it: a notification, a toast, and a highlight if you're already looking at that chat. | `manage` |
| **MessageStyle** | Give messages a different look: cards, chat bubbles, divider lines, or just a soft highlight when you point at one. | `style` |
| **MiniSoundboard** | Play your own short sound clips into a voice call, mixed with your mic (and heard on your own speakers too). Bring your own clips - none are bundled. Settings-based storage, so keep clips short. | `clips` |
| **NameStyle** | Give anybody's name your own colour and font in chat (servers and direct messages). Only you see it. | `manage` |
| **NavigationFX** | Extra motion for the sidebar: a new DM pops in when it arrives, the chat/channel you open briefly highlights in the list, and switching servers pulses its icon. Respects "reduce motion". | `dmArrival`, `rowOpen`, `serverSwitch` |
| **NoBlockedMessages** | Hides messages from blocked users completely instead of showing a "Blocked message" placeholder. | - |
| **NoPendingCount** | Removes the number of incoming friend requests from the Friends tab, the chat list and the Home button in the server list. | - |
| **NoServerEmojis** | Hides custom server emojis in the suggestion list that appears when you type :name (normal emojis stay). | - |
| **NoTypingAnimation** | Stops the animated typing dots (saves a bit of CPU/GPU). | - |
| **NotificationSnooze** | A bell button that pauses Yapper’s desktop notification pop-ups for a while, then turns them back on by itself. | `minutes` |
| **NotificationVolume** | Sets the volume of the message notification sound. | `volume` |
| **OnePingPerDM** | Only ping once for a DM that already has unread messages. | `channelToAffect`, `allowMentions`, `allowEveryone` |
| **PetPet** | Adds the /petpet command: pet someone's avatar (user), a picture from the web (url) or one from your computer (image), and attach the GIF to your message. | `size`, `delay` |
| **PictureInPicture** | Adds a picture-in-picture button over videos in chat, so you can pop one out into a floating window. | - |
| **PinnedMessages** | A button next to the message box that lists the pinned messages you've already loaded in the open chat, with a jump-to button for each. | - |
| **PlainFolderIcon** | Closed server folders show a plain folder icon instead of the small icons of the servers inside. | - |
| **ProfileEffectScale** | Scale avatar decorations (ice, rainbow, toxic, ...) up or down on your own screen. Local to you; doesn't change what anyone has equipped. Very large sizes can overlap nearby UI - Yapper's layout doesn't reserve extra room for it. | `scale` |
| **QuickMention** | Adds a button to the message hover bar that mentions the author in your message box. | - |
| **QuickReply** | Ctrl+Up/Down in the message box picks the message to reply to; Ctrl+Shift+Up/Down picks one of your own messages to edit. | - |
| **QuickSwitcher** | Ctrl+K (Cmd+K on Mac) opens one search box over every server, channel, DM, group chat and friend - pick one to jump straight there. | - |
| **QuickToolbox** | A second button next to the YapCord icon with instant actions (Reload, DevTools, Relaunch) and on/off switches for plugins you pick. | `favourites` |
| **RecentEmojis** | Shows the emoji you picked most recently at the top of the composer's emoji picker, like Discord's "Frequently Used" - no more hunting for the one you always use. Does not add a Recent section to the reaction picker (same cell, but a different, more involved insertion path there - see the plugin's own notes). | `clear` |
| **RelationshipNotifier** | Shows a message when someone disappears from your friends list (they removed you, or you did on another device). | `requests` |
| **ReplyTimestamp** | Shows the time of the original message in reply previews. | - |
| **RevealAllSpoilers** | Ctrl+click a spoiler to reveal all spoilers in the message, Ctrl+Shift+click for the whole chat. | - |
| **RoleColorEverywhere** | Gives the colour of the top role to @mentions, the typing line and the voice channel lists (Yapper already colours names in messages). | `mentions`, `typing`, `voice` |
| **RichMagnetLinks** | Shows a small card with the torrent name under any magnet: link in a message, instead of just the raw link text. | - |
| **SearchContextMenu** | Adds "Search the web for ..." to selected text and "Search image with ..." to pictures in the right-click menu (desktop app only). | `text`, `textEngine`, `images`, `imageEngine` |
| **ServerAccent** | Give each server its own accent colour. Buttons, highlights and unread dots change when you open that server. Only you see it. | `manage` |
| **ServerListIndicators** | Shows the number of friends that are online and the number of servers you are in under the logo in the server list. | `mode` |
| **ShowAllMessageButtons** | Always shows the message action buttons (react, reply, more) instead of only when you hover a message. | - |
| **ShowMeYourName** | Shows the @username next to the display name in messages. | `onlyWhenDifferent` |
| **SilentTyping** | Hides your typing indicator from others (the 'is typing...' dots). | - |
| **TextReplace** | Replaces text in the messages you send (for example "shrug" -> a shrug emoticon). Supports regular expressions. | `rules` |
| **ThemeAttributes** | Adds data attributes (author id, own messages, current channel) to elements so themes and Custom CSS can target them. | - |
| **ThemePresets** | One click for a whole look: accent colour, font, corner roundness and message style together, instead of tuning each one by hand. Pick a different preset any time. | `gallery` |
| **TypingIndicator** | A small dot on a chat's sidebar row when someone is typing there, for chats you don't currently have open. | - |
| **TypingTweaks** | Shows the avatars of the people who are typing in the typing line under the message box (role colours: see RoleColorEverywhere). | - |
| **UserMessagesPronouns** | Shows pronouns from user profiles next to their name in messages. | - |
| **UnitConverter** | Shows a converted value next to units in a message (km↔mi, kg↔lb, °C↔°F, cm↔ft) - never changes the message itself, just adds a small hint under it. | `show` |
| **VcNarrator** | Reads out with a voice (the one of your system) who joins or leaves the voice channel you are in. | `volume`, `rate`, `joinText`, `leaveText`, `you` |
| **ViewIcons** | Ctrl+click any avatar to view it full size in Yapper's picture viewer (with zoom). | - |
| **ViewRaw** | Adds a button to messages that shows the raw message data and lets you copy it as JSON or as plain text. | - |
| **VoiceChanger** | A robotic ring-modulation effect on your own mic, so you sound different in calls and voice messages. Experimental: never tested with a real ear. | `freq` |
| **VoiceChatDoubleClick** | Joins a voice channel only after a double-click (Yapper joins on a single click, which is easy to do by accident). | - |
| **WordFilter** | Hide swear words, words you choose and people you muted on your own screen: blurred, as a bar, or the whole message collapsed. Click to look anyway. | `mode`, `common`, `words`, `lookalikes`, `users`, `notifications` |
| **WriteUpperCase** | Sends everything you type in FULL CAPS, automatically. | - |
| **oneko** | A small cat follows your mouse pointer around Yapper. It sits when it reaches you and sleeps when you stop moving. | `speed` |

`NoTrack` comes from Vencord's core (`_core/noTrack`). **UploadCompressor**, **CustomIcons**, **CustomServerIcons**, **FriendNicknames**, **AccentColor**, **RoundedCorners**, **CustomFont**, **HideClutter**, **MessageStyle**, **BackgroundImage**, **WordFilter**, **ReplyPingDot**, **CustomRingtone**, **ServerAccent**, **NameStyle**, **HideBadges**, **HideChannels**, **PinnedMessages**, **JumpToUnread**, **NotificationSnooze**, **CustomKeybinds**, **QuickToolbox**, **AutoTranslate**, **PushToTalk** and **ThemePresets** are YapCord's own plugins (they do not exist in Vencord); the other plugins are rewritten versions of Vencord plugins with the same name. `SearchContextMenu` replaces two Vencord plugins in one (ReplaceGoogleSearch and ReverseImageSearch). **ScreenShareQuality**, **NameEffects**, **SmoothTransitions**, **AvatarEffects**, **ChannelNotes**, **PinDMs**, **ReadAllNotificationsButton**, **DoubleTapReact**, **MessageFX**, **SlashModeration**, **FixCodeblockGap**, **CallPing**, **CharacterCounter**, **FriendNicknames**, **HideChannels**, **HideMedia**, **ImageFilename**, **KeepCurrentChannel**, **MemberCount**, **NoMosaic**, **NoSystemBadge**, **NoTrack**, **PermissionsViewer**, **PreviewMessage**, **PushToTalk**, **ReplyPingDot**, **RoundedCorners**, **ServerInfo**, **ShikiCodeblocks**, **Unindent**, **UploadCompressor**, **UserVoiceShow** and **VoiceDownload** used to be (or could have been) plugins too; they are now always-on features, listed separately above. **YapCordBadge** is also an always-on feature and also has no Vencord equivalent, but unlike the plugins just listed it was never toggleable to begin with - see the always-on table above. **GithubRepos**, **MarkdownTables**, **RichMagnetLinks**, **UnitConverter** and **WriteUpperCase** are ports from [Equicord](https://github.com/Equicord/Equicord) (a Vencord fork with extra community plugins), not from Vencord itself - added in 1.32.0 after a pass through Equicord's plugin list for ones that are pure client-side logic (text parsing, a GitHub API call, a message decoration) with nothing that needs an unconfirmed Yapper-specific selector or API.

## All 166 Vencord plugins

Descriptions are Vencord's own text.

| Vencord plugin | Status | What it does (Vencord) | Note |
|---|---|---|---|
| AccountPanelServerProfile | ⚪ Not applicable | Right click your account panel in the bottom left to view your profile in the current server | Yapper has no separate server profiles. |
| AddAttachments | ⚪ Not applicable | Allows you to add new attachments while editing messages | Discord-specific editing of attachments. |
| AlwaysAnimate | ⚪ Not applicable | Animates anything that can be animated | Yapper does not freeze animated avatars or emoji the way Discord does by default. |
| AlwaysExpandRoles | ⚪ Not applicable | Always expands the role list in profile popouts | No collapsed role list found in Yapper. |
| AlwaysTrust | ⚪ Not applicable | Removes the annoying untrusted domain and suspicious file popup | Yapper has no "untrusted domain" pop-up. |
| AnonymiseFileNames | ✅ Built | Anonymise uploaded file names | Built as **AnonymiseFileNames**. |
| AutoDNDWhilePlaying | ⚪ Not applicable | Automatically updates your online status (online, idle, dnd) when launching games | Yapper does not detect games being played. |
| BetterFolders | ✅ Built | Shows server folders on dedicated sidebar and adds folder related improvements | Built as **BetterFolders**. |
| BetterGifAltText | ✅ Built | Change GIF alt text from simply being 'GIF' to containing the gif tags / filename | Built as **ImageFilename**. |
| BetterGifPicker | ⚪ Not applicable | Makes the gif picker open the favourite category by default | Yapper's own GIF search now has this itself. |
| BetterRoleContext | ✅ Built | Adds options to copy role color / edit role / view role icon when right clicking roles in the user profile or in the member list | Built as **BetterRoleContext**. |
| BetterRoleDot | ⚪ Not applicable | Copy role colour on RoleDot (accessibility setting) click. Also allows using both RoleDot and coloured names simultaneously | Discord-specific role dot. |
| BetterSessions | ⚪ Not applicable | Enhances the sessions (devices) menu. Allows you to view exact timestamps, give each session a custom name, and receive notifications about new sessions. | Discord-specific sessions menu. |
| BetterSettings | ⚪ Not applicable | Enhances your settings-menu-opening experience | Discord-specific settings menu. |
| BetterUploadButton | 🔵 Built in / replaced | Upload with a single click, open menu with right click | Yapper has this itself: the upload button opens the file picker with a single click. |
| BiggerStreamPreview | ✅ Built | This plugin allows you to enlarge stream previews | Built as **BiggerStreamPreview**. |
| BlurNSFW | ⚪ Not applicable | Blur attachments in NSFW channels until hovered | Yapper scans uploads itself; there is no Discord-style NSFW blur setting to adjust. |
| CallTimer | ✅ Built | Adds a timer to vcs | Built as **CallTimer**. |
| CharacterCounter | ✅ Built | Adds a character counter to the chat input | Built as **CharacterCounter**. |
| ClearURLs | ✅ Built | Automatically removes tracking elements from URLs you send | Built as **ClearURLs**. |
| ClientTheme | 🔵 Built in / replaced | Recreation of the old client theme experiment. Add a color to your Discord client theme | Replaced by Themes and Custom CSS (see "Core features"). |
| ColorSighted | ⚪ Not applicable | Removes the colorblind-friendly icons from statuses, just like 2015-2017 Discord | Discord-specific status icons. |
| ConsoleJanitor | ⚪ Not applicable | Disables annoying console messages/errors | Yapper does not clutter the console the way Discord does. |
| ConsoleShortcuts | ✅ Built | Adds shorter Aliases for many things on the window. Run `shortcutList` for a list. | Built as **ConsoleShortcuts**. |
| CopyEmojiMarkdown | ✅ Built | Allows you to copy emojis as formatted string (<:blobcatcozy:1026533070955872337>) | Built as **CopyEmojiMarkdown**. |
| CopyFileContents | ✅ Built | Adds a button to text file attachments to copy their contents | Built as **CopyFileContents**. |
| CopyStickerLinks | ⚪ Not applicable | Adds the ability to copy & open Sticker links | Yapper has no stickers. |
| CopyUserURLs | ✅ Built | Adds a 'Copy User URL' option to the user context menu. | Built as **CopyUserURLs**. |
| CrashHandler | 🔵 Built in / replaced | Utility plugin for handling and possibly recovering from crashes without a restart | The app reloads the page automatically if the window crashes; plugin errors are caught per plugin. |
| CustomCommands | ✅ Built | Allows you to create custom slash commands / tags | Built as **CustomCommands**. |
| CustomIdle | ✅ Built | Allows you to set the time before Discord goes idle (or disable auto-idle) | Built as **CustomIdle**. |
| CustomRPC | ⚪ Not applicable | Add a fully customisable Rich Presence (Game status) to your Discord profile | Rich Presence (RPC) does not exist in Yapper. |
| Dearrow | ⚪ Not applicable | Makes YouTube embed titles and thumbnails less sensationalist, powered by Dearrow | No YouTube embed replacement in Yapper. |
| Decor | ⚪ Not applicable | Create and use your own custom avatar decorations, or pick your favorite from the presets. | Third-party Discord service for avatar decorations. |
| DevCompanion | ⚪ Not applicable | Dev Companion Plugin | Developer tool for Vencord itself. |
| DisableCallIdle | ⚪ Not applicable | Disables automatically getting kicked from a DM voice call after 3 minutes and being moved to an AFK voice channel. | No automatic call timeout found in Yapper. |
| DisableDeepLinks | 🔵 Built in / replaced | Disables Discord's stupid deep linking feature which tries to force you to use their Desktop App | Not needed: the app does not open "Open in app" windows. |
| DontRoundMyTimestamps | 🟡 Possible later | Always rounds relative timestamps down, so 7.6y becomes 7y instead of 8y | Feasible: Yapper has the part; not built yet. |
| Experiments | ⚪ Not applicable | Enable Access to Experiments & other dev-only features in Discord! | Unlocks Discord-internal features; Yapper has none. |
| ExpressionCloner | 🟡 Possible later | Allows you to clone Emotes & Stickers to your own server (right click them) | Feasible: Yapper has the part; not built yet. |
| F8Break | ⚪ Not applicable | Pause the client when you press F8 with DevTools (+ breakpoints) open. | Developer tool; DevTools are already available through the menu. |
| FakeNitro | ⛔ Deliberately not built | Allows you to send fake emojis/stickers, use nitro themes, and stream in nitro quality | Deliberately not built: gets around a paid feature. Yapper has no Nitro either. |
| FakeProfileThemes | ⚪ Not applicable | Allows profile theming by hiding the colors in your bio thanks to invisible 3y3 encoding | Yapper has no Nitro profile themes. |
| FavoriteEmojiFirst | 🔵 Built in / replaced | Puts your favorite emoji first in the emoji autocomplete. | Yapper has this itself: the emoji picker already has a "★ Favorites" section (right-click an emoji to add it). |
| FixCodeblockGap | ✅ Built | Removes the gap between codeblocks and text below it | Built as **FixCodeblockGap**. |
| FixImagesQuality | ⚪ Not applicable | Improves quality of images by loading them at their original resolution | Discord-specific image proxy issue. |
| FixSpotifyEmbeds | ⚪ Not applicable | Fixes spotify embeds being incredibly loud by letting you customise the volume | Discord-specific embed fix. |
| FixYoutubeEmbeds | ⚪ Not applicable | Bypasses youtube videos being blocked from display on Discord (for example by UMG) | Discord-specific embed fix. |
| ForceOwnerCrown | ⚪ Not applicable | Force the owner crown next to usernames even if the server is large. | Discord-specific owner crown. |
| FriendInvites | ⚪ Not applicable | Create and manage friend invite links via slash commands (/create friend invite, /view friend invites, /revoke friend invites). | Discord-specific friend invites. |
| FullSearchContext | ⚪ Not applicable | Makes the message context menu in message search results have all options you'd expect | Discord-specific search result menu. |
| FullUserInChatbox | ⚪ Not applicable | Makes the user mention in the chatbox have more functionalities, like left/right clicking | Discord-specific chatbox. |
| GameActivityToggle | ⚪ Not applicable | Adds a button next to the mic and deafen button to toggle game activity. Right click it to toggle Spotify activity. | Discord game status does not exist in Yapper (what Yapper calls activities is something different). |
| GifPaste | 🔵 Built in / replaced | Makes picking a gif in the gif picker insert a link into the chatbox instead of instantly sending it | Yapper has this itself: a GIF you pick is added to the message you are writing and is not sent straight away. |
| GifProviderSwitcher | ⚪ Not applicable | Allows you to use Tenor or Giphy GIF search instead of Klipy | Yapper uses its own (Klipy) GIF search, with no other provider to switch to - and Tenor's API was shut down by Google in 2026, so this Vencord plugin no longer works there either. |
| GreetStickerPicker | ⚪ Not applicable | Allows you to use any greet sticker instead of only the random one by right-clicking the 'Wave to say hi!' button | Yapper has no stickers. |
| HideMedia | ✅ Built | Hide attachments and embeds for individual messages via hover button | Built as **HideMedia**. |
| IgnoreActivities | ⚪ Not applicable | Ignore activities from showing up on your status ONLY. You can configure which ones are specifically ignored from the Registered Games and Activities tabs, or use the general settings below | Discord game status does not exist in Yapper. |
| iLoveSpam | ⚪ Not applicable | Do not hide messages from 'likely spammers' | Discord-specific. |
| ImageFilename | ✅ Built | Display the file name of images & GIFs as a tooltip when hovering over them | Built as **ImageFilename**. |
| ImageLink | ⚪ Not applicable | Never hide image links in messages, even if it's the only content | Discord-specific handling of image links; Yapper opens images in its own viewer. |
| ImageZoom | 🔵 Built in / replaced | Lets you zoom in to images and gifs. Use scroll wheel to zoom in and shift + scroll wheel to increase lens radius / size | Yapper has this itself: the image viewer (lightbox) can zoom and drag. YapCord's own **ImageZoom** plugin adds a hover magnifier lens alongside it, for a closer look without opening the lightbox. |
| ImplicitRelationships | ⚪ Not applicable | Shows your implicit relationships in the Friends tab. | Discord-specific. |
| IrcColors | ✅ Built | Makes username colors in chat unique, like in IRC clients | Built as **IrcColors**. |
| KeepCurrentChannel | ✅ Built | Attempt to navigate to the channel you were in before switching accounts or loading Discord. | Built as **KeepCurrentChannel**. |
| LoadingQuotes | ⚪ Not applicable | Replace Discords loading quotes | Discord-specific loading texts. |
| MemberCount | ✅ Built | Shows the number of online members, total members, and users in voice channels on the server — in the member list and tooltip. | Built as **MemberCount**. |
| MentionAvatars | ✅ Built | Shows user avatars and role icons inside mentions | Built as **MentionAvatars**. |
| MessageClickActions | ✅ Built | Hold Backspace and click to delete, double click to edit/reply | Built as **MessageClickActions**. |
| MessageLatency | ✅ Built | Displays an indicator for messages that took ≥n seconds to send | Built as **MessageLatency**. |
| MessageLinkEmbeds | ⚪ Not applicable | Adds a preview to messages that link another message | Yapper has no message-link embeds. |
| MessageLogger | ✅ Built | Temporarily logs deleted and edited messages. | Built as **MessageLogger**. |
| MoreQuickReactions | ✅ Built | Increases the number of reactions available in the Quick React hover menu | Built as **MoreQuickReactions**. |
| MusicRichPresence | ⚪ Not applicable | Rich Presence for Last.FM/Listenbrainz | Rich Presence (RPC) does not exist in Yapper. |
| MutualGroupDMs | ⚪ Not applicable | Shows mutual group dms in profiles | Discord-specific profile section. |
| NewGuildSettings | ⚪ Not applicable | Automatically mute new servers and change various other settings upon joining | Discord-specific server notifications. |
| NoBlockedMessages | ✅ Built | Hides all blocked/ignored messages from chat completely | Built as **NoBlockedMessages**. |
| NoDevtoolsWarning | 🔵 Built in / replaced | Disables the 'HOLD UP' banner in the console. As a side effect, also prevents Discord from hiding your token, which prevents random logouts. | Not needed: Yapper shows no "HOLD UP" warning; DevTools are in the View menu. |
| NoF1 | ⚪ Not applicable | Disables F1 help bind. | Yapper has no F1 help key. |
| NoMaskedUrlPaste | ⚪ Not applicable | Pasting a link while having text selected will not paste as masked URL | Yapper has no masked-link pasting behaviour to change. |
| NoMiddleClickPaste | ⚪ Not applicable | Disable Linux middle-click paste - Linux only | Only relevant on Linux; this app is for Windows. |
| NoMosaic | ✅ Built | Removes Discord image mosaic | Built as **NoMosaic**. |
| NoOnboardingDelay | ⚪ Not applicable | Skips the slow and annoying onboarding delay | Discord-specific onboarding. |
| NoPendingCount | ✅ Built | Removes the ping count of incoming friend requests, message requests, and nitro offers. | Built as **NoPendingCount**. |
| NoProfileThemes | ⚪ Not applicable | Completely removes Nitro profile themes from everyone but yourself | Yapper has no profile themes. |
| NoReplyMention | ⚪ Not applicable | Disables reply pings by default | No reply-ping toggle in Yapper. |
| NoServerEmojis | ✅ Built | Do not show server emojis in the autocomplete menu. | Built as **NoServerEmojis**. |
| NoSystemBadge | ✅ Built | Disables the taskbar and system tray unread count badge. | Built as **NoSystemBadge**. |
| NotificationVolume | ✅ Built | Save your ears and set a separate volume for notifications and in-app sounds | Built as **NotificationVolume**. |
| NoTypingAnimation | ✅ Built | Disables the CPU-intensive typing dots animation | Built as **NoTypingAnimation**. |
| NoUnblockToJump | ⚪ Not applicable | Allows you to jump to messages of blocked or ignored users and likely spammers without unblocking them | Discord-specific blocked-message behaviour. |
| oneko | ✅ Built | cat follow mouse (real) | Built as **oneko**. |
| OnePingPerDM | ✅ Built | If unread messages are sent by a user in DMs multiple times, you'll only receive one audio ping. Read the messages to reset the limit | Built as **OnePingPerDM**. |
| OpenInApp | ⚪ Not applicable | Open links in their respective apps instead of your browser | No separate apps needed for these links. |
| OverrideForumDefaults | ⚪ Not applicable | Allows you to override default forum layout/sort order. you can still change it on a per-channel basis | Yapper has no forum channels. |
| PauseInvitesForever | ⚪ Not applicable | Brings back the option to pause invites indefinitely that stupit Discord removed. | Discord-specific. |
| PermissionFreeWill | ⚪ Not applicable | Disables the client-side restrictions for channel permission management. | Permissions are enforced by the server in Yapper; the client cannot get around that. |
| PermissionsViewer | ✅ Built | View the permissions a user or channel has, and the roles of a server | Built as **PermissionsViewer**. |
| petpet | ✅ Built | Adds a /petpet slash command to create headpet gifs from any image | Built as **PetPet**. |
| PictureInPicture | 🔵 Built in / replaced | Adds picture in picture to videos (next to the Download button) | Yapper has this itself: a picture-in-picture option for video. YapCord's own **PictureInPicture** plugin adds a one-click button on every video attachment as a shortcut to it. |
| PinDMs | ✅ Built | Allows you to pin private channels to the top of your DM list. To pin/unpin or re-order pins, right click DMs | Built as **PinDMs**. |
| PlainFolderIcon | ✅ Built | Dont show the small guild icons in folders | Built as **PlainFolderIcon**. |
| PlatformIndicators | ⚪ Not applicable | Adds platform indicators (Desktop, Mobile, Web...) to users | Yapper does not show platform info per user. |
| PreviewMessage | ✅ Built | Lets you preview your message before sending it. | Built as **PreviewMessage**. |
| QuickMention | ✅ Built | Adds a quick mention button to the message actions bar | Built as **QuickMention**. |
| QuickReply | ✅ Built | Reply to (ctrl + up/down) and edit (ctrl + shift + up/down) messages via keybinds | Built as **QuickReply**. |
| ReactErrorDecoder | ⚪ Not applicable | Replaces "Minified React Error" with the actual error. | Only useful during development. |
| ReadAllNotificationsButton | ✅ Built | Read all server notifications with a single button click! | Built as **ReadAllNotificationsButton**. |
| RelationshipNotifier | ✅ Built | Notifies you when a friend, group chat, or server removes you. | Built as **RelationshipNotifier**. |
| ReplaceGoogleSearch | ✅ Built | Replaces the Google search with different Engine(s) | Built as **SearchContextMenu**. |
| ReplyTimestamp | ✅ Built | Shows a timestamp on replied-message previews | Built as **ReplyTimestamp**. |
| RevealAllSpoilers | ✅ Built | Reveal all spoilers in a message by Ctrl-clicking a spoiler, or in the chat with Ctrl+Shift-click | Built as **RevealAllSpoilers**. |
| ReverseImageSearch | ✅ Built | Adds ImageSearch to image context menus | Built as **SearchContextMenu**. |
| ReviewDB | ⚪ Not applicable | Review other users (Adds a new settings to profiles) | Third-party service for Discord users. |
| RoleColorEverywhere | ✅ Built | Adds the top role color anywhere possible | Built as **RoleColorEverywhere**. |
| SecretRingToneEnabler | ⚪ Not applicable | Always play the secret version of the discord ringtone (except during special ringtone events) | Discord-specific ringtone. |
| SendTimestamps | ⚪ Not applicable | Send timestamps easily via chat box button & text shortcuts. Read the extended description! | Yapper has no Discord-style timestamp markup to send. |
| ServerInfo | ✅ Built | Allows you to view info about a server | Built as **ServerInfo**. |
| ServerListIndicators | ✅ Built | Add online friend count or server count in the server list | Built as **ServerListIndicators**. |
| ShikiCodeblocks | ✅ Built | Brings vscode-style codeblocks into Discord, powered by Shiki | Built as **ShikiCodeblocks**. |
| ShowAllMessageButtons | ✅ Built | Always show all message buttons no matter if you are holding the shift key or not. | Built as **ShowAllMessageButtons**. |
| ShowConnections | ⚪ Not applicable | Show connected accounts in user popouts | No linked accounts in Yapper profiles. |
| ShowHiddenChannels | ⚪ Not applicable | Show channels that you do not have access to view. | Channels you have no access to are blocked server-side. |
| ShowHiddenThings | ⚪ Not applicable | Displays various hidden & moderator-only things regardless of permissions. | Discord-specific. |
| ShowMeYourName | ✅ Built | Display usernames next to nicks, or no nicks at all | Built as **ShowMeYourName**. |
| ShowTimeoutDuration | ⚪ Not applicable | Shows how much longer a user's timeout will last, either in the timeout icon tooltip or next to it | Discord-specific. |
| SilentMessageToggle | ⚪ Not applicable | Adds a button to the chat bar to toggle sending a silent message. | Yapper has no silent messages. |
| SilentTyping | ✅ Built | Hide that you are typing | Built as **SilentTyping**. |
| SortFriendRequests | ⚪ Not applicable | Sorts friend requests by date of receipt | Discord-specific friend-request list. |
| SpotifyControls | ⚪ Not applicable | Adds a Spotify player above the account panel | No Spotify integration in Yapper. |
| SpotifyCrack | ⛔ Deliberately not built | Free listen along, no auto-pausing in voice chat, and allows activity to continue playing when idling | Deliberately not built: gets around Premium limits of another service. |
| SpotifyShareCommands | ⚪ Not applicable | Share your current Spotify track, album or artist via slash command (/track, /album, /artist) | No Spotify integration in Yapper. |
| StartupTimings | ⚪ Not applicable | Adds Startup Timings to the Settings menu | Only for Discord developers. |
| StickerPaste | ⚪ Not applicable | Makes picking a sticker in the sticker picker insert it into the chatbox instead of instantly sending | Yapper has no stickers. |
| StreamerModeOnStream | ⚪ Not applicable | Automatically enables streamer mode when you start streaming in Discord | Yapper has no streamer mode. |
| SuperReactionTweaks | ⚪ Not applicable | Customize the limit of Super Reactions playing at once, and super react by default | Yapper has no super reactions. |
| TextReplace | ✅ Built | Replace text in your messages. You can find pre-made rules in the #textreplace-rules channel in Vencord's Server | Built as **TextReplace**. |
| ThemeAttributes | ✅ Built | Adds data attributes to various elements for theming purposes | Built as **ThemeAttributes**. |
| Translate | 🔵 Built in / replaced | Translate messages with Google Translate, DeepL or Kagi. | Yapper has this itself: messages can be translated ("Translated from ..."). |
| TypingIndicator | ✅ Built | Adds an indicator if someone is typing on a channel. | Built as **TypingIndicator**. |
| TypingTweaks | ✅ Built | Show avatars and role colours in the typing indicator | Built as **TypingTweaks**. |
| Unindent | ✅ Built | Trims leading indentation from codeblocks | Built as **Unindent**. |
| UnlockedAvatarZoom | ⚪ Not applicable | Allows you to zoom in further in the image crop tool when changing your avatar | Discord-specific. |
| UnsuppressEmbeds | ⚪ Not applicable | Allows you to unsuppress embeds in messages | Discord-specific. |
| UserMessagesPronouns | ✅ Built | Adds pronouns to chat user messages | Built as **UserMessagesPronouns**. |
| UserVoiceShow | ✅ Built | Shows an indicator when a user is in a Voice Channel | Built as **UserVoiceShow**. |
| USRBG | ⚪ Not applicable | Displays user banners from USRBG, allowing anyone to get a banner without Nitro | Third-party service for Discord banners. |
| ValidReply | ⚪ Not applicable | Fixes "Message could not be loaded" upon hovering over the reply | Discord-specific bug fix. |
| ValidUser | ⚪ Not applicable | Fix mentions for unknown users showing up as '@unknown-user' (hover over a mention to fix it) | Discord-specific bug fix. |
| VcNarrator | ✅ Built | Announces when users join, leave, or move voice channels via narrator | Built as **VcNarrator**. |
| VencordToolbox | 🔵 Built in / replaced | Adds a button to the titlebar that houses Vencord quick actions | Replaced by the YapCord button next to the gear at the bottom and Ctrl+, for the settings. |
| ViewIcons | ✅ Built | Makes avatars and banners in user profiles clickable, adds View Icon/Banner/Avatar Decoration entries in the user, server and group channel context menu. | Built as **ViewIcons**. |
| ViewRaw | ✅ Built | Copy and view the raw content/data of any message, channel or guild | Built as **ViewRaw**. |
| VoiceChatDoubleClick | ✅ Built | Join voice chats via double click instead of single click | Built as **VoiceChatDoubleClick**. |
| VoiceDownload | ✅ Built | Adds a download to voice messages. (Opens a new browser tab) | Built as **VoiceDownload**. |
| VoiceMessages | ⚪ Not applicable | Allows you to send voice messages like on mobile. To do so, right click the upload button and click Send Voice Message | Yapper already has voice messages itself. |
| VolumeBooster | 🔵 Built in / replaced | Allows you to set the user and stream volume above the default maximum | Yapper has this itself: the user volume and stream volume sliders go up to 200%. |
| WebContextMenus | 🔵 Built in / replaced | Re-adds context menus missing in the web version of Discord: Links & Images (Copy/Open Link/Image), Text Area (Copy, Cut, Paste, SpellCheck) | Built in: right-click menu with spell checking, open/copy link, cut/copy/paste. |
| WebKeybinds | 🔵 Built in / replaced | Re-adds keybinds missing in the web version of Discord. Only works fully on Vesktop/Legcord, not inside your browser | Built in: menu with shortcuts (reload, zoom, full screen, DevTools). |
| WebPWA | 🔵 Built in / replaced | Makes Discord installable as an App (PWA). Enables notification badges, global key-binds and Discord's custom title bar. | Not needed: this already is an app, with notifications, taskbar badge and system tray. |
| WebRichPresence (arRPC) | ⚪ Not applicable | Client plugin for arRPC to enable RPC on Discord Web (experimental) | Rich Presence (RPC) does not exist in Yapper. |
| WebScreenShare | 🔵 Built in / replaced | Adds a screenshare options menu. Allows for changing resolution, framerate, encoding hints, and system audio settings. | Built in: the app has its own window to pick a screen or window (with sound on Windows). |
| WebScreenShareFixes | 🔵 Built in / replaced | Removes 2500kbps bitrate cap on chromium and vesktop clients and fixes CPU usage growing endlessly while screensharing. | Not needed in the app (Electron/Chromium). |
| WhoReacted | 🔵 Built in / replaced | Renders the avatars of users who reacted to a message | Yapper has this itself: hover over a reaction to see who reacted. |
| XSOverlay | ⚪ Not applicable | Forwards discord notifications to XSOverlay, for easy viewing in VR | Only for XSOverlay (VR) with Discord. |
| YoutubeAdblock | ⚪ Not applicable | Block ads in YouTube embeds and the WatchTogether activity via AdGuard | Discord-specific (Watch Together). |
