import * as fs from 'fs';
import { PNShoppingMap } from './crdt/PNShoppingMap.js';

const actions : Array<string> = [];

const answers : Array<string> = [];

const recipes : Array<PNShoppingMap> = [];

const listIDs : Array<string> = ["1", "2", "3"];

let currentRecipe : PNShoppingMap = null;

let user = null;


function sleep(ms : number) : Promise<void>{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pushAction(commands : Array<string>, action : string, description : string){
    
    commands.push(action);
    const time = new Date().getTime();
    actions.push(time + " Action: " + user + " " + description + "\n");
    await sleep(Math.random()*1000);

}

export function pushAnswer(answer : string){
    answers.push(answer + "\n\n");
}



export async function manageLogin(commands : Array<string>, userName : string) {
    function createRecipe(name : string, ingredients : Array<string>, quantities : Array<number>){
        const crdt = new PNShoppingMap(name, "", false);

        for(let index = 0; index < quantities.length; index++){
            crdt.add(ingredients[index], quantities[index]);
        }
        recipes.push(crdt);
        

    }
    user = userName;
    await pushAction(commands, "login " + user, "logged into the system");

    createRecipe("zucchini slice", ["egg", "flour", "zucchini", "onion", "bacon", "cheddar", "vegetable oil"], [5, 1, 4, 1, 1, 1, 1]);


}

export async function manageListCreation(commands : Array<string>){
    if(currentRecipe == null) getRandomRecipe();

    const id = await getListID()
    if(listIDs.includes(user.slice(6))){
        await pushAction(commands, "create list", "Created list " + id);
        await pushAction(commands, "push", "Pushed List " + id);
    }
    else{
        await pushAction(commands, "fetch " + id + " list", "Fetched list " + id);
    }
    await pushAction(commands, "close", "closed the system");
    
}

export async function getListID(){
    if(!listIDs.includes(user.slice(6))) {
        await sleep(5000);
        return listIDs[Math.min(Math.floor(Math.random()*listIDs.length), listIDs.length-1)];
    }
    return user.slice(6);
}

function getRandomRecipe(){
    currentRecipe = recipes[Math.min(Math.floor(Math.random()*recipes.length), recipes.length-1)]
}






export function writeLog(){
    let content = "";
    for(let index = 0; index < Math.min(actions.length, answers.length); index++){
        content += actions[index];
        content += answers[index];
    }
    try{
        fs.writeFileSync('./clientLogs/'+user+'.txt', content, 'utf8');
    }catch(error){
        console.log("error while logging " + user);
    }
}

