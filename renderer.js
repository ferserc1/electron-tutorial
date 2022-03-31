
alert("Message from renderer process");

myAPI.writeFile('test.txt','Hello, World!',{encoding: 'utf-8'})
    .then(() => {
        alert("File written");
    })
    .catch(err => {
        alert("Error writting file: ", err.message);
        console.error(err);
    });