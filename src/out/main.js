import * as readline from "readline";
function createQuestion(rl, text) {
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            resolve(answer);
        });
    });
}
function viewShoppingList(items) {
    console.log("                SHOPPING LIST              \n");
    for (const item of items) {
        console.log("   - " + item.quantity + "x " + item.name + ";");
    }
}
function createItem(name, quantity = 1) {
    return {
        name: name,
        quantity: quantity
    };
}
async function handleInput(rl, items) {
    const help_text = `Type one of the following commands:
       -"view" to view the list;
       -"add --itemQuantity --itemName" to add an item to the list;
       -"rem --itemName" to remove an item from the list;
       -"close" to exit the program;
       
    `;
    const initial_text = `Type "help" to view the commands\n`;
    let text = initial_text;
    while (true) {
        const answer = await createQuestion(rl, text);
        text = "";
        const answerArray = answer.split(" ");
        const answerArrayLength = answerArray.length;
        if (answerArrayLength > 2) {
            const command = answerArray[0].toLowerCase();
            if (command == "add" && answerArrayLength == 3) {
                const itemQuantity = Number(answerArray[1]);
                const itemName = answerArray[2];
                items.push(createItem(itemName, itemQuantity));
            }
            else if (command == "rem" && answerArrayLength == 2) {
                const itemName = answerArray[1];
            }
        }
        else if (answerArrayLength == 1) {
            const command = answerArray[0].toLowerCase();
            if (command == "close") {
                break;
            }
            else if (command == "view") {
                viewShoppingList(items);
            }
            else if (command == "help") {
                text = help_text;
            }
        }
    }
    rl.close();
}
//const items = [];
//viewShoppingList(items);
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
handleInput(rl, []);
//rl.close();
//# sourceMappingURL=main.js.map