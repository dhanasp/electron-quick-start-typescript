// All of the Node.js APIs are available in the preload process.

import { ipcRenderer } from "electron";

// It has the same sandbox as a Chrome extension.
window.addEventListener("DOMContentLoaded", () => {

  // insert a document
  let btnSaveUser = document.getElementById('save-user');
  let btnShowUsers = document.getElementById('show-users');
  let btnDeleteUser = document.getElementById('delete-user');

  btnSaveUser.addEventListener('click', () => {
    let user: any = {};
    user.name = (document.getElementById('name') as HTMLInputElement).value;
    user.age = (document.getElementById('age') as HTMLInputElement).value;
    ipcRenderer.send('save-user-request', user);
  });

  btnShowUsers.addEventListener('click', () => {
    ipcRenderer.send('show-user-request');
  });

  btnDeleteUser.addEventListener('click', () => {
    ipcRenderer.send('delete-user-request');
  });

});
