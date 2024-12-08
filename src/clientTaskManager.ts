import * as fs from 'fs';

const actions : Array<string> = [];

const answers : Array<string> = [];

let user = null;

async function sleep(ms: number){
    console.log("mssleep");
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushAction(commands : Array<string>, action : string, description : string){
    commands.push(action);
    actions.push(new Date().getTime() + " Action: " + user + " " + description + "\n");

}

export function pushAnswer(answer : string){
    answers.push(answer + "\n\n");
}


export function manageLogin(commands : Array<string>, userName : string) {
    user = userName;
    pushAction(commands, "login " + user, "logged into the system");
    pushAction(commands, "close", "closed the system");
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

