const CDP = require('chrome-remote-interface');
async function example() {
    try {
        const targets = await CDP.List({ port: 9223 });
        const page = targets.find(t => t.type === 'page');
        const client = await CDP({ port: 9223, target: page });
        const { Runtime } = client;
        const result = await Runtime.evaluate({
            expression: 'document.body.innerText'
        });
        console.log("TEXT START\n" + result.result.value + "\nTEXT END");
        await client.close();
    } catch (err) {
        console.error(err);
    }
}
example();
