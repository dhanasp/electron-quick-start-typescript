import { app, BrowserWindow, ipcMain } from "electron";
import { promises as fsPromises } from "fs";
import * as uuidV4 from "uuid/v4";
import * as path from "path";
import * as os from 'os';
import * as Datastore from 'nedb';
const homeDir = os.homedir();
import * as crypto from "crypto";

let algorithm = 'aes-256-cbc'; // you can choose many algorithm from supported openssl
let secret = 'superSecretKey';
let key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
let db: Datastore;

// const pathToDb = homeDir + "\work" ;
const dbFilePath = "users.db";

const dataStoreOptions: Datastore.DataStoreOptions = {
  filename: dbFilePath,
  autoload: true,
  timestampData: true,
  corruptAlertThreshold: 0,
  onload(err: any) {
    console.log(err);

    if (err) {
      console.error("error on load", err);
      console.log("truncating users.db file");
      truncateDbFile(dbFilePath);
    }
  },

  afterSerialization(plaintext: any) {
    const iv = crypto.randomBytes(16);
    const aes = crypto.createCipheriv(algorithm, key, iv);
    let ciphertext = aes.update(plaintext);
    ciphertext = Buffer.concat([iv, ciphertext, aes.final()]);
    return ciphertext.toString('base64');
  },

  beforeDeserialization(ciphertext: any) {
    const ciphertextBytes = Buffer.from(ciphertext, 'base64')
    const iv = ciphertextBytes.slice(0, 16)
    const data = ciphertextBytes.slice(16)
    const aes = crypto.createDecipheriv(algorithm, key, iv)
    let plaintextBytes = Buffer.from(aes.update(data))
    plaintextBytes = Buffer.concat([plaintextBytes, aes.final()])
    let plaintext = plaintextBytes.toString();
    return plaintext;
  }
};
const createDb = (dbFilePath: string) => {
  db = new Datastore(dataStoreOptions);
}

createDb(dbFilePath);


let mainWindow: Electron.BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    width: 800,
  });

  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

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

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const truncateDbFile = (dbFilePath: string) => {
  fsPromises.truncate(dbFilePath).then(() => {
    console.log("Content got deleted successfully.");
  }).catch(err => {
    console.log("error in removing content from file - ", err);
  }).finally(() => {
    console.log("creating database again");
    createDb(dbFilePath);
  })

}

