import * as fs from 'fs';
import { PNShoppingMap } from './crdt/PNShoppingMap.js';

const actions : Array<string> = [];

const answers : Array<string> = [];

const recipes : Array<PNShoppingMap> = [];

const listIDs : Array<string> = []

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



export async function manageLogin(commands : Array<string>, userName : string, clients : number) {
    function createRecipe(name : string, ingredients : Array<string>, quantities : Array<number>){
        const crdt = new PNShoppingMap(name, "", false);

        for(let index = 0; index < quantities.length; index++){
            crdt.add(ingredients[index], quantities[index]);
        }
        recipes.push(crdt);
        

    }
    for(let i = 1; i <= clients; i++){
        listIDs.push(i.toString());
    }
    user = userName;
    await pushAction(commands, "login " + user, "logged into the system");

    createRecipe("zucchini slice", ["egg", "flour", "zucchini", "onion", "bacon", "cheddar", "vegetable oil"], [5, 1, 4, 1, 1, 1, 1]);


}

export async function manageListCreation(commands : Array<string>, lists : Map<string, string>){
    if(currentRecipe == null) getRandomRecipe();

    const id = user.slice(6);
    if(lists.has(id)){
        await pushAction(commands, "pick " + id, "Picked list" + id);
    }
    else{
        await pushAction(commands, "create " + id, "Created list " + id);
        await pushAction(commands, "push", "Pushed List " + id);
    }
    
}

export async function manageAddOrRemove(commands : Array<string>, crdt : PNShoppingMap){
    function getAllItemQuantities(crdt : PNShoppingMap){
        const allItems : Set<string> = crdt.getAllItems();
        const allItemsQuantities : Map<string, number> = new Map();
        for(const itemName of allItems){
            const quantity = crdt.calcTotal(itemName);
            if(quantity > 0) allItemsQuantities.set(itemName, quantity);
        }
        return allItemsQuantities;
    }
    function getItemPossibleChoices(currentCart : Map<string, number>, recipeCart : Map<string, number>){
        const itemChoice : Array<string> = [];

        for(const [itemName, quantity] of recipeCart){
            if(!currentCart.has(itemName)) itemChoice.push(itemName);
            else if(currentCart.get(itemName) != quantity){
                itemChoice.push(itemName);
            }
        }
        for(const [itemName, quantity] of currentCart){
            if(!recipeCart.has(itemName)) itemChoice.push(itemName);
        }

        return itemChoice;
    }

    async function performAction(currentCart : Map<string, number>, recipeCart : Map<string, number>, itemChoice : Array<string>){
        if(itemChoice.length == 0){
            await pushAction(commands, "close", "closed the system");
        }
        else{
            const randomItemName : string = itemChoice[Math.min(itemChoice.length-1, Math.floor(Math.random()*itemChoice.length))];
    
            if(currentCart.has(randomItemName) && !recipeCart.has(randomItemName)){
                const quantity = currentCart.get(randomItemName);
                const randomQuantity = Math.floor(Math.random()*quantity+1);
                await pushAction(commands, "rem " + randomQuantity + " " + randomItemName, "Removed " + randomQuantity + "x " + randomItemName + " from the shopping cart");
            }
            else if(recipeCart.has(randomItemName) && !currentCart.has(randomItemName)){
                const quantity = recipeCart.get(randomItemName);
                const randomQuantity = Math.floor(Math.random()*quantity+1);
                await pushAction(commands, "add " + randomQuantity + " " + randomItemName, "Added " + randomQuantity + "x " + randomItemName + " to the shopping cart");
            }
            else{
                const recipeQuantity = recipeCart.get(randomItemName);
                const currentQuantity = currentCart.get(randomItemName);
        
                if(recipeQuantity > currentQuantity){
                    const quantity = recipeQuantity-currentQuantity
                    const randomQuantity = Math.floor(Math.random()*quantity+1);
                    await pushAction(commands, "add " + randomQuantity + " " + randomItemName, "Added " + randomQuantity + "x " + randomItemName + " to the shopping cart");
                }
                else if(recipeQuantity < currentQuantity){
                    const quantity = currentQuantity-recipeQuantity
                    const randomQuantity = Math.floor(Math.random()*quantity+1);
                    await pushAction(commands, "rem " + randomQuantity + " " + randomItemName, "Removed " + randomQuantity + "x " + randomItemName + " from the shopping cart");
                }
            }
        }
    }

    const currentCart : Map<string, number> = getAllItemQuantities(crdt);
    const recipeCart : Map<string, number> = getAllItemQuantities(currentRecipe);

    const itemChoice : Array<string> = getItemPossibleChoices(currentCart, recipeCart);
    await performAction(currentCart, recipeCart, itemChoice);


}

/*export async function getListID(){
    if(!listIDs.includes(user.slice(6))) {
        await sleep(5000);
        return listIDs[Math.min(Math.floor(Math.random()*listIDs.length), listIDs.length-1)];
    }
    return user.slice(6);
}*/

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

