import * as readline from "readline";
import { PNShoppingMap } from "./crdt/PNShoppingMap.js";
import * as fs from 'fs';
import * as zmq from "zeromq";
import cluster from "node:cluster";
import * as taskManager from "./clientTaskManager.js";
import { readJsonFile } from "./utills/files.js";

enum ConsoleState{
    LOGIN, 
    START,
    SHOPPING_LIST
}

interface state{
    shoppingListId : string;
    crdt : PNShoppingMap | null;
    sock : zmq.Request | null;
}

const userStates : Map<string, state> = new Map();

const frontAddr = "tcp://127.0.0.1:12346";

const lists : Map<string, string> = new Map();

let persist = false;

let consoleState : ConsoleState = ConsoleState.LOGIN;

const clients = 10;
let automatedTesting = false;

function readFromLocalStorage(userName : string | null){
    if(userName != null && fs.existsSync("./localStorage/"+userName+".json")){
        const localStorageContents = readJsonFile("./localStorage/"+userName);
        for(const shoppingListId in localStorageContents){
            if(shoppingListId == "name") break;
            const shoppingListContents = localStorageContents[shoppingListId];
            const crdt = new PNShoppingMap(userName, shoppingListId);
            lists.set(shoppingListContents["listName"], shoppingListId);
            
            for(const userID in shoppingListContents["inc"]){
                for(const itemName in shoppingListContents["inc"][userID]){
                    const [quantity, quantityBought] = shoppingListContents["inc"][userID][itemName]
                    crdt.addInc(userName, itemName, quantity, quantityBought);
                }
            }
            for(const userID in shoppingListContents["dec"]){
                for(const itemName in shoppingListContents["dec"][userID]){
                    const [quantity, quantityBought] = shoppingListContents["dec"][userID][itemName]
                    crdt.addDec(userName, itemName, quantity, quantityBought);
                }
            }
            console.log(crdt.toJSON());
            const state : state = {shoppingListId: shoppingListId, crdt: crdt, sock: new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000})}; 
            state.sock.connect(frontAddr);
            userStates.set(shoppingListId, state);
        }
        if(automatedTesting) taskManager.pushAnswer("Login was successfull, loaded data from localStorage");
    }
    else if(automatedTesting){
        taskManager.pushAnswer("Login was successfull, started a new user");
    }
}

function generateGUId() : string {
    const timestamp : Number = new Date().getTime();
    const random_num : Number = Math.floor(Math.random() * 1000000);
    return `${timestamp}-${random_num}`; 
}



async function handleInput(state : state){


    function createQuestion(rl : readline.Interface, text : string) : Promise<string> {
        return new Promise((resolve) => {
            rl.question(text, (answer) => {
                resolve(answer);
            });
        });
    }
    
    function viewShoppingList(state : state){
        console.log("                SHOPPING LIST              \n");
        
        for(const itemName of state.crdt.getAllItems()){
            const quantity = state.crdt.calcTotal(itemName);
            if(quantity > 0) console.log("   - " + quantity + "x " + itemName + ";");
        }
    
    }

    function listShoppingLists(state : state){
        for(const [name, id] of lists.entries()){
            console.log("   -"+name+": " + id + ";");
        }
    }

    async function fetchShoppingList(id : string, name : string, userName : string, state : state){
        if(!userStates.has(name)){
            const newState : state = {shoppingListId: id, crdt: new PNShoppingMap(userName, id), sock: new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000})}
            newState.sock.connect(frontAddr);
            const success = await pull(userName, newState);
            if(success){
                lists.set(name, id);
                userStates.set(id, newState);
                state = pickShoppingList(name, state);
                console.log("Successfully fetched shopping list " + name + " with id = " + id + '\n');
                if(automatedTesting) {
                    taskManager.pushAnswer("Successfully fetched shopping list " + id);
                    console.log("hello");
                }
                return state;
            }
        }
        console.log("The list with that name already exists. I'm sorry\n");
        if(automatedTesting) taskManager.pushAnswer("Unsuccessfully fetched shopping list " + id);
        return state;


    }

    function pickShoppingList(name : string, state : state){
        if(lists.has(name)){
            state = userStates.get(lists.get(name));
            consoleState = ConsoleState.SHOPPING_LIST;
        }
        else{
            console.log("The list with name " + name + " does not exist\n")
        }
        return state;
    }

    function createShoppingList(name : string, userName : string, state : state){
        if(!userStates.has(name)){
            let id = generateGUId();
            if(automatedTesting)id = id = userName.slice(6);
            const newState : state = {shoppingListId: id, crdt: new PNShoppingMap(userName, id), sock: new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000})}
            newState.sock.connect(frontAddr);
            lists.set(name, id);
            userStates.set(id, newState);
            state = pickShoppingList(name, state);
            console.log("Successfully created shopping list " + name + " with id = " + id + '\n');
            if(automatedTesting) taskManager.pushAnswer("Successfully created shopping list " + id);
        }
        else{
            console.log("The list with that name already exists. I'm sorry\n");
            if(automatedTesting) taskManager.pushAnswer("Unsuccessfully created shopping list");
        }

        return state;
    }


    

    async function pull(userName : string, state : state){
        const fetchMsg = {
            type: "fetch",
            id: state.shoppingListId.toString()
        };

    
        const fetchRequest = await state.sock.send(JSON.stringify(fetchMsg));
    
        const fetchReply = JSON.parse((await state.sock.receive()).toString());
        console.log(fetchReply.message);
        if(fetchReply.type == "fetch"){
            const inc = JSON.parse(fetchReply.list.toString()).inc;
            const dec = JSON.parse(fetchReply.list.toString()).dec;
            const incoming_crdt = new PNShoppingMap(userName, state.shoppingListId);
            for(const clientID in inc){
                const items = inc[clientID];
                for(const itemName in items){
                    const [quantity, quantityBought] = items[itemName];
                    incoming_crdt.addInc(clientID, itemName, quantity, quantityBought);
                }
            }
            for(const clientID in dec){
                const items = dec[clientID];
                for(const itemName in items){
                    const [quantity, quantityBought] = items[itemName];
                    incoming_crdt.addDec(clientID, itemName, quantity, quantityBought);
                }
            }
            state.crdt.join(incoming_crdt);
            if(automatedTesting) taskManager.pushCartContents(state.crdt, "Successfully pulled!\n");
            return true;
        }
        if(automatedTesting) taskManager.pushAnswer("Unsucessfully pulled");
        return false;
    }

    async function push(state : state){
        const updateMsg = {
            type: "update",
            id: state.shoppingListId.toString(),
            list: state.crdt.toJSON()
        };
        
        const updateRequest = await state.sock.send(JSON.stringify(updateMsg));
    
        const updateReply = JSON.parse((await state.sock.receive()).toString());

        console.log(updateReply.message);
        if(automatedTesting) taskManager.pushCartContents(state.crdt, "Successfully pushed!\n");
    }

    function persistLocalStorage(userName : string){
        return setInterval(async () => {
            if(persist && userStates.size > 0){           
                persist = false;
                const data = {}
                for(const state of userStates.values()){
    
                    const crdt_json = JSON.parse(state.crdt.toJSON());

    
                    let listName = "";
                    for(const [name, id] of lists){
                        if(id == state.shoppingListId){
                            listName = name;
                        }
                    }
    
                    data[state.shoppingListId] = {
                        "listName": listName,
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
       -"fetch --id --name" to fetch a shopping list;
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
       -"fetch --id --name" to fetch a shopping list;
       -"create --listname" to create a new shopping list;
       -"pick --listname" to pick a shopping list;
       -"close" to exit the program;\n\n`;


    let persistingDataInterval = null;

    let text : string = login_text;
    let userName : string = null;
    let rl : readline.Interface = null;

    
    const commands : Array<string> = []//readJsonFile('./test').commands;
    if(automatedTesting) await taskManager.manageLogin(commands, process.env.USERNAME, clients);
    while(true){
        if(consoleState == ConsoleState.SHOPPING_LIST && commands.length == 0) await taskManager.manageRandomAction(commands, state.crdt, lists);
        let answer : string = "";
        if(commands.length > 0) {
            answer = commands[0]
            commands.shift()
        }
        else {
            if(rl == null){
                rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
            }
            answer = await createQuestion(rl, text);
        }
        text = "";
        const answerArray : Array<string> = answer.split(" ");
        const answerArrayLength = answerArray.length;
        if(answerArrayLength > 0){
            const command : string = answerArray[0].toLowerCase();
            switch(consoleState){
                case ConsoleState.LOGIN:{
                    if(command == "login" && answerArrayLength == 2){
                        userName = answerArray[1];
                        readFromLocalStorage(userName);
                        persistingDataInterval = persistLocalStorage(userName);
                        text = initial_text;
                        consoleState = ConsoleState.START;
                        if(automatedTesting){
                            await taskManager.manageListCreation(commands, lists);
                        }               
                    }
                    break;
                }
                case ConsoleState.SHOPPING_LIST:{
                    if(command == "view" && answerArrayLength == 1){
                        viewShoppingList(state);
                    }
                    else if(command == "add" && answerArrayLength >= 3){
                        const itemQuantity : number = Number(answerArray[1])
                        let itemName : string = answerArray[2];
                        for(let index = 3; index < answerArrayLength; index++){
                            itemName += " " + answerArray[index];
                        }
                        state.crdt.add(itemName, itemQuantity);
                        if(automatedTesting) {
                            taskManager.pushCartContents(state.crdt, "");
                        }
                    }
                    else if(command == "rem" && answerArrayLength == 2){
                        let itemName : string = answerArray[1];
                        const allItems = state.crdt.getAllItems();
                        if(allItems.has(itemName)){
                            const quantity = state.crdt.calcTotal(itemName);
                            state.crdt.remove(itemName, quantity);
                        }
                    }
                    else if(command == "rem" && answerArrayLength >= 3){
                        const itemQuantity : number = Number(answerArray[1])
                        let itemName : string = answerArray[2];
                        for(let index = 3; index < answerArrayLength; index++){
                            itemName += " " + answerArray[index];
                        }
                        state.crdt.remove(itemName, itemQuantity);
                        if(automatedTesting) {
                            taskManager.pushCartContents(state.crdt, "");
                        }
                    }
                    else if(command == "push" && answerArrayLength == 1){
                        await push(state)
                    }
                    else if(command == "pull" && answerArrayLength == 1){
                        await pull(userName, state)
                    }
                    else if(command == "help" && answerArrayLength == 1){
                        text = help_text2;
                        break;
                    }
                }
                case ConsoleState.START:{
                    if(command == "list" && answerArrayLength == 1){
                        listShoppingLists(state);
                    }
                    else if(command == "fetch" && answerArrayLength == 3){
                        const id :string = answerArray[1];
                        const name : string = answerArray[2];
                        state = await fetchShoppingList(id, name, userName, state);
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
                        text = help_text1;
                    }
                    break;
                }
                default:{
                    break;
                }

            }
            if(command == "close" && answerArrayLength == 1){
                if(automatedTesting) taskManager.pushAnswer("Successfully closed the System");
                break;
            }
        }

    }
    
    if(rl != null) rl.close();
    if(persistingDataInterval != null){
        setTimeout(() => {
            clearInterval(persistingDataInterval);
        }, 11);
    }

    for(const userState of userStates.values()){
        if(userState.sock != null){
            userState.sock.close();
        }
    }

}




if(cluster.isPrimary && automatedTesting){
    for(let client = 1; client <= clients; client++){
        cluster.fork({
            USERNAME: "Client"+client,
        });
    }

    var exitedClients = 0;
    cluster.on("disconnect", function (worker) {
      exitedClients++;
      console.log(exitedClients)
      if (exitedClients === clients){
        console.log("finished");
        process.exit(0);
      }
    });
}
else{
    let state : state = {shoppingListId: "", crdt: null, sock: null}; 

    await handleInput(state);
    if(automatedTesting) {
        taskManager.writeLog();
        process.disconnect();
    }
}











//rl.close();






