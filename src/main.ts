import * as readline from "readline";
import { DeltaORMap } from "./crdt/DeltaORMap.js";
import * as fs from 'fs';
import * as zmq from "zeromq";

enum ConsoleState{
    START,
    SHOPPING_LIST
}

interface item {
    name: string;
    quantity: number;
}

interface state{
    consoleState : ConsoleState;
    listIds : Map<string, string>;
    items : Map<string, item>;
    pre_sync_items : Map<string, item>;
    shoppingListId : string;
    crdt : DeltaORMap | null;
    sock : zmq.Request | null;
}

const userStates : Map<string, state> = new Map();

const frontAddr = "tcp://127.0.0.1:12346";

const readJsonFile = (filePath: string): any => {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
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
        //NOT FINISHED DONT USE
        state.shoppingListId = id;
        state.items.clear();
        state.pre_sync_items = structuredClone(state.items)
        state.consoleState = ConsoleState.SHOPPING_LIST;
    }

    function pickShoppingList(name : string, state : state){
        if(userStates.has(name)){
            state = userStates.get(name)
            state.consoleState = ConsoleState.SHOPPING_LIST;
        }
        else{
            console.log("The list with name " + name + " does not exist\n")
        }
        return state;
    }

    async function createShoppingList(name : string, state : state){
        if(!userStates.has(name)){
            /*if(state.sock == null){
                state.sock = new zmq.Request();
                state.sock.connect(frontAddr);
            }
            const createId = {
                type: "create",
            };
            await state.sock.send(JSON.stringify(createId));
            const id : string = (await state.sock.receive()).toString();*/
            const id = generateGUId();
            const newState : state = {consoleState: ConsoleState.SHOPPING_LIST, listIds: state.listIds, items: new Map(), pre_sync_items: new Map(), shoppingListId: id, crdt: new DeltaORMap(generateGUId()), sock: state.sock}
            newState.listIds.set(id, name);
            userStates.set(name, newState);
            state = pickShoppingList(name, state);
            console.log("Successfully created shopping list " + name + " with id = " + id + '\n');
        }
        else{
            console.log("The list with that name already exists. I'm sorry\n");
        }

        return state;
    }


    function generateGUId() : string {
        const timestamp : Number = new Date().getTime();
        const random_num : Number = Math.floor(Math.random() * 1000000);
        return `${timestamp}-${random_num}`; 
    }
    
    function addItem(name : string, quantity : number = 1, state : state){
        if(quantity > 0 && !state.items.has(name)){
            const item : item = {name: name, quantity: quantity};
            state.items.set(name, item);
        }
        else if(quantity > 0){
            const item : item = state.items.get(name);
            item.quantity += quantity;
            state.items.set(name, item);
        }
    }
    
    function remItem(name : string, state : state, quantity : number | null = null){
        if(state.items.has(name)){
            if(quantity == null){
                state.items.delete(name);
            }
            else if(quantity > 0){
                const item = state.items.get(name);
                item.quantity -= quantity;
                if(item.quantity <= 0) state.items.delete(name);
                else state.items.set(name, item);
            }
        }
    }

    function pull(state : state){
        for(const item of state.items.values()){
            if(!state.pre_sync_items.has(item.name)){
                state.crdt.add(item.name, item.quantity)
            }
            else{
                const pre_sync_item = state.pre_sync_items.get(item.name)
                if(pre_sync_item.quantity < item.quantity){
                    state.crdt.add(item.name, item.quantity-pre_sync_item.quantity)
                }
                else if(pre_sync_item.quantity > item.quantity){
                    state.crdt.remove(item.name, pre_sync_item.quantity-item.quantity)
                }
            }

        }

        for(const item of state.pre_sync_items.values()){
            if(!state.items.has(item.name)){
                state.crdt.remove(item.name, item.quantity)
            }
        }



        state.pre_sync_items = state.items

        state.crdt.readAll()



    }




    const initial_text : string = `Type "help" to view the commands\n`;

    const help_text1 : string = `Type one of the following commands:
       -"list" to list the shopping lists you are a part of;
       -"load --id" to load a shopping list;
       -"create --listname" to create a new shopping list;
       -"pick --listname" to pick a shopping list;
       -"close" to exit the program;\n\n`;

    const help_text2 : string = `Type one of the following commands:
       -"view" to view the list;
       -"add --itemQuantity --itemName" to add an item to the list or to increase its quantity;
       -"rem --itemName" to remove an item from the list;
       -"rem --itemQuantity --itemName" to remove an item from the list or decrease its quantity;
       -"pull" to pull changes from the server;
       -"list" to list the shopping lists you are a part of;
       -"load --id" to load a shopping list;
       -"create --listname" to create a new shopping list;
       -"pick --listname" to pick a shopping list;
       -"close" to exit the program;\n\n`;


    let text : string = initial_text;
    const commands : Array<string> = [];//readJsonFile('./test.json').commands;
    while(true){
        let answer : string = "";
        if(commands.length > 0) {
            answer = commands[0]
            commands.shift()
        }
        else answer = await createQuestion(rl, text);
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
                        const itemQuantity : number = Number(answerArray[1])
                        const itemName : string = answerArray[2];
                        addItem(itemName, itemQuantity, state);
                    }
                    else if(command == "rem" && answerArrayLength == 2){
                        const itemName : string = answerArray[1];
                        remItem(itemName, state);
                    }
                    else if(command == "rem" && answerArrayLength == 3){
                        const itemQuantity : number = Number(answerArray[1])
                        const itemName : string = answerArray[2];
                        remItem(itemName, state, itemQuantity);
                    }
                    else if(command == "pull" && answerArrayLength == 1){
                        pull(state)
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
                        viewShoppingList(state);
                    }
                    else if(command == "create" && answerArrayLength == 2){
                        const name : string = answerArray[1];
                        state = await createShoppingList(name, state);
                        text = initial_text;
                    }
                    break;
                }
                default:{
                    break;
                }

            }
            if(command == "pick" && answerArrayLength == 2){
                const listName : string = answerArray[1];
                state = pickShoppingList(listName, state);
                viewShoppingList(state);
                text = initial_text;
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

let state : state = {consoleState: ConsoleState.START, listIds: new Map(), items: new Map(), pre_sync_items: new Map(), shoppingListId: "", crdt: null, sock: null}; 


handleInput(rl, state);

//rl.close();






