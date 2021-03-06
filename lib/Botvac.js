'use strict';

const nodeBotvac = require('node-botvac');

class Botvac {

  user='';
  pass='';
  log=function() {};
  botvacClient=new nodeBotvac.Client();

  constructor(user, pass, log) {
    if (!user || !pass) {
      throw new Error('Must have a username/password for Botvac connection');
    }
    this.user = user;
    this.pass = pass;
    if (log && typeof log !== 'function') {
      throw new Error('Log should be empty or a function');
    }
    if (log) {
      this.log = log;
    }

    this.log('Initiateded in lib');
  }

  /**
   * Authentication
   */
  auth() {
    const self = this;
    self.log('Run auth');
    const authPromise = new Promise((resolve, reject) => {
      self.log('In the promise');
      self.botvacClient.authorize(self.user, self.pass, false, error => {
        if (error) {
          self.log('Auth error', error);
          reject(error);
        } else {
          self.log('Auth success', error);
          resolve(true);
        }
      });
    });
    self.log('return auth');
    return authPromise;
  }

  /**
   * Get robot
   */
  async getRobot() {
    const self = this;

    try {
      await this.auth();
    } catch (error) {
      return Promise.reject(error);
    }

    self.log('Run robots');
    const robotPromise = new Promise((resolve, reject) => {
      self.log('In the robot promise');
      self.botvacClient.getRobots((error, robots) => {
        if (error) {
          self.log('Error getting robots', error);
          reject(error);
        } else if (!robots) {
          self.log('0 robots returned', error);
          reject(error);
        } else {
          const robot = robots[0];
          resolve(robot);
        }
      });
    });
    self.log('return robot');
    return robotPromise;
  }

  /**
   * Start the cleaning cycle.
   */
  async startCleaningCycle() {
    const self = this;
    let robot;

    self.log('startCleaning function call');
    try {
      robot = await this.getRobot();
    } catch (error) {
      return Promise.reject(error);
    }
    const cleaningPromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (!state || !state.availableCommands) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} didn't return states`);
        }
        if (state.availableCommands.start) {
          robot.startCleaning(true, 2, true);
          self.log(`${robot.name} will start cleaning`);
          resolve(true);
        }
        if (state.availableCommands.resume) {
          robot.resumeCleaning();
          self.log(`${robot.name} will resume cleaning`);
          resolve(true);
        }
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`${robot.name} cannot start or resume`);
      });
    });

    return cleaningPromise;
  }

  /**
   * Stop (pause) the cleaning cycle and send BotVac to dock.
   */
  async stopCleaningCycle() {
    const self = this;
    let robot;

    self.log('stopCleaning function call');
    try {
      robot = await this.getRobot();
    } catch (error) {
      return Promise.reject(error);
    }
    const stopCleaningPromise = new Promise((resolve, reject) => {
      // Cleaning must be paused, not stopped, before it can be sent to dock
      robot.pauseCleaning((error, result) => {
        if (error) {
          self.log(`${robot.name} could not pause`);
          reject(error);
        }
        self.log(`${robot.name} was paused`);
        // It can take significant time from BotVac Pause until it can be sent to dock.
        // Resolving this with recursive loop for now that will give it ~30 seconds to resolve
        (async function loop(stopCleaningScope) {
          const iMax = 30;
          for (let i = 0; i < iMax; i++) {
            await stopCleaningScope.dockBotvac()
              .then(success => {
                i = iMax;
                resolve(success);
              }, fail => {
                stopCleaningScope.log(`Dock attempt ${i} failed: ${fail}`);
              });
          }
          self.log(`Could not dock after ${iMax} tries`);
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`Could not dock after ${iMax} tries`);
        }(self));
      });
    });

    return stopCleaningPromise;
  }

  /**
   * Send BotVac to dock.
   */
  async dockBotvac() {
    const self = this;
    let robot;

    self.log('stopCleaning function call');
    try {
      robot = await this.getRobot();
    } catch (error) {
      return Promise.reject(error);
    }
    const dockPromise = new Promise((resolve, reject) => {
      robot.getState((error, state) => {
        if (error) {
          self.log('Error when getting state');
          reject(error);
        }
        if (state && state.availableCommands) {
          self.log(state.availableCommands);
        }
        if (state && state.availableCommands && state.availableCommands.goToBase) {
          robot.sendToBase();
          self.log(`${robot.name} will return to base`);
          resolve(true);
        } else {
          self.log(`${robot.name} cannot return to base`);
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`${robot.name} cannot return to base`);
        }
      });
    });
    return dockPromise;
  }

}

module.exports = Botvac;
