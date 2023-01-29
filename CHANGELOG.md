# Changelog

## v0.11 - Game Improvements II, Singleplayer

### v0.11.5 (January 29, 2023)
[`Further UI refactoring #99`](https://github.com/WillFlame14/jspuyo/pull/99)

**Changes:**
- Socket.io upgraded to v4, enabling typed events
- Added a store for keeping track of frontend state.
- Refactored ModalManager, StatusArea components.
- Reduced and simplified many socket events.
- Cleaned up settings and keybind components.
- Refactored out a lot of repetitive elements/functions from various modals.
- Added back the Fever and Tsu icons.
- Fixed a bug where spectating players were unable to join the room.
- Fixed a bug where changing settings in the guide had no effect.
- Possibly fixed various room update issues.

### v0.11.4 (January 23, 2023)
[`Bump for minor fixes #97`](https://github.com/WillFlame14/jspuyo/pull/97)

**Changes:**
- All navbar panels now start opened and are highlighted on hover.
- Gamemodes can be switched again.
- Background has been darkened to improve visibility.
- Game no longer ends without drawing the last frame (i.e. puyos finish squishing).
- Fixed guide simulator not working.

### v0.11.3 (April 21, 2022)
[`General improvements #89`](https://github.com/WillFlame14/jspuyo/pull/89)

**Changes:**
- Status component and navbar have been moved to Vue
- pages.ts has finally been removed!
- Removed cypress, as it just caused flaky pipelines without actually testing much
- Updated dependencies to safer versions
- Switched module bundler to esbuild from browserify

### v0.11.2 (May 30, 2021)
[`Add scoring system for games, ratings framework #81`](https://github.com/WillFlame14/jspuyo/pull/81)

**New features:**
- A rating system very similar to Hiku's Western Ranking has been implemented.
  - Currently, there is no way to access this rating system as Ranked matches do not function properly yet.
- Player names are now shown beneath boards to help identify who's who.
- Lobbies without a win condition now keeps track of total wins in the player list.
- Lobbies with a FT # win condition now do not return to the lobby between games, and each player's wins are tracked underneath their board.

**Other changes:**
- Fixed [`#60`](https://github.com/WillFlame14/jspuyo/issues/60), and likely other issues associated with the server not being able to figure out who won a game.
- CPUs no longer emit gameOver and gameEnd events twice (didn't cause any visible problems, but occasionally had some weird errors).
- Removed a lot of unnecessary/repeated code.

### v0.11.1 (March 12, 2021)
[`Various game fixes #66`](https://github.com/WillFlame14/jspuyo/pull/66)

**New features:**
- More animations!
  - Puyos now squish into the stack
  - Puyos now have a popping animation
  - The queue now has a shifting animation

**Other changes:**
- Position and Location classes combined into a Point class to reduce repetition and avoid name conflicts
- Game.ts now determines what action to perform based on its current "mode" rather than particular properties on certain states
- CPU games now correctly reset their timer for margin time between every game
- Add support for drawing with distinct width and height scaling
- Various tuning changes

### v0.11.0 (December 24, 2020)
[`Add guide and simulator #65`](https://github.com/WillFlame14/jspuyo/pull/65)

**New features:**
- A new guide to jspuyo! Can be visited under the Singleplayer tab or appending `/guide` to the URL.
  - New users will be automatically shown a popup asking if they want to view the guide.
  - The guide introduces the basics of the game and the controls, as well as some very basic strategy.
  - The general structure of the guide pages is also very modular, can probably be expanded to fit a Lessons mode in the future.
- A basic simulator, currently only used in the guide but will be further explored in Singleplayer modes
  - Can set starting board and starting nuisance
  - Can pause and restart (resuming not supported.. yet)

**Other changes:**
- A basic router has been set up for the different URL paths. No more folders containing just `index.html`!
- Only one JS file is created now and used across all pages. This greatly simplified the build process, but it might make loading times slightly longer.
- Fixed a case-sensitive issue with image filenames.
- Lots of dependences have been updated to newer versions.

## v0.10 - Code Overhaul

### v0.10.1 (December 5, 2020)
[`Move frontend over to Vue #62`](https://github.com/WillFlame14/jspuyo/pull/62)

**Changes:**
- Separated the initialization code into lots of new files, should modularize a lot of the frontend
- Added emitter to communicate between js frontend and vue frontend, since conversion isn't fully done yet
- New cypress tests!
- A few minor bugs fixed while refactoring
- Asset naming is more consistent.

### v0.10.0 (October 25, 2020)
[`Migration to Typescript #59`](https://github.com/WillFlame14/jspuyo/pull/59)

**Changes:**
- Several minor bugs fixed, notably:
  - Users can no longer register with a username that is already taken
  - Puyos are now correctly removed above row 13
  - The volume for the player is now correctly set.
- Removed deprecated code that was lingering around
- Added lots of documentation

## v0.9 - Game Improvements

### v0.9.1 (September 13, 2020)
[`Minor fixes #55`](https://github.com/WillFlame14/jspuyo/pull/55)

**Changes:**
- All outdated dependencies were updated
- Files were split up for better organization
- Added unit tests for CPU behaviour
  - Simple CPUs now correctly double rotate when necessary
  - All CPUs now correctly prioritize higher scoring chains
  - Advanced CPUs no longer incorrectly place trigger puyos in certain conditions
- Closing the Manage CPUs modal without saving selections no longer causes server to get confused about the number of CPUs in the room
- Games with less than 3 colours no longer cause infinite loops

### v0.9.0 (September 12, 2020)
[`Overhaul BoardDrawer into GameDrawer #54`](https://github.com/WillFlame14/jspuyo/pull/54)

**New features:**
- New nuisance and next queues
  - Next queues will not be drawn for boards that are too small
- New drop ghost pieces
- X displayed on the vital point

**Other changes:**
- Popping sprites changed
- Canvas framework is now layered, which should make board drawing much more flexible and speedy

## v0.8 - Personalization

### v0.8.3a (September 12, 2020)
[`Add cypress testing #53`](https://github.com/WillFlame14/jspuyo/pull/53)

**Changes:**
- Automated end-to-end testing! It's currently not very exhaustive, but it's a start.
  - Currently tests login flow, the navbar, and some room management options.

### v0.8.3 (September 2, 2020)
[`Add status bar, second voice option #52`](https://github.com/WillFlame14/jspuyo/pull/52)

**New features:**
- New status bar on the left
  - Displays username, rating, title and currently selected voice
  - Disappears during a game to prevent distraction
- New 'Maria' voice available for select
- Added sfx on click/hover for a more tactile feel

**Other changes:**
- The Create Room modal box should now correctly disappear on submit all the time.
- Trying to view Gallery with zero games played no longer crashes the server.
- Voices are now affected by SFX volume.

### v0.8.2a (August 28, 2020)

**Bug fixes:**
- The default soft drop speed is correctly updated to 0.375.
- Game-related logs now correctly show on client and not in the server.
- CPU games no longer end early and repeatedly, which caused glitching between boards due to multiple games.
- Rejoining the same game should no longer have unintended side effects (hopefully).
- Spectators that join with the Play button can now see opponent boards.
- Rooms are now correctly closed when the last player leaves in the middle of a game.
- Players now correctly leave the FFA/Ranked rooms when switching between them.
- Attempting to spectate the room you are currently spectating no longer sends you into the void.

**Other changes:**
- Games now wait for chains to resolve or puyos to fall before ending.
- Console logs are easier to read.

### v0.8.2 (August 21, 2020)
[`Add StatTracker, display stats in Gallery #51`](https://github.com/WillFlame14/jspuyo/pull/51)

**New features:**
- Stats for each game are now tracked. (e.g. build speed, split puyo percentage, finesse)
  - Charts based on these stats are displayed under the Profile --> Gallery tab.
  - Charts can be generated based on only the most recent 50 or 10 games instead of all.
  - Charts will only be displayed once at least 5 games have been played.
  - Some nice animations for each chart. :)
  - Stats are based off default games only. (i.e. considering board dimensions, soft drop speed, gravity)

**Other changes:**
- Tuned many game values to be more realistic.
- Guest registration warning now only shows up when registering as a guest.
- Flattened some data values in Firebase.

### v0.8.1a (August 12, 2020)

- Hotfix for CPU games being frozen upon start.
- Also changed games to use a global AudioPlayer to reduce the number of Audio objects generated.

### v0.8.1 (August 12, 2020)
[`Added password-protected rooms, improved spectator experience #50`](https://github.com/WillFlame14/jspuyo/pull/50)

**New features:**
- Rooms can now require a password to join (not required to spectate)
- A timer displaying the remaining time to game start is now shown for FFA and Ranked rooms
- The screen now indicates if you are spectating a game.
- Spectators can join the room directly through a new "Play" option.

**Other changes:**
- Spectators now have audio. (oops)
- Game will now force end much earlier if a player attempts to stall intentionally.
- Players can no longer join rooms they are already in. (Fixed https://github.com/WillFlame14/jspuyo/issues/49)
- Ranked games now continue to start after a game has finished.
- FFA room should no longer close itself.
- You can now spectate a room with only one player in it.
- Repurposed the settings div since it was completely unintelligible anyways.
- Multiple players losing at the same time should (hopefully) no longer stall the game infinitely.
- Split RoomManager into its own file.

### v0.8.0 (July 27, 2020)
[`Add user authentication #47`](https://github.com/WillFlame14/jspuyo/pull/47)

**New features:**
- User authentication added to facilitate future storage of user data
  - Sign-in options are currently limited to email/password and Google sign-in
  - Playing as a Guest is also an option, though data will not be saved between browsers
  - All locations should now use your username
  - You can log out under the Profile panel
- Pages for About, Privacy Policy, and Terms of Service (tbd)
- 3 new backgrounds!
- Support for 'FlatColour' skin

**Other changes:**
- Organized entire filesystem based on production files vs. development files.
- Very small tuning improvements
- Fixed a ton of room-related bugs

## v0.7 - Better rooms, Spectate feature

### v0.7.3 (July 3, 2020)
[`Separate rooms from games #45`](https://github.com/WillFlame14/jspuyo/pull/45)

**New features:**
- Instead of creating a game waiting to be played once, a room is created that allows games to be played multiple times
- Options for room management
  - Add/Change/Remove CPUs from the room (jspuyo now supports games with mixed CPUs and players!)
  - Change room settings (the room size cannot be changed, however)
  - Show the join link again
  - Start Room when enough players have joined, or if you wish to play against CPUs
  - Spectate the room
- Only the host can manage the room settings, other players can only view them
  - When the host leaves the room, the player that had joined the room the earliest will become the host

**Other changes:**
- Removed the "Play Against CPU" option in Singleplayer, as it is now contained within Create Room
- CPU games are now hosted on the server instead of in the background of a client
  - This means they are now treated almost exactly the same as player games (they send hashes instead of directly drawing)
- Some changes to GameDrawer.js to allow hashes to be drawn irrespective of the board size
- Minor UI improvements
- Standardized using tabs instead of spaces for JS files

### v0.7.2 (May 22, 2020)
[`Minor CSS improvements #44`](https://github.com/WillFlame14/jspuyo/pull/44)

**New features:**
- Modal boxes (and their content) now automatically resize to fit the window. (Mainpage later...)
- Autoprefixer now handles CSS vendor prefixes, so support for browsers other than Chrome (not including IE) should be improved

### v0.7.1 (May 19, 2020)
[`Add Spectate feature #43`](https://github.com/WillFlame14/jspuyo/pull/43)

**New features:**
- Can now spectate rooms that have started
  - Spectators can come and go regardless of room size
  - Can view a list of players in the room before deciding to spectate

**Other changes:**
- Fixed [`#33`](https://github.com/WillFlame14/jspuyo/issues/33).
- CPUs are now slightly less deterministic.

### v0.7.0 (May 16, 2020)
[`Room overhaul, add chat #42`](https://github.com/WillFlame14/jspuyo/pull/42)

**New features:**
- New sidebar containing a dynamic list of players in the room, as well as the room chat
  - Player list will eventually show usernames and rankings, but have placeholder values for now
  - Room chat auto-scrolls to the latest message
- Creating a room now shows a modal box with the join link
  - Also an option to copy link to clipboard

**Other changes:**
- Fixed [`#38`](https://github.com/WillFlame14/jspuyo/issues/38), [`#39`](https://github.com/WillFlame14/jspuyo/issues/39).
- Sockets receive *significantly* less traffic and no longer perform leftover actions repeatedly
- CPU sockets are now correctly disconnected, reducing the number of total connections
- Further reduced amount of console logging due to new UI features

## v0.6 - Improved UI and Navigation Bar

### v0.6.3 (May 10, 2020)
[`Minor improvements #36`](https://github.com/WillFlame14/jspuyo/pull/36)

**New features:**
- Game buffering if one player falls too far behind
  - Followed by timeout if socket is unresponsive
- Some console logging moved to UI instead
  - New dialog boxes for forced game stop and socket timeout

**Other changes:**
- Minor visual improvements to games with > 4 players
- Separated the large initialization code into separate files

### v0.6.2 (May 6, 2020)
[`Sprite loading #35`](https://github.com/WillFlame14/jspuyo/pull/35)

**New features:**
- Sprite drawing has replaced the old ImprovedHouseAndMoon style
  - supports Aqua, Chalk, TsuClassic and some custom skins (mostly broken)
  - Appearance can be changed in User Settings
- Connected puyos are now drawn correctly
- Popping puyos now use the spritesheet animation

**Other changes:**
- Game streaming now only sends lower level data (i.e. only the puyos to draw)
- Room options now have certain restrictions (breaking them will cause them to use defaults)

### v0.6.1 (May 6, 2020)
[`Add interactive boxes to navigation panels #34`](https://github.com/WillFlame14/jspuyo/pull/34)

**New features:**
- Switching between modes no longer requires URL manipulation or page refreshes!
- User-friendly modal boxes for Create Room, Join Room, Play Against CPU and Settings pages
  - Create Room and Play Against CPU pages let you customize room options, like number of colours or target points
  - Play Against CPU further allows you to customize AI and speed of CPU opponents
  - Settings page allows you to customize user settings like DAS/ARR or key bindings

**Other changes:**
- Fixed [`#32`](https://github.com/WillFlame14/jspuyo/issues/32).
- Started using Sass and stylelint for better CSS organization
- Started using npm-run-all for ease of development
- Split up Main.js to create a Session class, and merged webpage.js into an init() function in Main.js

### v0.6.0 (Apr 27, 2020)
[`Add navigation bar, more CSS #31`](https://github.com/WillFlame14/jspuyo/pull/31)

**New features:**
- Navigation bar to move between features instead of needing to modify the URL.
  - Currently only works for FFA, Ranked, Sprint/Timed and CPU
- Basic background image, font/colour additions

**Other changes:**
- Fixed bug that was causing ChainCpu and FlatCpu to behave incorrectly.
- TestCpu is no longer deterministic.

## v0.5 - Better CPUs and Custom Games

### v0.5.3 (Apr 24, 2020)
[`More settings #30`](https://github.com/WillFlame14/jspuyo/pull/30)

**New features:**
- Margin time option
- Minimum chain length option

**Other changes:**
- Removed hardcoded start height for drops and max height for the stack.
- Removed unused CPU sockets to save resources.
- Board 2's score no longer changes erratically.
- Increased default skipFrames to improve performance.
- Made the default CPU slightly easier (again).
- Improved some room logging.

### v0.5.2 (Apr 18, 2020)
[`Support more players #29`](https://github.com/WillFlame14/jspuyo/pull/29)

**New features:**
- Room size can now be customized by appending `?size=<number>` into the URL.
- Animation frames can be skipped (to improve performance) by appending `?skipFrames=<number>` to the URL. 
  - Games with large numbers of players have the default number of skipFrames increased.
- The default canvas size is now twice as large for improved resolution.

**Other changes**:
- The console log no longer indicates incoming/sent nuisance to reduce spam in rooms with large numbers of people.
- Better logging for room updates, as well as fixing of some issues.
- Both win/lose sounds now play on game end.
- Added unit tests and CI integration.
- CPUS are now slightly slower by default.

### v0.5.1 (Apr 10, 2020)
[`Custom games, improve CPU #28`](https://github.com/WillFlame14/jspuyo/pull/28)

**New features:**
- Set the speed of the CPU by appending `?speed=xxx` (measured in ms) to the URL. Higher speed means slower.
- Select the CPU's AI by appending `?ai=xxx` to the URL. Supports all currently implemented AIs.
- New Akari voice files
- The root URL will now join the default queue (1 minute wait for more players with 2 people, 15 seconds wait with 4 people)
- Join matchmaking (1v1) by appending `?ranked=true` to the URL. Currently there is no ranking system yet.
- Create a custom room by appending `createRoom=true` to the URL. A custom join link will be provided in the console.
- Join a custom room by appending `joinRoom=<joinID>` to the URL. 

**Other changes**:
- Leaving the default queue will now notify all others.
- Winning a CPU game no longer crashes the server.
- Production code is now uglified for better performance.
- Can no longer let CPU play for you due to introduction of many bugs.

### v0.5.0 (Apr 2, 2020)
[`Improve CPU AI and add voices #27`](https://github.com/WillFlame14/jspuyo/pull/27)

**New features**:
- TestCpu renamed to ChainCpu.
- A new TestCpu (now the default) was created that is much stronger.
- Added some new basic CPUs.
  - RandomCPU always does random moves.
  - FlatCpu does tara stacking.
- Voices play during chains.
- Puyo take some time to "squish" into the stack.

**Bug fixes:**
- Minor changes to tuning values.
- Bug fix for SFX during nuisance sending.
- CPUS no longer send nuisance to themselves.

## v0.4 - Basic CPUs, Score and Nuisance

### v0.4.4 (Mar 26, 2020)
[`Add all clear functionality #26`](https://github.com/WillFlame14/jspuyo/pull/26)
- The board detects when it is completely empty and will trigger an all clear.
- A sound effect will play to indicate this.
- The next chain will send an extra rock of nuisance.

### v0.4.3 (Mar 26, 2020)
[`Combine all work up to this point #25`](https://github.com/WillFlame14/jspuyo/pull/25)
- Nuisance animations now show in all cases.
- All dropping rows are now shown properly.
- Minor changes to tuning values.

### v0.4.2 (Mar 25, 2020)
[`Minor fixes #24`](https://github.com/WillFlame14/jspuyo/pull/24)
- Chains involving nuisance now correctly clear the chains+nuisance (probably).
- Active nuisance is no longer delayed by splitting drops.
- All players/CPUs now get the same drops.
- Colours are now (mostly) balanced in 128 drops.
- The first three drops now only use 3 unique colours.
- Nuisance will no longer fall on columns more than 12 puyos high.
- Puyos placed on columns that are already 13 puyos high are now deleted.
- TestCpu now avoids placing drops in column 3.

### v0.4.1 (Mar 25, 2020)
[`Add fully functional nuisance dropping animations #23`](https://github.com/WillFlame14/jspuyo/pull/23)
- Nuisance now falls instead of being instantly added to the stack.

### v0.4.0 (Mar 22, 2020)
[`Add score, nuisance, and CPUs #22`](https://github.com/WillFlame14/jspuyo/pull/22)
- Score is now calculated per chain instead of at the end.
- Soft dropping now adds to score.
- Nuisance can be sent and countered.
- Win/Lose logic implemented.
- Board hashing implemented.
- SFX for chaining and nuisance added.
- Synced sfx, score and nuisance between players.
- Added support for some basic CPUs.
  - HarpyCPU, which stacks on the right side first and then the left side.
  - TestCPU, which looks for chains and places randomly otherwise.
  - Play against a CPU by appending `?cpu=true` to the URL.
  - Let CPU play for you by appending `?player=false` to the URL. [Deprecated as of v0.5.1]
  
## v0.3 - 2 Players

### v0.3.2 (Mar 14, 2020)
[`Change opponent sync to hash streaming instead of inputs #20`](https://github.com/WillFlame14/jspuyo/pull/20)
- Rework multiplayer syncing to stream a hash of the board
  - Sending inputs ran into desyncing

### v0.3.1 (Mar 14, 2020)
[`Add score and nuisance #19`](https://github.com/WillFlame14/jspuyo/pull/19)
- Score is updated upon clearing a chain
  - Soft dropping does not add score yet.
- Nuisance sent is displayed in the console (not actually sent yet).

### v0.3.0 (Mar 9, 2020)
[`Add server side code #17`](https://github.com/WillFlame14/jspuyo/pull/17)
- Second canvas
- Input support for two players
- Synchronized inputs between players
- Moved website to Azure

## v0.2 - Chaining

### v0.2.2 (Mar 9, 2020)
[`Chain animations #15`](https://github.com/WillFlame14/jspuyo/pull/15)
- Add chain animations
- Add falling animation for split drops

### v0.2.1 (Mar 8, 2020)
[`Lock delay #14`](https://github.com/WillFlame14/jspuyo/pull/13)
- Add lock delay (100ms)
  - Lock delay can currently be infinitely abused.

### v0.2.0 (Mar 6, 2020)
[`Chaining Framework #13`](https://github.com/WillFlame14/jspuyo/pull/13)
- Basic CSS
- Added instantaneous chaining
- Added drawing capabilities for all drops
- Arle puyo now always spawns on the bottom

## v0.1 - Movement

### v0.1.2 (Mar 1, 2020)
[`Better movement #9`](https://github.com/WillFlame14/jspuyo/pull/9)
- Added DAS and ARR settings
- More intuitive behaviour when holding down left/right

### v0.1.1 (Feb 28, 2020)
[`Add rotation functionality #7`](https://github.com/WillFlame14/jspuyo/pull/7)
- Puyos can be rotated using Z and X
  - Multiple rotation events cannot be queued at the same time.
  - Basic wall and floor kicks
  - No 180 rotate yet

### v0.1.0 (Feb 26, 2020)
[`Basic input functionality #5`](https://github.com/WillFlame14/jspuyo/pull/5)
- Basic canvas
- Game over when col 2 is filled
- Stacking limit of 13 rows
- Game accepts left/right movement using arrow keys
