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
