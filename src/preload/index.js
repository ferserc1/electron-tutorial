
const { contextBridge } = require('electron');
const fs = require('fs');

contextBridge.exposeInMainWorld('myAPI', {
    async writeFile(path, content, options) {
        return await fs.promises.writeFile(path, content, options);
    },

    getDependencyVersion(name) {
        return process.versions[name];
    }
});

/*window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) {
            element.innerText = text;
        }
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency]);
    }


});
*/
