import * as readline from "readline";


enum ConsoleState{
    START,
    SHOPPING_LIST
}

interface item {
    name: string;
    quantity: Number;
}

interface state{
    consoleState : ConsoleState;
    listIds : Map<string, string>;
    items : Map<string, item>;
    pre_sync_items : Map<string, item>;
    shoppingListId : string;
}


async function handleInput(rl : readline.Interface, state : state){
    function createQuestion(rl : readline.Interface, text : string) : Promise<string> {
        return new Promise((resolve) => {
            rl.question(text, (answer) => {
                resolve(answer);
            });
        });
    }
    
    function viewShoppingList(state : state){
        console.log("                SHOPPING LIST              \n");
        for(const item of state.items.values()){
            console.log("   - " + item.quantity + "x " + item.name + ";");
        }
    
    }

    function listShoppingLists(state : state){
        for(const [id, name] of state.listIds.entries()){
            console.log("   -"+name+": " + id + ";");
        }
    }

    function loadShoppingList(id : string, state : state){
        state.shoppingListId = id;
        state.items.clear();
        state.consoleState = ConsoleState.SHOPPING_LIST;
    }

    function createShoppingList(name : string, state : state){
        const id : string = generateGUId();
        state.listIds.set(id, name);
        loadShoppingList(id, state);
    }


    function generateGUId() : string {
        const timestamp : Number = new Date().getTime();
        const random_num : Number = Math.floor(Math.random() * 1000000);
        return `${timestamp}-${random_num}`; 
    }
    
    function addItem(name : string, quantity : Number = 1, state : state){
        const item : item = {name: name, quantity: quantity};
        if(!state.items.has(name)){
            state.items.set(name, item);
        }
    }
    
    function remItem(name : string, state : state){
        if(state.items.has(name)){
            state.items.delete(name);
        }
    }

    function sync(state : state){
        const changes : Map<string, item> = new Map();

        for(const item of state.items.values()){
            if(!state.pre_sync_items.has(item.name)){
                changes.set(item.name, item);
            }
        }

        for(const item of state.pre_sync_items.values()){
            if(!state.items.has(item.name)){
                
            }
        }
    }




    const initial_text : string = `Type "help" to view the commands\n`;

    const help_text1 : string = `Type one of the following commands:
       -"list" to list the shopping lists you are a part of;
       -"load --id" to load a shopping list;
       -"create --name" to create a new shopping list;
       -"close" to exit the program;\n\n`;

    const help_text2 : string = `Type one of the following commands:
       -"view" to view the list;
       -"add --itemQuantity --itemName" to add an item to the list;
       -"rem --itemName" to remove an item from the list;
       -"sync" to sync the changes with other users;
       -"list" to list the shopping lists you are a part of;
       -"load --id" to load a shopping list;
       -"create --name" to create a new shopping list;
       -"close" to exit the program;\n\n`;


    let text : string = initial_text;
    while(true){
        const answer : string = await createQuestion(rl, text);
        text = "";
        const answerArray : Array<string> = answer.split(" ");
        const answerArrayLength = answerArray.length;
        if(answerArrayLength > 0){
            const command : string = answerArray[0].toLowerCase();
            switch(state.consoleState){
                case ConsoleState.SHOPPING_LIST:{
                    if(command == "view" && answerArrayLength == 1){
                        viewShoppingList(state);
                    }
                    else if(command == "add" && answerArrayLength == 3){
                        const itemQuantity : Number = Number(answerArray[1])
                        const itemName : string = answerArray[2];
                        addItem(itemName, itemQuantity, state);
                    }
                    else if(command == "rem" && answerArrayLength == 2){
                        const itemName : string = answerArray[1];
                        remItem(itemName, state);
                    }
                    else if(command == "sync" && answerArrayLength == 1){
                        sync();
                    }
                    else if(command == "help" && answerArrayLength == 1){
                        text = help_text2;
                    }
                }
                case ConsoleState.START:{
                    if(command == "list" && answerArrayLength == 1){
                        listShoppingLists(state);
                    }
                    else if(command == "load" && answerArrayLength == 2){
                        const id :string = answerArray[1];
                        loadShoppingList(id, state);
                        text = initial_text;
                    }
                    else if(command == "create" && answerArrayLength == 2){
                        const name : string = answerArray[1];
                        createShoppingList(name, state);
                        text = initial_text;
                    }
                    break;
                }
                default:{
                    break;
                }

            }
            if(command == "help" && answerArrayLength == 1){
                if(state.consoleState == ConsoleState.START) text = help_text1;
                else if(state.consoleState == ConsoleState.SHOPPING_LIST) text = help_text2;
            }
            if(command == "close" && answerArrayLength == 1){
                break;
            }
        }

    }
    rl.close();

    

}




const rl : readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let state : state = {consoleState: ConsoleState.START, listIds: new Map(), items: new Map(), pre_sync_items: new Map(), shoppingListId: ""}; 


handleInput(rl, state);

//rl.close();






