# JSPuyo
<img src="https://david-dm.org/WillFlame14/jspuyo.svg" alt="David dependency status"> <img src="https://travis-ci.org/WillFlame14/jspuyo.svg?branch=master" alt="Travis build result">
  
Puyo Puyo for your browser.

## Features
- **Free-for-all queue** Game will start soon after 2+ players are in queue.
- **1v1 Matchmaking** No rating system currently implemented.
- **CPU Opponent** More detailed options are described below.
- **Custom rooms** Create a room with custom options, and give a join link `?joinRoom=<id>` to your friends!
- **Support for 4+ players**  Only works for non-queue options (CPUs or custom rooms)
  - If you're experiencing lag, try reducing `Intermediate Frames Shown` in Settings to skip some frames from being rendered.

### CPU Options
CPU AIs supported:
- Random (fully random)
- Tall (Frog stacking)
- Flat (Tara stacking)
- Chain (Looks for small chains)
- Test (strongest CPU, also the default)

If you're having trouble even with the basic CPUs, you can lower their speed. The number is measured in milliseconds, so try a number like 3000 and adjust from there.

## Development
- Clone the repository using `git clone`.
- Navigate into the local repository and install the required modules using `npm install`.
- Run `npm test` to run the JS code through ESLint, stylelint and the unit tests. All builds will go through Travis CI, where this command is run.
- Run `npm run stylelint` to get stylelint to automatically fix as many issues as possible.

### Running locally
- Run `npm start` to bundle the files (using watchify and sass) and start node.
- Type `localhost:3000` into the browser to access the website. Query options can be appended as usual.


[Seen any rare bugs lately?](https://github.com/WillFlame14/jspuyo/issues)
