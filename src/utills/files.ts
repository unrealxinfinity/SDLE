import * as fs from 'fs';

export const readJsonFile = (filePath: string): any => {
    const data = fs.readFileSync(filePath+'.json', 'utf-8');
    return JSON.parse(data);
}