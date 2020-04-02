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
    user.firstName = (document.getElementById('firstName') as HTMLInputElement).value;
    user.lastName = (document.getElementById('lastName') as HTMLInputElement).value;
    ipcRenderer.send('save-user-request', user);
  });

  btnShowUsers.addEventListener('click', () => {
    ipcRenderer.send('show-user-request');
  });

  btnDeleteUser.addEventListener('click', () => {
    ipcRenderer.send('delete-user-request');
  });

});
