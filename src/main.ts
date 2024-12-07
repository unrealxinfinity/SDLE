import * as readline from "readline";
import { PNShoppingMap } from "./crdt/PNShoppingMap.js";
import * as fs from 'fs';
import * as zmq from "zeromq";
import cluster from "node:cluster";
import { version } from "os";

enum ConsoleState{
    LOGIN, 
    START,
    SHOPPING_LIST
}

interface item {
    name: string;
    quantity: number;
}

interface state{
    consoleState : ConsoleState;
    items : Map<string, item>;
    shoppingListId : string;
    crdt : PNShoppingMap | null;
    sock : zmq.Request | null;
    persist: boolean
}

const userStates : Map<string, state> = new Map();

const frontAddr = "tcp://127.0.0.1:12346";

const lists : Map<string, string> = new Map();


const readJsonFile = (filePath: string): any => {
    const data = fs.readFileSync(filePath+'.json', 'utf-8');
    return JSON.parse(data);
}

function readFromLocalStorage(userName : string | null){
    if(userName != null && fs.existsSync("./localStorage/"+userName+".json")){
        const localStorageContents = readJsonFile("./localStorage/"+userName);
        for(const shoppingListId in localStorageContents){
            if(shoppingListId == "name") break;
            const shoppingListContents = localStorageContents[shoppingListId];
            const items = new Map();
            const crdt = new PNShoppingMap(userName, shoppingListId);
            lists.set(shoppingListContents["listName"], shoppingListId);
            for(const item of shoppingListContents["items"]){
                const quantity = item.slice(0, item.indexOf('x'));
                const name = item.slice(item.indexOf('x')+1);
                const newItem : item = {name: name, quantity: quantity};
                items.set(name, newItem);
            }
            
            for(const userID in shoppingListContents["inc"]){
                for(const itemName in shoppingListContents["inc"][userID]){
                    const quantity = shoppingListContents["inc"][userID][itemName]
                    crdt.addInc(userName, itemName, quantity);
                }
            }
            for(const userID in shoppingListContents["dec"]){
                for(const itemName in shoppingListContents["dec"][userID]){
                    const quantity = shoppingListContents["dec"][userID][itemName]
                    crdt.addDec(userName, itemName, quantity);
                }
            }
            const state : state = {consoleState: ConsoleState.START, items: items, shoppingListId: shoppingListId, crdt: crdt, sock: null, persist: false}; 
            userStates.set(shoppingListId, state);
        }
    }
}

function generateGUId() : string {
    const timestamp : Number = new Date().getTime();
    const random_num : Number = Math.floor(Math.random() * 1000000);
    return `${timestamp}-${random_num}`; 
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
        for(const [name, id] of lists.entries()){
            console.log("   -"+name+": " + id + ";");
        }
    }

    function fetchShoppingList(id : string, state : state){
        //NOT FINISHED DONT USE
        state.shoppingListId = id;
        state.items.clear();
        state.consoleState = ConsoleState.SHOPPING_LIST;


    }

    function pickShoppingList(name : string, state : state){
        if(lists.has(name)){
            state = userStates.get(lists.get(name));
            state.consoleState = ConsoleState.SHOPPING_LIST;
        }
        else{
            console.log("The list with name " + name + " does not exist\n")
        }
        return state;
    }

    function createShoppingList(name : string, userName : string, state : state){
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
            const newState : state = {consoleState: ConsoleState.SHOPPING_LIST, items: new Map(), shoppingListId: id, crdt: new PNShoppingMap(userName, id), sock: state.sock, persist: true}
            lists.set(name, id);
            userStates.set(id, newState);
            state = pickShoppingList(name, state);
            console.log("Successfully created shopping list " + name + " with id = " + id + '\n');
        }
        else{
            console.log("The list with that name already exists. I'm sorry\n");
        }

        return state;
    }


    
    function addItem(name : string, quantity : number = 1, state : state){
        if(quantity > 0 && !state.items.has(name)){
            const item : item = {name: name, quantity: quantity};
            state.items.set(name, item);
            state.crdt.add(name, quantity);
        }
        else if(quantity > 0){
            const item : item = state.items.get(name);
            item.quantity += quantity;
            state.items.set(name, item);
            state.crdt.add(name, quantity)
        }



    }
    
    function remItem(name : string, state : state, quantity : number){
        if(state.items.has(name)){
            if(quantity > 0){
                const item = state.items.get(name);
                state.crdt.remove(name, Math.min(item.quantity, quantity));
                item.quantity -= quantity;

                if(item.quantity <= 0) state.items.delete(name);
                else state.items.set(name, item);
            }
        }



    }

    function pull(state : state){
       

    }

    function push(state : state){

    }

    function persistLocalStorage(userName : string){
        return setInterval(async () => {
            if(persist){           
                persist = false;
                const data = {}
                for(const state of userStates.values()){
                    const items = [];
                    for(const item of state.items.values()){
                        items.push(item.quantity+"x"+item.name)
                    }
    
                    const crdt_json = JSON.parse(state.crdt.toJSON());
    
                    let listName = "";
                    for(const [name, id] of lists){
                        if(id == state.shoppingListId){
                            listName = name;
                        }
                    }
    
                    data[state.shoppingListId] = {
                        "listName": listName,
                        "items": items,
                        "inc": crdt_json.inc,
                        "dec": crdt_json.dec
                    };   
    
                }
                try{
                    fs.writeFileSync('localStorage/'+userName+'.json', JSON.stringify(data, null, 2), 'utf8')
                } catch(error){
                    console.log("Couldn't write to file");
                }
                persist = true;
            }
        }, 10)
    }

    


    const login_text : string = `Type "login --name" to login to user account\n`;
    const initial_text : string = `Type "help" to view the commands\n`;

    const help_text1 : string = `Type one of the following commands:
       -"list" to list the shopping lists you are a part of;
       -"fetch --id" to fetch a shopping list;
       -"create --listname" to create a new shopping list;
       -"pick --listname" to pick a shopping list;
       -"close" to exit the program;\n\n`;

    const help_text2 : string = `Type one of the following commands:
       -"view" to view the list;
       -"add --itemQuantity --itemName" to add an item to the list or to increase its quantity;
       -"rem --itemName" to remove an item from the list;
       -"rem --itemQuantity --itemName" to remove an item from the list or decrease its quantity;
       -"push" to push changes from the server;
       -"pull" to pull changes from the server;
       -"list" to list the shopping lists you are a part of;
       -"featch --id" to fetch a shopping list;
       -"create --listname" to create a new shopping list;
       -"pick --listname" to pick a shopping list;
       -"close" to exit the program;\n\n`;


    let persist = true;
    let persistingDataInterval = null;

    let text : string = login_text;
    let userName : string = null;
    
    const commands : Array<string> = []//readJsonFile('./test').commands;
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
                case ConsoleState.LOGIN:{
                    if(command == "login" && answerArrayLength == 2){
                        userName = answerArray[1];
                        readFromLocalStorage(userName);
                        persistingDataInterval = persistLocalStorage(userName);
                        text = initial_text;
                        state.consoleState = ConsoleState.START;
                    }
                    break;
                }
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
                        if(state.items.has(itemName)){
                            remItem(itemName, state, state.items.get(itemName).quantity);
                        }
                        
                    }
                    else if(command == "rem" && answerArrayLength == 3){
                        const itemQuantity : number = Number(answerArray[1])
                        const itemName : string = answerArray[2];
                        remItem(itemName, state, itemQuantity);
                    }
                    else if(command == "push" && answerArrayLength == 1){
                        push(state)
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
                    else if(command == "fetch" && answerArrayLength == 2){
                        const id :string = answerArray[1];
                        fetchShoppingList(id, state);
                        text = initial_text;
                        viewShoppingList(state);
                    }
                    else if(command == "create" && answerArrayLength == 2){
                        const name : string = answerArray[1];
                        state = createShoppingList(name, userName, state);
                        text = initial_text;
                    }
                    else if(command == "pick" && answerArrayLength == 2){
                        const listName : string = answerArray[1];
                        state = pickShoppingList(listName, state);
                        viewShoppingList(state);
                        text = initial_text;
                    }
                    else if(command == "help" && answerArrayLength == 1){
                        if(state.consoleState == ConsoleState.START) text = help_text1;
                        else if(state.consoleState == ConsoleState.SHOPPING_LIST) text = help_text2;
                    }
                    break;
                }
                default:{
                    break;
                }

            }
            if(command == "close" && answerArrayLength == 1){
                break;
            }
        }

    }
    
    rl.close();
    if(persistingDataInterval != null){
        setTimeout(() => {
            clearInterval(persistingDataInterval);
        }, 11);
    }

    

}





const rl : readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});



let state : state = {consoleState: ConsoleState.LOGIN, items: new Map(), shoppingListId: "", crdt: null, sock: null, persist: false}; 

handleInput(rl, state);





//rl.close();






