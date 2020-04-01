import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import os = require('os');
import Datastore = require('nedb');
const homeDir = os.homedir();
import crypto = require('crypto'); // now is in node default module

let algorithm = 'aes-256-cbc'; // you can choose many algorithm from supported openssl
let secret = 'superSecretKey';
let key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);


// const pathToDb = homeDir + "\work" ;

const db: any = {};
db['users'] = new Datastore({
  filename: 'users.db',
  autoload: true,
  timestampData: true,
  corruptAlertThreshold: 0,

  onload: (error) => {
    console.log("error on load", error);
  },

  afterSerialization(plaintext) {
    console.log("Inside afterseriliazation - plaintext is ", plaintext);

    const iv = crypto.randomBytes(16);
    const aes = crypto.createCipheriv(algorithm, key, iv);
    let ciphertext = aes.update(plaintext);
    ciphertext = Buffer.concat([iv, ciphertext, aes.final()]);

    console.log("Inside afterseriliazation - cipherText is ", ciphertext.toString('base64'));

    return ciphertext.toString('base64');
  },

  beforeDeserialization(ciphertext) {
    console.log("Inside before deserilization - cipherText is ", ciphertext);

    const ciphertextBytes = Buffer.from(ciphertext, 'base64')
    const iv = ciphertextBytes.slice(0, 16)
    const data = ciphertextBytes.slice(16)
    const aes = crypto.createDecipheriv(algorithm, key, iv)
    let plaintextBytes = Buffer.from(aes.update(data))
    plaintextBytes = Buffer.concat([plaintextBytes, aes.final()])
    let plaintext = plaintextBytes.toString();
    console.log("Inside before deserilization - plainText is ", plaintext);
    return plaintext;
  }
});

let mainWindow: Electron.BrowserWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    width: 800,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// insert a document
ipcMain.on('save-user-request', (event, user) => {
  let newUser = {
    name: user.name,
    age: user.age
  };
  // console.log("new user - ", newUser);

  db.users.insert(newUser, (err: any, newDoc: any) => {
    if (err) {
      event.sender.send('save-user-error', `An error occurred\n${err}`);
    } else {
      event.sender.send('save-user-success', newDoc);
    }
    console.log("new user ", newUser);

  });
});

// delete a user recors
ipcMain.on('delete-user-request', (event, user) => {
  let usersToDelete: string[];
  db.users.find({}).sort({ 'createdAt': 1 }).limit(2).exec(function (err: any, docs: any) {
    usersToDelete = docs.map((user: any) => user._id);
    console.log("users to delete ", usersToDelete);
    db.users.remove({ _id: { $in: usersToDelete } }, { multi: true }, function (err: any, numRemoved: any) {
      console.log("users to delete coming in remove function ", usersToDelete);
      console.log("number of removed record - ", numRemoved);
      console.log("error ", err);

    });
  });

});

// show a first two users
ipcMain.on('show-user-request', (event, user) => {
  db.users.find({}).sort({ 'createdAt': 1 }).limit(2).exec(function (err: any, docs: any) {
    console.log("all users - ", docs);
  });
});




app.on("activate", () => {
  // On OS X it"s common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
