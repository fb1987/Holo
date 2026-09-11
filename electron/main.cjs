const {
  app,
  BrowserWindow,
  shell,
  dialog,
  Menu,
  utilityProcess,
} = require("electron");
const path = require("node:path");
let mainWindow, workshop;
const devUrl = process.env.HOLO_DEV_URL;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    app.setName("Holo");
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Holo",
          submenu: [
            { role: "about" },
            { type: "separator" },
            {
              label: "Settings",
              accelerator: "Cmd+,",
              click: () =>
                mainWindow?.webContents.executeJavaScript(
                  "document.querySelector('[aria-label=\"Studio settings\"]')?.click()",
                ),
            },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "View",
          submenu: [
            { role: "reload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { role: "togglefullscreen" },
          ],
        },
        {
          label: "Window",
          submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
        },
      ]),
    );
    try {
      let url = devUrl;
      if (!url) {
        const port = await new Promise((resolve, reject) => {
          workshop = utilityProcess.fork(
            path.join(app.getAppPath(), "dist-server/index.js"),
            [],
            {
              env: {
                ...process.env,
                HOLO_PORT: "0",
                HOLO_DATA_DIR: path.join(app.getPath("appData"), "Holo"),
                HOLO_STATIC_DIR: path.join(app.getAppPath(), "dist"),
              },
              stdio: "pipe",
              serviceName: "Holo Workshop",
            },
          );
          let output = "";
          const timeout = setTimeout(
            () =>
              reject(new Error("The local workshop did not start in time.")),
            30000,
          );
          workshop.stdout.on("data", (data) => {
            output += data.toString();
            const match = output.match(/HOLO_READY\s+(\d+)/);
            if (match) {
              clearTimeout(timeout);
              resolve(Number(match[1]));
            }
          });
          workshop.stderr.on("data", (data) => process.stderr.write(data));
          workshop.on("exit", (code) => {
            clearTimeout(timeout);
            reject(new Error(`The workshop stopped (${code}).`));
          });
        });
        url = `http://127.0.0.1:${port}`;
      }
      mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 680,
        minHeight: 620,
        title: "Holo",
        backgroundColor: "#070b10",
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 17, y: 17 },
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });
      mainWindow.once("ready-to-show", () => mainWindow.show());
      mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//.test(url)) void shell.openExternal(url);
        return { action: "deny" };
      });
      mainWindow.webContents.on("will-navigate", (event, target) => {
        if (new URL(target).origin !== new URL(url).origin) {
          event.preventDefault();
          if (/^https?:\/\//.test(target)) void shell.openExternal(target);
        }
      });
      mainWindow.webContents.session.on("will-download", (event, item) => {
        item.setSaveDialogOptions({
          title: "Save your Holo artifact",
          defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
        });
      });
      mainWindow.on("closed", () => {
        mainWindow = null;
      });
      await mainWindow.loadURL(url);
    } catch (error) {
      dialog.showErrorBox(
        "Holo could not open",
        `${error.message}\n\nYou can also run Holo from the source with npm run dev.`,
      );
      app.quit();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => workshop?.kill());
}
