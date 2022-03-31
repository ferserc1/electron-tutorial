# Electron + Visual Studio Code

Este es un tutorial para crear una aplicación Electron, y depurarla con Visual Studio Code.

## Prerequisitos

Este tutorial está realizado con Node.js versión 16 y Electron 18. Electron no es un prerequisito, se instalará utilizando npm de forma local al proyecto, con lo que solamente es necesario instalar Node 16 y Visual Studio Code

## Proyecto básico

Después de crear el fichero `package.json` con `npm init`, instalamos Electron como dependencia de desarrollo y configuramos el script de inicio y el fichero principal:

```sh
mkdir my-electron-app
cd my-electron-app
npm init              < configura aquí tu aplicación
npm install --save-dev electron
code package.json     < editamos el fichero package.json
```

**package.json:**

```json
{
    ...
    "main": "main.js",
    ...
    "scripts": {
        "start": "electron ."
    },
    ...
}
```

Añadimos tres ficheros: `main.js` para el proceso principal, `index.html` para la página web del proceso renderer y `renderer.js` para el código del proceso renderer:

**main.js:**

```js
const {app, BrowserWindow} = require('electron');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
})
```

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
    <meta http-equiv="X-Content-Security-Policy" content="default-src 'self'; script-src 'self'">
    <title>Document</title>
</head>
<body>
    <h1>Hello World!</h1>
    <script src="./renderer.js"></script>
</body>
</html>
```

**renderer.js:**
```js
alert("Message from renderer process");
```

## Procesos

El proceso `main` es el encargado de crear las ventanas y tiene acceso directo a node.js. Cada ventana que se crea se ejecutará en un hilo independiente.

Las ventanas que se crean desde el proceso main van enlazadas con un fichero HTML (como se ve en el ejemplo). El código javascript que se ejecuta en esa ventana está en el proceso `renderer`, y cada ventana tiene un proceso renderer independiente. Este proceso, por defecto, no tiene acceso a node.js. Se puede hacer que tenga acceso, pero no es recomendable por motivos de seguridad. Se verá cómo acceder al sistema de ficheros y otros elementos accesibles desde node, más adelante en este tutorial.

El script `preload` permite acceder a APIs de Node.js desde el proceso renderer durante la carga de éste

Vamos a cargar las versiones de node, electron y chromium en el proceso renderer. Para ello, cambiamos el código HTML para mostrar esos datos, creamos el fichero `preload.js` y lo cargamos en el proceso `main`:

**index.html:**

```html
...
<body>
    <h1>Hello World!</h1>
    We are using Node.js <span id="node-version"></span>,
    Chromium <span id="chrome-version"></span>
    and Electron <span id="electron-version"></span>

    <script src="./renderer.js"></script>
</body>
</html>
```

**preload.js:**

```js
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) {
            element.innerText = text;
        }
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        // process está disponible en el proceso main y en preload, pero no en renderer
        replaceText(`${dependency}-version`, process.versions[dependency]);
    }
});
```

**main.js:**

```js
...
const path = require('path');
...
const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    win.loadFile('index.html');
}
...
```

## Comportamiento multiplataforma

Como una aplicación Electron puede ejecutarse en las principales plataformas de escritorio, debemos añadir código para que el comportamiento de la aplicación sea lo más parecido posible al resto de aplicaciones nativas de cada plataforma.

Windows y Linux, al cerrar todas las ventanas de una aplicación se cierra también la aplicación. En macOS no ocurre esto, ya que la aplicación se cierra desde el menú principal, que permanece aunque se hayan cerrado todas las ventanas. En el caso de macOS, si cerramos todas las ventanas, la aplicación queda abierta, y normalmente se vuelve a abrir una ventana nueva cuando activamos la aplicación (es decir, cuando la aplicación vuelve a recibir el foco). El siguiente código en el proceso `main` consigue estos comportamientos:

**main.js:**

```js
...
app.whenReady().then(() => {
    createWindow();
    
    // En macOS, crear una ventana nueva al activar la aplicación, si no hay
    // más ventanas abiertas
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Cuando cerramos todas las ventanas, si no estamos en macOS, salir de la aplicación
    if (process.platform !== 'darwin') {
        app.quit();
    }
})
```

## Depurar con Visual Studio Code

La depuración con Visual Studio no precisa de ningún plugin, simplemente creamos tres configuraciones:

- Una para depurar una aplicación Node, donde depuramos el proceso main
- Otra para depurar una aplicación Chrome, donde depuramos los procesos renderer (y también el código del preload)
- Un compound que junta ambas configuraciones, para depurar los dos tipos de procesos.

**.vscode/launch.json:**

```json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Electron: Main",
            "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
            "runtimeArgs": [
                "--remote-debugging-port=9223",
                "."
            ],
            "windows": {
                "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
            }
        },
        {
            "name": "Electron: Renderer",
            "type": "chrome",
            "request": "attach",
            "port": 9223,
            "webRoot": "${workspaceFolder}",
            "timeout": 30000
        }
    ],
    "compounds": [
        {
            "name": "Electron: All",
            "configurations": [
                "Electron: Main",
                "Electron: Renderer"
            ]
        }
    ]
}
```

## Acceso a node desde el proceso renderer

En teoría se puede acceder a las APIs de node desde el proceso renderer, activando la opción `contextIsolation`, que por defecto está a false, al crear la ventana. Pero no vamos a ver esto, porque no es buena idea. En principio es por temas de seguridad: no es buena idea dar acceso al API de node a una ventana de navegador. Si dentro solo vamos a tener nuestra aplicación, no es problema, pero podría ocurrir que usando una biblioteca de terceros, le diéramos acceso al sistema de fichero a un código desconocido.

La forma recomendada es utilizar `contextBridge`, que nos permitirá definir un mediador accesible desde el renderer, a funciones que queramos implementar en el proceso main. De esta forma no damos acceso full a Node.js, sino que creamos nuestra propia API para hacer lo que necesitemos estrictamente, como guardar o abrir ficheros.

**preload.js:**

```js
const { contextBridge } = require('electron');
const fs = require('fs');

contextBridge.exposeInMainWorld('myAPI', {
    async writeFile(path, content, options) {
        return await fs.promises.writeFile(path, content, options);
    }
});
...
```

**renderer.js:**

```js
myAPI.writeFile('test.txt','Hello, World!',{encoding: 'utf-8'})
    .then(() => alert("Done"))
    .catch(err => alert(err.message));
```


