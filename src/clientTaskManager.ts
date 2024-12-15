import * as fs from 'fs';
import { PNShoppingMap } from './crdt/PNShoppingMap.js';

const actions : Array<string> = [];

const answers : Array<string> = [];

const crdts : Array<string> = [];

const recipes : Array<PNShoppingMap> = [];

const listIDs : Array<string> = []

let currentRecipe : PNShoppingMap = null;

let user = null;

let initialTime = null;
let testing_time = null;

let addRemoveProb = Math.random();
let pushProb = Math.random();
let pullProb = Math.random();
let changeListProb = Math.random();


function sleep(ms : number) : Promise<void>{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pushAction(commands : Array<string>, action : string, description : string){
    
    commands.push(action);
    await sleep(Math.random()*1000);
    const time = new Date().getTime();
    actions.push(time + " Action: " + user + " " + description + "\n");

}

export function pushAnswer(answer : string, crdt : string){
    answers.push(answer + "\n\n");
    crdts.push(crdt + "\n\n");
}


export function pushCartContents(crdt : PNShoppingMap, answer : string){
    for(const itemName of crdt.getAllItems()){
        const quantity = crdt.calcTotal(itemName);
        if(quantity > 0) answer += quantity + "x " + itemName + "\n";
    }
    pushAnswer(answer, crdt.toJSON());
}


export async function manageLogin(commands : Array<string>, userName : string, num_of_lists : number, testingTime : number) {
    function createRecipe(name : string, ingredients : Array<string>, quantities : Array<number>){
        const crdt = new PNShoppingMap(name, "", false);

        for(let index = 0; index < quantities.length; index++){
            crdt.add(ingredients[index], quantities[index]);
        }
        recipes.push(crdt);
        

    }

    initialTime = new Date().getTime();
    testing_time = testingTime

    for(let i = 1; i <= num_of_lists; i++){
        listIDs.push(i.toString());
    }

    user = userName;
    await pushAction(commands, "login " + user, "logged into the system");

    createRecipe("zucchini slice", ["egg", "flour", "zucchini", "onion", "bacon", "cheddar", "vegetable oil"], [5, 1, 4, 1, 1, 1, 1]);
    createRecipe("easy chicken curry", ["onion", "garlic clove", "ginger", "chicken thigh", "tomato", "yogurt", "coriander", "almond"], [1, 2, 1, 6, 4, 1, 1, 1]);


}

export async function manageListCreation(commands : Array<string>, lists : Map<string, string>){
    if(currentRecipe == null) getRandomRecipe();

    const id = user.slice(6);
    if(lists.has(id)){
        await pushAction(commands, "pick " + id, "Picked list" + id);
    }
    else if(listIDs.includes(id)){
        await pushAction(commands, "create " + id, "Created list " + id);
        await pushAction(commands, "push", "Pushed list " + id);
    }
    else{
        let randomListID = listIDs[Math.floor(Math.random()*listIDs.length)];
        await pushAction(commands, "fetch " + randomListID + " " + randomListID, "Fetched list " + randomListID);
    }
    
}





export async function manageRandomAction(commands : Array<string>, shoppingListID : string, crdt : PNShoppingMap, lists : Map<string, string>){
    async function manageAddOrRemove(commands : Array<string>, shoppingListID : string, crdt : PNShoppingMap){
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
    
        async function performAction(shoppingListID : string, currentCart : Map<string, number>, recipeCart : Map<string, number>, itemChoice : Array<string>){
            if(itemChoice.length == 0){
                await pushAction(commands, "close", "closed the system");
            }
            else{
                const randomItemName : string = itemChoice[Math.min(itemChoice.length-1, Math.floor(Math.random()*itemChoice.length))];
        
                if(currentCart.has(randomItemName) && !recipeCart.has(randomItemName)){
                    const quantity = currentCart.get(randomItemName);
                    const randomQuantity = Math.floor(Math.random()*quantity+1);
                    await pushAction(commands, "rem " + randomQuantity + " " + randomItemName, "Removed " + randomQuantity + "x " + randomItemName + " from list " + shoppingListID);
                }
                else if(recipeCart.has(randomItemName) && !currentCart.has(randomItemName)){
                    const quantity = recipeCart.get(randomItemName);
                    const randomQuantity = Math.floor(Math.random()*quantity+1);
                    await pushAction(commands, "add " + randomQuantity + " " + randomItemName, "Added " + randomQuantity + "x " + randomItemName + " to list " + shoppingListID);
                }
                else{
                    const recipeQuantity = recipeCart.get(randomItemName);
                    const currentQuantity = currentCart.get(randomItemName);
            
                    if(recipeQuantity > currentQuantity){
                        const quantity = recipeQuantity-currentQuantity
                        const randomQuantity = Math.floor(Math.random()*quantity+1);
                        await pushAction(commands, "add " + randomQuantity + " " + randomItemName, "Added " + randomQuantity + "x " + randomItemName + " to list " + shoppingListID);
                    }
                    else if(recipeQuantity < currentQuantity){
                        const quantity = currentQuantity-recipeQuantity
                        const randomQuantity = Math.floor(Math.random()*quantity+1);
                        await pushAction(commands, "rem " + randomQuantity + " " + randomItemName, "Removed " + randomQuantity + "x " + randomItemName + " from list " + shoppingListID);
                    }
                }
            }
        }
    
        const currentCart : Map<string, number> = getAllItemQuantities(crdt);
        const recipeCart : Map<string, number> = getAllItemQuantities(currentRecipe);
    
        const itemChoice : Array<string> = getItemPossibleChoices(currentCart, recipeCart);
        await performAction(shoppingListID, currentCart, recipeCart, itemChoice);
    
    
    }


    async function manageChangeList(commands : Array<string>, shoppingListID : string, lists : Map<string, string>){
        let randomListID = listIDs[Math.floor(Math.random()*listIDs.length)];
        while(randomListID == shoppingListID){
            randomListID = listIDs[Math.floor(Math.random()*listIDs.length)]
        }
        if(lists.has(randomListID)){
            await pushAction(commands, "pick " + randomListID, "Picked list " + randomListID);
        }
        else{
            await pushAction(commands, "fetch " + randomListID + " " + randomListID, "Fetched list " + randomListID);
        }
        addRemoveProb = Math.random();
        pushProb = 0
        changeListProb = addRemoveProb/10;
        pullProb = (addRemoveProb + pushProb + changeListProb)*3
        getRandomRecipe();
    }

    if(new Date().getTime() > initialTime+testing_time*1000){
        await pushAction(commands, "close", "closed the system");
        return;
    }

    const randomProb = Math.random();

    const randomProbScaled = (addRemoveProb + pushProb + pullProb+changeListProb)*randomProb;

    if(randomProbScaled <= addRemoveProb){
        pushProb += Math.random();
        pullProb += Math.random();
        await manageAddOrRemove(commands, shoppingListID, crdt);
    }
    else if(randomProbScaled <= (addRemoveProb+pushProb)){
        pushProb = 0;
        changeListProb = Math.random();
        await pushAction(commands, "push", "Pushed list " + shoppingListID);
    }
    else if(randomProbScaled <= (addRemoveProb+pushProb+pullProb)){
        pullProb = 0;
        pushProb = 0;
        changeListProb = Math.random();
        await pushAction(commands, "pull", "Pulled list " + shoppingListID);
    }
    else if(randomProbScaled <= (addRemoveProb+pushProb+pullProb+changeListProb)){
        await manageChangeList(commands, shoppingListID, lists);
    }
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
    let crdt_content = "";
    for(let index = 0; index < Math.min(actions.length, answers.length); index++){
        content += actions[index];
        content += answers[index];
    }
    for(let index = 0; index < Math.min(actions.length, crdts.length); index++){
        crdt_content += actions[index];
        crdt_content += crdts[index];
    }

    
    try{
        fs.writeFileSync('./clientLogs/'+user+'.txt', content, 'utf8');
    }catch(error){
        console.log("error while logging " + user);
    }
    try{
        fs.writeFileSync('./crdtLogs/' + user + '.txt', crdt_content, 'utf8');
    }catch(error){
        console.log("error while logging " + user);
    }
}

