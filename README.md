# JSPuyo
<img src="https://david-dm.org/WillFlame14/jspuyo.svg" alt="David dependency status"><img src="https://travis-ci.org/WillFlame14/jspuyo.svg?branch=master" alt="Travis build result">
Puyo Puyo for your browser.

## Features
- **Free-for-all queue** Game will start soon after 2+ players are in queue.
- **1v1 Matchmaking** Append `?ranked=true` to the URL. No rating system currently implemented.
- **CPU Opponent** Append `?cpu=true` to the URL. More detailed options are described below.
- **Custom rooms** Create a room with `?createRoom=true`, and give a join link `?joinRoom=<id>` to your friends!
- **Support for 4+ players** Append `?size=<number>` to the URL. Only works for non-queue options (CPUs or custom rooms)
  - If you're experiencing lag, append `?skipFrames=<number>` to skip some frames from being rendered. Use `-1` to skip all animation frames.

Example: [https://jspuyo.azurewebsites.net/?cpu=true&ai=Random&size=4](https://jspuyo.azurewebsites.net/?cpu=true&ai=Random&size=4) to play against 3 CPUs with their AI set to Random.

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
- Run `npm test` to run the JS code through ESLint and the unit tests. All builds will go through Travis CI, where this command is run.

### Running locally
- Run `npm run bundle` to start watchify.
- Run `npm start` to start node.
- Type `localhost:3000` into the browser to access the website. Query options can be appended as usual.


[Seen any rare bugs lately?](https://github.com/WillFlame14/jspuyo/issues)
