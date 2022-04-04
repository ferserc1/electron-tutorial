# Electron + Visual Studio Code

Este es un tutorial para crear una aplicación Electron, y depurarla con Visual Studio Code.

## Prerequisitos

Este tutorial está realizado con Node.js versión 16 y Electron 18. Electron no es un prerequisito, se instalará utilizando npm de forma local al proyecto, con lo que solamente es necesario instalar Node 16 y Visual Studio Code

**NOTA IMPORTANTE:** hasta el momento me ha sido imposible importar módulos ES en el proceso `main` y en el script `preload` (ver más adelante). Hay que tenerlo en cuenta por si va a ser necesario utilizar bibliotecas que estén generadas solamente como módulos ES.

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

## Añadir un framework para la interfaz de usuario: svelte

### Ordenar los ficheros

Antes vamos a reorganizar los ficheros siguiendo la siguiente estructura:

```other
src
 |- preload
 | |- index.js  < mover aquí el fichero preload.js
 |- renderer
   |- index.js  < mover aquí el fichero renderer.js
```

Ahora modificamos la referencia al archivo `preload.js`, pero no hacemos nada con la referencia a `renderer.js`. Esa parte la haremos más adelante.

**main.js:**

```js
const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'src/preload/index.js')
        }
    });
    ...
```

### Instalar dependencias

Vamos a añadir las siguientes dependencias de desarrollo y de producción:

```sh
npm install --save svelte
npm install --save-dev rollup rollup-plugin-css-only rollup-plugin-livereload rollup-plugin-string rollup-plugin-svelte rollup-plugin-terser @rollup/plugin-commonjs @rollup/plugin-node-resolve
```

Y añadimos el fichero `rollup.config.js` a la raíz del proyecto. Tanto las dependencias que hemos instalado, como el siguiente archivo de configuración, están extraídos de la plantilla básica por defecto del proyecto [Svelte](https://svelte.dev/), que es un framework reactivo similar a React, pero bastante más sencillo de usar

**rollup.config.js:**

```js
import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';

const production = !process.env.ROLLUP_WATCH;

export default {
    // Fichero de entrada principal. Es el punto de
    // entrada del código de nuestra aplicación
	input: 'src/renderer/index.js',

	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
        // Fichero de salida JavaScript: lo incluiremos
        // en el archivo index.html
		file: 'build/renderer.js'
	},
	plugins: [

		svelte({
			compilerOptions: {
				dev: !production
			}
		}),

        // Fichero de salida CSS: lo incluiremos en
        // el archivo index.html
		css({ output: 'renderer.css' }),

		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),

		production && terser()
	],
	watch: {
		clearScreen: false
	}
};
```

En el fichero de configuración anterior estamos especificando que el código generado para nuestro renderer debe generarse en `build/renderer.js`. Observa que en el tag `<script>` hemos añadido también el atributo `type="module"`. Así que editamos el fichero `index.html` para incluir esta ruta. También se especifica que el fichero `.css` que se generará del código, se va a colocar en el fichero `renderer.css`. Este fichero se coloca a su vez en el directorio de salida, en `build`. Así que también añadiremos esta referencia en el fichero `index.html`. Y ya que estamos, vamos a añadir también un fichero para hojas de estilo globales, que crearemos en la ruta `css/global.css`. Por último, hemos eliminado el contenido del body de la página, ya que este contenido lo vamos a generar con la vista de Svelte:

**css/global.css:**

```css
html {
    font-family: Verdana, Geneva, Tahoma, sans-serif;
}
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

    <!-- hojas de estilo, build/renderer.css lo genera
         por nosotros el compilador de Svelte -->
    <link rel="stylesheet" href="css/global.css">
    <link rel="stylesheet" href="build/renderer.css">
</head>
<body>

    <!-- renderer, que lo genera Svelte mediante 
         el sistema de building (rollup) -->
    <script src="./build/renderer.js" type="module"></script>
</body>
</html>
```

### Añadir una vista de Svelte

Vamos a añadir una vista. Para ello, creamos un fichero `.svelte` en `src/renderer/views`:

**src/renderer/views/App.svelte:**

```svelte
<script>
    export let name;

    let textValue = "Enter a text here";

    const saveToFile = async () => {
        await window.myAPI.writeFile('test.txt',textValue,{encoding:'utf-8'});
    }

</script>

<h1>Hello, {name}</h1>
We are using Node.js <span>{window.myAPI.getDependencyVersion('node')}</span>,
Chromium <span>{window.myAPI.getDependencyVersion('chrome')}</span>
and Electron <span>{window.myAPI.getDependencyVersion('electron')}</span>

<input type="text" bind:value={textValue} />
<button on:click={async () => await saveToFile()}>Save file</button>
<style>
    h1 {
        font-family: sans-serif;
    }

</style>
```

Ahora modificaremos el fichero `index.js` del renderer para incluir la vista de Svelte que acabamos de añadir:

**src/renderer/index.js:**

```js
import App from './views/App.svelte';

new App({
    target: document.body,
    props: {
        name: 'World'
    }
})
```

Por último, modificamos el API que hemos creado añadiendo una función con la que obtener desde el proceso principal, los números de versión de cada framework:

**src/preload/index.js:**

```js
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
```

Si observas detenidamente el código de la vista de Svelte, verás que puedes acceder al objeto `myAPI` mediante el objeto global `window`:

```svelte
<script>
    ...
    const saveToFile = async () => {
        await window.myAPI.writeFile('test.txt',textValue,{encoding:'utf-8'});
    }
</script>
...
<span>{window.myAPI.getDependencyVersion('electron')}</span>
```

### Script de compilación

Para facilitar el trabajo, podemos añadir el siguiente script de compilación al fichero `package.json`:

```json
{
    ...
    "scripts": {
        ...
        "build": "rollup -c --watch"
    },
    ...
}
```

Al ejecutar `npm run build`, rollup se quedará esperando cambios en los ficheros de código fuente del renderer. Independientemente de esto, puedes ejecutar el depurador de Visual Studio para lanzar tu app. Ten en cuenta que al incluir Svelte, no podrás depurar directamente los ficheros del renderer en Visual Studio Code, pero si que podrás hacerlo utilizando las herramientas de desarrollo de Electron en la ventana de tu app. La configuración de rollup se encarga de generar los ficheros `.map` para facilitar la depuración.


## Distribución

Instalar y guardar como dependencia de desarrollo el paquete `electron-forge`, y ejecutar `electron-forge import` con `npx`.

```sh
npm install --svae-dev @electron-forge/cli
npx electron-forge import
```

El comando `electron-forge import` modifica el ficehro `package.json` para añadir las dependencias requeridas por `electron-forge` para empaquetar la aplicación. También le añade scripts que usaremos más adelante para generar las versiones de distribución.

