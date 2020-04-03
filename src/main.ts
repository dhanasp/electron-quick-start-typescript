import { uuid } from 'uuidv4';
import { WindowsCredentialHelper, Credential } from "./WindowsCredentialHelper";
import { createDataStore } from './DataStore';
import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as Datastore from 'nedb';

const windowsCredentialHelper = new WindowsCredentialHelper();
let mainWindow: BrowserWindow;

async function createNewCreds(): Promise<string> {
  let newSecretKey = uuid();
  console.log("generated new secret key -- ", newSecretKey);
  await windowsCredentialHelper
    .saveCredentials("DBService", [{ key: 'secretKey', value: newSecretKey }]);
  return newSecretKey;
}

async function getOrCreateSecretKey(): Promise<string> {
  let creds: Credential[] = await windowsCredentialHelper
    .getCredentials("DBService", ['secretKey']);
  console.log("got creds from windows creds manager - ", creds);
  if (creds.length > 0 && creds[0].key === 'secretKey') {
    return creds[0].value;
  } else {
    console.log("no credentials found for DBService secretKey");
    return await createNewCreds();
  }
}

function initApp() {
  console.log("inside init app function");

  getOrCreateSecretKey().then((secretKey: string) => {
    console.log("got secret key : ", secretKey);
    return createDataStore(secretKey);
  }).then((db: Datastore) => {
    console.log("got initialized db");
    ipcMain.on('save-user-request', (event, user) => {
      let newUser = {
        firstName: user.firstName,
        lastName: user.lastName
      };
      db.insert(newUser, (err: any, newDoc: any) => {
        if (err) {
          console.error("error occurred when inserting user : ", err);
          event.sender.send('save-user-error', `An error occurred\n${err}`);
        } else {
          console.log("saved user - ", newUser);
          event.sender.send('save-user-success', newDoc);
        }
      });
    });
    ipcMain.on('delete-user-request', (_event) => {
      let usersToDelete: string[];
      db.find({}).sort({ 'createdAt': 1 }).limit(2).exec(function (err: any, docs: any) {
        usersToDelete = docs.map((user: any) => user._id);
        db.remove({ _id: { $in: usersToDelete } }, { multi: true }, function (err: any, numRemoved: any) {
          console.log("number of removed records - ", numRemoved);
          if (err) {
            console.log(err);
          }
        });
      });
  
    });
    ipcMain.on('show-user-request', (_event) => {
      db.find({}).sort({ 'createdAt': 1 }).limit(2).exec(function (err: any, docs: any) {
        console.log("first 2 users - ", docs);
      });
    });

    console.log("creating browser window");
    mainWindow = new BrowserWindow({
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
      width: 800,
    });  
    mainWindow.loadFile(path.join(__dirname, "../index.html"));
    console.log("loaded index.html in mainWindow");  
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
  
    mainWindow.on("closed", () => {
      console.log("mainWindow closed");
      mainWindow = null;
    });

  }).catch((reason: any) => {
    console.error("some error occurred. reason is : ", reason);
    console.log("exiting application");
    process.exit(1);
  });
}

app.on("ready", initApp);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    initApp();
  }
});

console.log("end of main.ts");
