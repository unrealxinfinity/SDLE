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

interface user{
    name : string | null;
    state : state | null;
    states : Map<string, state> | null;
    lists : Map<string, string> | null;
    consoleState : ConsoleState;
}

const users : Map<string, user> = new Map();



const frontAddr = "tcp://127.0.0.1:12346";



const clients = 10;
const num_of_lists = 3;
const testingTime = 20;
let automatedTesting = true;
let persist = false;
const debug : [string, string] | null = null;//["Client8", "./listLogs/List2.txt"];




function readFromLocalStorage(userName : string | null){
    if(userName != null && fs.existsSync("./localStorage/"+userName+".json") && !users.has(userName)){
        let user : user;
        if(users.has(userName)) user = users.get(userName);
        else user = {name: userName, state: null, states: new Map(), lists: new Map(), consoleState: ConsoleState.START};
        const localStorageContents = readJsonFile("./localStorage/"+userName);
        for(const shoppingListId in localStorageContents){
            if(shoppingListId == "name") break;
            const shoppingListContents = localStorageContents[shoppingListId];
            user.lists.set(shoppingListContents["listName"], shoppingListId);
            
            const crdt = PNShoppingMap.fromJSON(shoppingListContents["crdt"], user.name, shoppingListId);
            const state : state = {shoppingListId: shoppingListId, crdt: crdt, sock: null}; 
            user.state = state;
            user.states.set(shoppingListId, state);
            users.set(userName, user);
        }
        if(automatedTesting) taskManager.pushAnswer("Login was successfull, loaded data from localStorage", "");
    }
    else if(automatedTesting && !users.has(userName)){
        taskManager.pushAnswer("Login was successfull, started a new user", "");
    }
    else if(automatedTesting){
        taskManager.pushAnswer("Login was successfull", "");
    }
}

function generateGUId() : string {
    const timestamp : Number = new Date().getTime();
    const random_num : Number = Math.floor(Math.random() * 1000000);
    return `${timestamp}-${random_num}`; 
}


function createQuestion(rl : readline.Interface, text : string) : Promise<string> {
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            resolve(answer);
        });
    });
}

async function handleInput(user : user){



    
    function viewShoppingList(state : state){
        console.log("                SHOPPING LIST              \n");
        
        for(const itemName of state.crdt.getAllItems()){
            const quantity = state.crdt.calcTotal(itemName);
            if(quantity > 0) console.log("   - " + quantity + "x " + itemName + ";");
        }
    
    }

    function listShoppingLists(user : user){
        for(const [name, id] of user.lists.entries()){
            console.log("   -"+name+": " + id + ";");
        }
    }

    async function fetchShoppingList(id : string, name : string, user : user){
        if(!user.states.has(name)){
            const newState : state = {shoppingListId: id, crdt: new PNShoppingMap(user.name, id), sock: null}
            const success = await pull(user.name, newState);
            if(success){
                user.lists.set(name, id);
                user.states.set(id, newState);
                user = pickShoppingList(name, user);
                viewShoppingList(user.state);
                console.log("Successfully fetched shopping list " + name + " with id = " + id + '\n');
                return user;
            }
            else{
                console.log("Failed to fetch list " + id);
                return user;
            }
        }
        console.log("The list with that name already exists. I'm sorry\n");
        return user;


    }

    function pickShoppingList(name : string, user : user){
        if(user.lists.has(name)){
            user.state = user.states.get(user.lists.get(name));
            user.consoleState = ConsoleState.SHOPPING_LIST;
        }
        else{
            console.log("The list with name " + name + " does not exist\n")
        }
        return user
    }

    function createShoppingList(name : string, user : user){
        if(!user.states.has(name)){
            let id = generateGUId();
            if(automatedTesting)id = id = user.name.slice(6);
            if(debug != null) id = name;
            const newState : state = {shoppingListId: id, crdt: new PNShoppingMap(user.name, id), sock: null}
            user.lists.set(name, id);
            user.states.set(id, newState);
            user = pickShoppingList(name, user);
            console.log("Successfully created shopping list " + name + " with id = " + id + '\n');
            if(automatedTesting) taskManager.pushAnswer("Successfully created shopping list " + id, user.state.crdt.toJSON());
        }
        else{
            console.log("The list with that name already exists. I'm sorry\n");
            if(automatedTesting) taskManager.pushAnswer("Unsuccessfully created shopping list", user.state.crdt.toJSON());
        }

        return user;
    }


    
    async function pull(userName : string, state : state){
        if(state.sock == null){
            state.sock = new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000})
            state.sock.connect(frontAddr);
        }
        const fetchMsg = {
            type: "fetch",
            id: state.shoppingListId.toString()
        };

    
        const fetchRequest = await state.sock.send(JSON.stringify(fetchMsg));
        try {
            const fetchReply = JSON.parse((await state.sock.receive()).toString());
            console.log(fetchReply.message);
            if(fetchReply.type == "fetch"){
                const incoming_crdt = PNShoppingMap.fromJSON(fetchReply.list);
                state.crdt.join(incoming_crdt);
                if(automatedTesting) taskManager.pushCartContents(state.crdt, "Successfully pulled!\n");
                return true;
            }
        } catch (e) {
            console.log("Pull failed.");
            state.sock = new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000});
            state.sock.connect(frontAddr);
        }
        if(automatedTesting) taskManager.pushAnswer("Unsucessfully pulled", "");
        return false;
    }

    async function push(state : state){
        if(state.sock == null){
            state.sock = new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000});
            state.sock.connect(frontAddr);
        }
        const updateMsg = {
            type: "update",
            id: state.shoppingListId.toString(),
            list: state.crdt.toJSON()
        };

        
        const updateRequest = await state.sock.send(JSON.stringify(updateMsg));
    
        try {
            const updateReply = JSON.parse((await state.sock.receive()).toString());

            console.log(updateReply.message);
            if(automatedTesting) taskManager.pushCartContents(state.crdt, "Successfully pushed!\n");
        } catch (e) {
            if(automatedTesting) taskManager.pushCartContents(state.crdt, "UnSuccessfully pushed!\n");
            state.sock = new zmq.Request({sendTimeout: 1000, receiveTimeout: 2000});
            state.sock.connect(frontAddr);
            console.log("Push failed.");
        }
    }

    function persistLocalStorage(){
        return setInterval(async () => {
            if(persist && users.size > 0){           
                persist = false;
                for(const user of users.values()){
                    const data = {}
                    for(const state of user.states.values()){
    
                    

    
                        let listName = "";
                            for(const [name, id] of user.lists.entries()){
                            if(id == state.shoppingListId){
                                listName = name;
                            }
                        }
        
                        data[state.shoppingListId] = {
                            "listName": listName,
                            "crdt": state.crdt.toJSON()
                        };   
    
                    }
                    try{
                        fs.writeFileSync('localStorage/'+user.name+'.json', JSON.stringify(data, null, 2), 'utf8')
                    } catch(error){
                        console.log("Couldn't write to file");
                    }
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
       -"login --name" to login to another user account;
       -"close" to exit the program;\n\n`;

    const help_text2 : string = `Type one of the following commands:
       -"view" to view the list;
       -"add --itemQuantity --itemName" to add an item to the list or to increase its quantity;
       -"del --itemName" to delete an item from the list;
       -"rem --itemQuantity --itemName" to remove an item from the list or decrease its quantity;
       -"push" to push changes from the server;
       -"pull" to pull changes from the server;
       -"list" to list the shopping lists you are a part of;
       -"fetch --id --name" to fetch a shopping list;
       -"create --listname" to create a new shopping list;
       -"pick --listname" to pick a shopping list;
       -"login --name" to login to another user account;
       -"close" to exit the program;\n\n`;


    let persistingDataInterval = null;

    let text : string = login_text;
    let rl : readline.Interface = null;

    
    const commands : Array<string> = []//readJsonFile('./test').commands;


    while(true){
        if(automatedTesting && user.consoleState == ConsoleState.LOGIN && commands.length == 0) await taskManager.manageLogin(commands, process.env.USERNAME, num_of_lists, testingTime);
        if(automatedTesting && user.consoleState == ConsoleState.START && commands.length == 0) await taskManager.manageListCreation(commands, user.lists);
        if(automatedTesting && user.consoleState == ConsoleState.SHOPPING_LIST && commands.length == 0) await taskManager.manageRandomAction(commands, user.state.shoppingListId, user.state.crdt, user.lists);
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
            switch(user.consoleState){
                case ConsoleState.SHOPPING_LIST:{
                    if(command == "view" && answerArrayLength == 1){
                        viewShoppingList(user.state);
                    }
                    else if(command == "add" && answerArrayLength >= 3){
                        const itemQuantity : number = Number(answerArray[1])
                        let itemName : string = answerArray[2];
                        for(let index = 3; index < answerArrayLength; index++){
                            itemName += " " + answerArray[index];
                        }
                        user.state.crdt.add(itemName, itemQuantity);
                        if(automatedTesting) {
                            taskManager.pushCartContents(user.state.crdt, "");
                        }
                    }
                    else if(command == "del" && answerArrayLength >= 2){
                        let itemName : string = answerArray[1];
                        for(let index = 2; index < answerArrayLength; index++){
                            itemName += " " + answerArray[index];
                        }
                        const allItems = user.state.crdt.getAllItems();
                        if(allItems.has(itemName)){
                            const quantity = user.state.crdt.calcTotal(itemName);
                            console.log(quantity)
                            user.state.crdt.remove(itemName, quantity);
                        }
                    }
                    else if(command == "rem" && answerArrayLength >= 3){
                        const itemQuantity : number = Number(answerArray[1])
                        let itemName : string = answerArray[2];
                        for(let index = 3; index < answerArrayLength; index++){
                            itemName += " " + answerArray[index];
                        }
                        const allItems = user.state.crdt.getAllItems();
                        if(allItems.has(itemName)){
                            const totalQuant = user.state.crdt.calcTotal(itemName);
                            user.state.crdt.remove(itemName, Math.min(itemQuantity, totalQuant));
                            if(automatedTesting) {
                                taskManager.pushCartContents(user.state.crdt, "");
                            }
                        }
                    }
                    else if(command == "push" && answerArrayLength == 1){
                        await push(user.state)
                    }
                    else if(command == "pull" && answerArrayLength == 1){
                        await pull(user.name, user.state)
                    }
                    else if(command == "help" && answerArrayLength == 1){
                        text = help_text2;
                        break;
                    }
                }
                case ConsoleState.START:{
                    if(command == "list" && answerArrayLength == 1){
                        listShoppingLists(user);
                    }
                    else if(command == "fetch" && answerArrayLength == 3){
                        const id :string = answerArray[1];
                        const name : string = answerArray[2];
                        user = await fetchShoppingList(id, name, user);
                        text = initial_text;
                    }
                    else if(command == "create" && answerArrayLength == 2){
                        const name : string = answerArray[1];
                        user = createShoppingList(name, user);
                        text = initial_text;
                    }
                    else if(command == "pick" && answerArrayLength == 2){
                        const listName : string = answerArray[1];
                        user = pickShoppingList(listName, user);
                        if(automatedTesting) taskManager.pushAnswer("Picked list Successfully!", "");
                        viewShoppingList(user.state);
                        text = initial_text;
                    }
                    else if(command == "help" && answerArrayLength == 1){
                        text = help_text1;
                    }
                }
                case ConsoleState.LOGIN:{
                    if(command == "login" && answerArrayLength == 2){
                        const userName : string = answerArray[1];
                        readFromLocalStorage(userName);
                        if(persistingDataInterval == null) persistingDataInterval = persistLocalStorage();
                        text = initial_text;
                        if(users.has(userName)) user = users.get(userName);
                        else{
                            user = {name: userName, state: {shoppingListId: "", crdt: null, sock: null}, states: new Map(), lists: new Map(), consoleState: ConsoleState.START};
                            users.set(userName, user);
                        }            
                    }
                    break;
                }
                default:{
                    break;
                }

            }
            if(command == "close" && answerArrayLength == 1){
                if(automatedTesting) taskManager.pushAnswer("Successfully closed the System", user.state.crdt.toJSON());
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

    for(const user_ of users.values()){
        for(const userState of user_.states.values()){
            if(userState.sock != null){
                userState.sock.close();
            }
        }
    }

}



function createLogs(){
    function createList(splittedLines : Array<string>, index : number):Map<string, number>{
        const products : Map<string, number>= new Map();
        while(index < splittedLines.length){
            const line = splittedLines[index];
            const splittedLine = line.split(/[\s]+/);
            const quantity = Number(splittedLine[0].slice(0, splittedLine[0].length-1));
            let itemName = "";
            let count = 1;
            while(count < splittedLine.length){
                if(itemName != "") itemName += " ";
                itemName += splittedLine[count];
                count += 1;
            }
            index += 1;
            products.set(itemName, quantity);
        }
        return products;
    }

    function pull(clientProducts : [Map<string, number>, Map<string, number>, number], changes : Array<[string, Map<string, number>]>, client : string, index : number){
        if(index == -1){
            clientProducts[2] = index + 1;
            return true;
        }
        if(index < changes.length){
            const [changeClient, change] = changes[index];
            if(changeClient != client){
                for(const [itemName, changedQuantity] of change.entries()){
                    if(clientProducts[0].has(itemName)){
                        const currentQuantity = clientProducts[0].get(itemName);
                        clientProducts[0].set(itemName, currentQuantity+changedQuantity);
                    }
                    else{
                        clientProducts[0].set(itemName, changedQuantity);
                    }
                }
            }
            clientProducts[2] = index + 1;
            return true;
        }
        return false;

    }

    const timeline : Array<number> = [];
    const contents : Map<number, Array<string>> = new Map();
    const basePath : string = "./"

    for(let client = 1; client <= clients; client++){
        const fileContent = fs.readFileSync(basePath + "clientLogs/Client" + client + ".txt", 'utf-8');
        const splittedContent = fileContent.split(/\n\s*\n/).map(entry => entry.trim());
        for(const content of splittedContent){
            const match = content.match(/^(\d+)\s+Action:/);
            //console.log(match)
            if(match){
                const time = Number(match[1]);
                if(contents.has(time)){
                    const oldContent = contents.get(time);
                    oldContent.push(content);
                    contents.set(time, oldContent);
                }
                else{
                    contents.set(time, [content]);
                    timeline.push(time);
                }
            }
        }
    }
    timeline.sort();

    let inOrderLog : string = "";

    const listLogs : Map<number, string> = new Map(); 

    for(const time of timeline){
        const content = contents.get(time);
        for(const sameTimeContent of content){
            for(let list_id = 1; list_id <= num_of_lists; list_id++){
                if(sameTimeContent.includes("list " + list_id + '\n')){
                    if(listLogs.has(list_id)){
                        let prevListLog = listLogs.get(list_id);
                        prevListLog += sameTimeContent + '\n\n';
                        listLogs.set(list_id, prevListLog);
                    }
                    else{
                        listLogs.set(list_id, sameTimeContent + '\n\n');
                    }
                }
            }
            inOrderLog += sameTimeContent + '\n\n';
        }
    }


    const testResults : [number, number, Array<string>] = [0, 0, []];
    const availableActions : Array<string> = ["Added", "Removed", "Pulled"];
    
    for(const [listID, listContents] of listLogs.entries()){
        fs.writeFileSync(basePath + "listLogs/List" + listID + ".txt", listContents,'utf8');
        const splittedContents = listContents.split(/\n\s*\n/).map(entry => entry.trim());
        const clientProducts : Map<string, [Map<string, number>, Map<string, number>, number]>= new Map();
        const serverProducts : Map<string, number> = new Map();
        const changes : Array<[string, Map<string, number>]> = [];
        for(const splittedContent of splittedContents){
            const splittedListContents = splittedContent.split(/[\s]+/);
            const splittedListContentsLines = splittedContent.split(/[\n]+/);
            const client = splittedListContents[2];
            const debugging : boolean = listID == 3 && splittedListContents[0] == "1734213523788";
            if(debugging){
                const a = true;
            }
            if(!clientProducts.has(client)){
                clientProducts.set(client, [new Map(), new Map(), -1]);
            }
            let prevClientProducts =  clientProducts.get(client);
            let action = splittedListContents[3];
            if(action == undefined)continue;
            if(action == "Fetched") action = "Pulled";
            let passedTest : boolean = true;
            if(action == "Added"){
                if(debugging){
                    const a = 3;
                    console.log(prevClientProducts[0])
                }
                const quantity = Number(splittedListContents[4].slice(0, splittedListContents[4].length-1));
                let itemName = "";
                let index = 5;
                while(splittedListContents[index] != "to"){
                    if(itemName != "") itemName += " ";
                    itemName += splittedListContents[index];
                    index += 1;
                }
                if(prevClientProducts[0].has(itemName)){
                    let prevItemQuantity = prevClientProducts[0].get(itemName);
                    prevItemQuantity += quantity;
                    prevClientProducts[0].set(itemName, prevItemQuantity);
                }
                else{
                    prevClientProducts[0].set(itemName, quantity);
                }

                if(prevClientProducts[1].has(itemName)){
                    let prevChangeQuantity = prevClientProducts[1].get(itemName);
                    prevChangeQuantity += quantity;
                    prevClientProducts[1].set(itemName, prevChangeQuantity);
                }
                else{
                    prevClientProducts[1].set(itemName, quantity);
                }

                if(debugging){
                    const a = 3;
                    console.log(prevClientProducts[0])
                }

                const resultedProducts = createList(splittedListContentsLines, 1);
                for(const [prodName, prodQuant] of resultedProducts.entries()){
                    if(!prevClientProducts[0].has(prodName)) {
                        passedTest = false;
                        break;
                    }
                    const prevClientProductQuantity = prevClientProducts[0].get(prodName);
                    if(prevClientProductQuantity != prodQuant){
                        passedTest = false;
                        break;
                    }

                }
                if(passedTest){
                    for(const [prodName, prodQuant] of prevClientProducts[0].entries()){
                        if(!resultedProducts.has(prodName)){
                            passedTest = false;
                            break;
                        }
                    }
                }
                if(debugging){
                    const a = 3;
                    console.log(prevClientProducts[0], resultedProducts, passedTest)
                }
                prevClientProducts[0] = structuredClone(resultedProducts);

            }
            else if(action == "Removed"){
                const quantity = Number(splittedListContents[4].slice(0, splittedListContents[4].length-1));
                let itemName = "";
                let index = 5;
                while(splittedListContents[index] != "from"){
                    if(itemName != "") itemName += " ";
                    itemName += splittedListContents[index];
                    index += 1;
                }
                if(prevClientProducts[0].has(itemName)){
                    let prevItemQuantity = prevClientProducts[0].get(itemName);
                    prevItemQuantity -= quantity;
                    if(prevItemQuantity <= 0) prevClientProducts[0].delete(itemName);
                    else prevClientProducts[0].set(itemName, prevItemQuantity);
                }
                if(prevClientProducts[1].has(itemName)){
                    let prevChangeQuantity = prevClientProducts[1].get(itemName);
                    prevChangeQuantity -= quantity;
                    prevClientProducts[1].set(itemName, prevChangeQuantity);
                }
                else{
                    prevClientProducts[1].set(itemName, -quantity);
                }

                const resultedProducts = createList(splittedListContentsLines, 1);
                for(const [prodName, prodQuant] of resultedProducts.entries()){
                    if(!prevClientProducts[0].has(prodName)) {
                        passedTest = false;
                        break;
                    }
                    const prevClientProductQuantity = prevClientProducts[0].get(prodName);
                    if(prevClientProductQuantity != prodQuant){
                        passedTest = false;
                        break;
                    }
                }
                if(passedTest){
                    for(const [prodName, prodQuant] of prevClientProducts[0].entries()){
                        if(!resultedProducts.has(prodName)){
                            passedTest = false;
                            break;
                        }
                    }
                }
                prevClientProducts[0] = structuredClone(resultedProducts);
            }
            else if(action == "Pushed"){
                for(const [itemName, quantity] of prevClientProducts[1].entries()){
                    if(serverProducts.has(itemName)){
                        const serverProductQuantity = serverProducts.get(itemName);
                        const offset = quantity+serverProductQuantity;
                        if(offset < 0){
                            prevClientProducts[1].set(itemName, quantity-offset);
                        }
                        serverProducts.set(itemName, Math.min(serverProductQuantity+quantity));
                    }
                    else{
                        if(quantity < 0){
                            prevClientProducts[1].delete(itemName);
                        }
                        serverProducts.set(itemName, Math.min(0, quantity));
                    }
                }

                changes.push([client, structuredClone(prevClientProducts[1])]);
                prevClientProducts[1].clear();
            }
            else if(action == "Pulled"){
                const pulledProducts = createList(splittedListContentsLines, 2);
                while(pull(prevClientProducts, changes, client, prevClientProducts[2])){
                    passedTest = true;
                    for(const [prodName, prodQuant] of pulledProducts.entries()){
                        if(!prevClientProducts[0].has(prodName)) {
                            passedTest = false;
                            break;
                        }
                        const prevClientProductQuantity = prevClientProducts[0].get(prodName);
                        if(prevClientProductQuantity != prodQuant){
                            passedTest = false;
                            break;
                        }
    
                    }
                    if(passedTest){
                        for(const [prodName, prodQuant] of prevClientProducts[0].entries()){
                            if(!pulledProducts.has(prodName)){
                                passedTest = false;
                                break;
                            }
                        }
                    }
                    if(passedTest)break;
                }
                prevClientProducts[0] = structuredClone(pulledProducts);

                
                //prevClientProducts[0] = structuredClone(pulledProducts);
            }

            if(availableActions.includes(action)){
                testResults[1] += 1;
                if(passedTest) testResults[0] += 1;
                else testResults[2].push(splittedContent);
            }

            clientProducts.set(client, prevClientProducts);
        }


    }
    console.log("TEST RESULTS\n");
    console.log(testResults[0] + "/" + testResults[1] + '\n');
    if(testResults[2].length > 0){
        console.log(testResults[2]);
    }

    fs.writeFileSync("./generalLogs.txt", inOrderLog,'utf8')
    
    return testResults[2];
}


async function debugMode(){


    const debugName = debug[0];
    const filePath = debug[1];
    const fileContents = fs.readFileSync(filePath, 'utf-8');

    const splittedContents = fileContents.split(/\n\s*\n/).map(entry => entry.trim());
    let current_userName : string = "";
    const rl : readline.Interface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    for(let index = 0; index < splittedContents.length; index++){
        const splittedContent = splittedContents[index];
        const splittedListContents = splittedContent.split(/[\s]+/);
        const splittedListContentsLines = splittedContent.split(/[\n]+/);
        const userName = splittedListContents[2];
        const action = splittedListContents[3];

        if(userName == debugName){
            if(action == "Added" || action == "Removed" || action == "Pulled"){
                console.log(splittedContent + '\n');
                while(true){
                    const answer = await createQuestion(rl, "");
                    const answerArray : Array<string> = answer.split(" ");
                    const answerArrayLength = answerArray.length;
                    if(answerArrayLength == 1){
                        if(answerArray[0] == "next"){
                            console.clear();
                            break;
                        }
                        else if(answerArray[0] == "back"){
                            console.clear();
                            index = Math.max(-1, index - 2)
                            break;
                        }
                        else if(answerArray[0] == "close"){
                            if(rl != null) rl.close();
                            return;
                        }
                    }
        
                }
            }
        }


    }
    


}


if(debug !== null) automatedTesting = false;

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
        createLogs();
        process.exit(0);
      }
    });
}
else{
    let user : user = {name: null, state: null, states: null, lists: null, consoleState: ConsoleState.LOGIN};

    if(debug != null)await debugMode()
    else await handleInput(user);
    if(automatedTesting) {
        taskManager.writeLog();
        process.disconnect();
    }
}











//rl.close();






