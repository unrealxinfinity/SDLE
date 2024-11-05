import * as readline from "readline";


interface item {
    name: string;
    quantity: Number;
}

function createQuestion(rl : readline.Interface, text : string) : Promise<string> {
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            resolve(answer);
        });
    });
}

function viewShoppingList(items : Array<item>){
    console.log("                SHOPPING LIST              \n");
    for(const item of items){
        console.log("   - " + item.quantity + "x " + item.name + ";");
    }

}

function createItem(name : string, quantity : Number = 1) : item{
    return {
        name: name,
        quantity: quantity
    }
}

async function handleInput(rl : readline.Interface, items : Array<item>){
    const help_text : string = `Type one of the following commands:
       -"view" to view the list;
       -"add --itemQuantity --itemName" to add an item to the list;
       -"rem --itemName" to remove an item from the list;
       -"close" to exit the program;
       
    `;
    const initial_text : string = `Type "help" to view the commands\n`;
    let text : string = initial_text;
    while(true){
        const answer : string = await createQuestion(rl, text);
        text = "";
        const answerArray : Array<string> = answer.split(" ");
        const answerArrayLength = answerArray.length;
        if(answerArrayLength > 2){
            const command : string = answerArray[0].toLowerCase();
            
            if(command == "add" && answerArrayLength == 3){
                const itemQuantity : Number = Number(answerArray[1])
                const itemName : string = answerArray[2];
                items.push(createItem(itemName, itemQuantity));
            }
            else if(command == "rem" && answerArrayLength == 2){
                const itemName : string = answerArray[1];
            }
        }
        else if(answerArrayLength == 1){
            const command : string = answerArray[0].toLowerCase();
            if(command == "close"){
                break;
            }
            else if(command == "view"){
                viewShoppingList(items);
            }
            else if(command == "help"){
                text = help_text;
            }
        }
    }
    rl.close();

    

}


//const items = [];

//viewShoppingList(items);


const rl : readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

handleInput(rl, []);

//rl.close();






