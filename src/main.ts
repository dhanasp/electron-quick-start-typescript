import { app, BrowserWindow, ipcMain } from "electron";
import { promises as fsPromises } from "fs";
import * as uuidV4 from "uuid/v4";
import * as path from "path";
import * as os from 'os';
import * as Datastore from 'nedb';
const homeDir = os.homedir();
import crypto = require('crypto'); // now is in node default module
import { uuid } from 'uuidv4';
import { WindowsCredentialHelper, Credentil } from "./WindowsCredentialHelper";


let db: Datastore;

let algorithm = 'aes-256-cbc'; // you can choose many algorithm from supported openssl
const windowsCredentialHelper = new WindowsCredentialHelper();

function getOrCreateSecretKey(): Promise<string> {
  let secretKey: string;
  let secretPromise: Promise<string> = new Promise<string>((resolve, reject) => {
    windowsCredentialHelper
      .getCredentils("DBService", ['secretKey'])
      .then((creds: Credentil[]) => {
        // newSecretKey = creds['secretKey'];
        return resolve(creds['secretKey']);
      }).catch((err) => {
        console.log("Error while getting creds - ", err);
        let newSecretKey = uuid();
        windowsCredentialHelper
          .saveCredentils("DBService", [{ key: 'secretKey', value: newSecretKey }])
          .then(() => {
            console.log(`credential for ${key} got saved successfully.`);
            return resolve(newSecretKey);
          }).catch(err => {
            console.log("Error while saving credentials - ", err);
            return reject(err);
          });
      });
  });

  // Promise.all([]);
  // secretPromise;
  return secretPromise;
}

let secret: string;
(async function () {
  try {
    secret = await getOrCreateSecretKey();
  } catch (err) {
    console.log("error while getting secret key", err);
  }
})();

let key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);

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

  // from plaintext to into cipherText
  afterSerialization(plaintext) {
    // console.log("Inside afterseriliazation - plaintext is ", plaintext);
    const iv = crypto.randomBytes(16);
    const secretkey = windowsCredentialHelper.getCredentils("DBService", ['secretKey'])
    console.log(secretkey);

    const aes = crypto.createCipheriv(algorithm, key, iv);
    let ciphertext = aes.update(plaintext);
    ciphertext = Buffer.concat([iv, ciphertext, aes.final()]);
    return ciphertext.toString('base64');
  },

  // from cipherText to into plainText
  beforeDeserialization(ciphertext) {
    // console.log("Inside before deserilization - cipherText is ", ciphertext);
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

function createDb(dbFilePath: string) {
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

