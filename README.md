# JSPuyo
<img src="https://david-dm.org/WillFlame14/jspuyo.svg" alt="David dependency status">
Puyo Puyo for your browser.

## Features
- **Free-for-all queue** (supports 4+ players!) Game will start soon after 2+ players are in queue.
- **1v1 Matchmaking** Append `?ranked=true` to the URL. No rating system currently implemented.
- **CPU Opponent** Append `?cpu=true` to the URL. More detailed options are described below.
- **Custom rooms** Create a room with `?createRoom=true`, and give a join link `?joinRoom=<id>` to your friends!

### CPU Options
CPU AIs supported: `?cpu=true&ai=<ai_name>`
- Random (fully random)
- Tall (Frog stacking)
- Flat (Tara stacking)
- Chain (Looks for small chains)
- Test (strongest CPU, also the default)

If you're having trouble even with the basic CPUs, you can lower their speed by appending `&speed=<number>` to the URL. The number is measured in milliseconds, so try a number like 3000 and adjust from there.

## Development
- Clone the repository using `git clone`.
- Navigate into the local repository and install the required modules using `npm install`.
- Run `npm run bundle` to start watchify.
- Run `npm run start` to start node.
- Type `localhost:3000` into the browser to access the website. Query options can be appended as usual.

[Seen any rare bugs lately?](https://github.com/WillFlame14/jspuyo/issues)
