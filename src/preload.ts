import { ipcRenderer } from "electron";
import { registerWindowEventListener } from "npmModuleWithTypescript";

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const type of ["chrome", "node", "electron"]) {
    replaceText(`${type}-version`, (process.versions as any)[type]);
  }

const button = document.getElementById("resize-btn").addEventListener("click",()=>{
  const event = new MessageEvent("RESIZE_APP",{
    data:{
      width:400,
      height:500
    }
  })
  window.dispatchEvent(event);
})

});

registerWindowEventListener(window, ipcRenderer);
  
