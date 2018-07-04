const ws = require('./../ws');
const ready = require('./../ready');
const timing = require('./../timing');

let detox;
try {
  detox = require('detox');
} catch (e) {
  // ignore
}

if (detox) {
  /* ---------------------
   *   DEVICE OVERRIDES
   * --------------------- */

  let device;
  Object.defineProperty(global, 'device', {
    get() {
      return device;
    },
    set(originalDevice) {
      /* ---------------------
       *   DEVICE DRIVER OVERRIDES
       * --------------------- */
      const originalDriver = originalDevice.deviceDriver;
      const originalDriverTerminate = originalDriver.terminate.bind(originalDriver);
      originalDriver.terminate = async (...args) => {
        await originalDriverTerminate(...args);
        return ready.reset();
      };

      // device.reloadReactNative({ ... })
      // todo detoxOriginalReloadReactNative currently broken it seems
      // const detoxOriginalReloadReactNative = originalDevice.reloadReactNative.bind(originalDevice);
      originalDevice.reloadReactNative = async () => {
        ready.reset();
        global.bridge.reload();
        return ready.wait();
      };

      // device.launchApp({ ... })
      const detoxOriginalLaunchApp = originalDevice.launchApp.bind(
        originalDevice
      );

      originalDevice.launchApp = async (...args) => {
        await detoxOriginalLaunchApp(...args);
        return ready.wait();
      };

      device = originalDevice;
      return originalDevice;
    },
  });

  /* -------------------
   *   DETOX OVERRIDES
   * ------------------- */

  // detox.cleanup()
  const detoxOriginalCleanup = detox.cleanup.bind(detox);
  detox.cleanup = async (...args) => {
    timing.stop();
    // detox doesn't automatically terminate ios apps after testing
    // but does on android - added to keep consistency
    if (device.getPlatform() === 'ios') {
      await device.terminateApp();
    }
    ws.stop();
    await detoxOriginalCleanup(...args);
  };
}

module.exports = detox;
