
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
