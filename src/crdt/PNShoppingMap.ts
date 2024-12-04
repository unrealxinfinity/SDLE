class PNShoppingMap{
    private inc: Map<string,Map<string,number>>
    private dec: Map<string,Map<string,number>>
    private id : string;
    private clientId : string;
    constructor(clientId: string="",shoppingListId: string=""){  
        this.inc = new Map();
        this.dec = new Map();
        this.id = shoppingListId;
        this.clientId = clientId;
        if(clientId){
            this.inc.set(this.clientId,new Map());
            this.dec.set(this.clientId,new Map());
        }
        else{
            //console.warn("No clientID provided");
        }
    }
    /**
     * Adds an item by certain quantity for the shopping list belonging to this clientID
     * @param item 
     * @param quantity 
     */
    add(item: string,quantity:number = 1){
        if(quantity<0){
            throw new Error("Quantity must be positive");
        }
        if(this.inc.get(this.clientId).has(item)){
            const currentQuantity = this.inc.get(this.clientId).get(item);
            this.inc.get(this.clientId).set(item,currentQuantity+quantity);
        }else{
            this.inc.get(this.clientId).set(item,quantity);
        }
    }
    /**
     * Removes an item by certain quantity for the shopping list belonging to this clientID
     * @param item 
     * @param quantity 
     */
    remove(item:string,quantity:number = 1){
        if(quantity<0){
            throw new Error("Quantity must be positive for client:" + this.clientId + "in cart: "+this.id);
        }
        
        if(this.dec.get(this.clientId).has(item)){
            if(this.calcTotal(item)-quantity<0){
                throw new Error("Can't remove more than what shopping list has for client:" + this.clientId + "in cart: "+this.id);
            }
            const currentQuantity = this.dec.get(this.clientId).get(item);
            this.dec.get(this.clientId).set(item,currentQuantity+quantity);
        }else{
            this.dec.get(this.clientId).set(item,quantity);
        }
    }
    /**
     *   Method to convert a map to an object
     */
    private mapToObject(map: Map<string, Map<string, number>>): object {
        const obj = {};
        map.forEach((value, key) => {
        obj[key] = Object.fromEntries(value);
        });
        return obj;
    }
    /**
     * Method to convert the inc and dec maps to JSON strings
     * @returns {string} JSON string of the inc and dec maps
     */
    toJSON(): string {
        const incObj = this.mapToObject(this.inc);
        const decObj = this.mapToObject(this.dec);
        return JSON.stringify({ inc: incObj, dec: decObj });
    }
    /**
     *  Method to convert an object to a map
     */ 
    private static objectToMap(obj: object): Map<string, Map<string, number>> {
        const map = new Map<string, Map<string, number>>();
        Object.entries(obj).forEach(([key, value]) => {
        map.set(key, new Map(Object.entries(value as object)));
        });
        return map;
    }
     /**
      *  Method to create an instance from a JSON string
      * @param {string} json JSON string to create an instance from
      * @returns {PNShoppingMap} new instance created from the JSON string
      */
    static fromJSON(json: string,clientID:string="",listID:string=""): PNShoppingMap {
        const obj = JSON.parse(json);
        const instance = new PNShoppingMap(clientID,listID);
        instance.setInc(PNShoppingMap.objectToMap(obj.inc));
        instance.setDec(PNShoppingMap.objectToMap(obj.dec));
        return instance;
    }
    /**
     * Calculates the total amount of an item in the shopping list for the client of this PNShoppingMap
     * @param item 
     * @returns {number} total amount of the item in the shopping list belonging to the client of this PNShoppingMap
     */
    private calcTotal(item:string){
        let itemInc = 0;
        let itemDec = 0;
        //sum the incs of each client
        for (let shoppingList of this.inc.values()){
            if(shoppingList.has(item)){
                itemInc += shoppingList.get(item)
            }
        }
        console.log(this.dec.values())
        //sum the decs of each client
        for (let shoppingList2 of this.dec.values()){
            if(!shoppingList2.has(item)){
                continue
            }
            itemDec += shoppingList2.get(item);
        }
        return itemInc-itemDec;
    }
    /**
     * Merge function to join the shopping lists of this client and other;
     * @param {PNShoppingMap} other shopping list
     */
    join(other: PNShoppingMap){
        other.inc.forEach((shoppingListOther,clientId)=>{
            // If the shopping list from other client isnt present in this pn counter, just add the counter of the other client;
            if(!this.inc.has(clientId)){
                this.inc.set(clientId,shoppingListOther);
            }
            else{
                // If the shopping list from other client is present in this pn counter, choose the max of the 2 counters for each item
                const shoppingListThis = this.inc.get(clientId);
                this.max(shoppingListThis,shoppingListOther);
            }
        });

        other.dec.forEach((shoppingListOther,clientId)=>{
            // If the shopping list from other client isnt present in this pn counter, just add the counter of the other client;
            if(!this.dec.has(clientId)){
                this.dec.set(clientId,shoppingListOther);
            }
            else{
                // If the shopping list from other client is present in this pn counter, choose the max of the 2 counters for each item
                const shoppingListThis = this.dec.get(clientId);
                this.max(shoppingListThis,shoppingListOther);
            }
        });
    }

    /**
     * Custom max function to calculate the max pn counters for each item present in the list for 2 lists of the same cient
     * If the item is present in this clients counter array, stays the max, otherwise add the item from the other client for the same shopping list.
     * @param thisList 
     * @param other 
     */
    private max(thisList:Map<string,number>,other:Map<string,number>){
        // for each of the items in the other list, check if this itemlist has it, if yes chooses the max pn counter, else add the new item from the other list.
       if(other){
            other.forEach((quantity,item)=>{
                if(thisList.has(item)){
                    const thisQuantity = thisList.get(item);
                    const max = Math.max(quantity,thisQuantity);
                    thisList.set(item,max);
                }
                else{
                    thisList.set(item,quantity);
                }
            });
       }
       else{
            //Means we have the list with info and the other doesnt have any info, so nothing new to add
            console.log("other is null, nothing to be done")
       }
      
    }

    read(item:string){
       return this.calcTotal(item) ?? 0;
    }
    getClientId(){
        return this.clientId;
    }
    getId(){
        return this.id;
    }
    setClientId(clientId:string){
        this.clientId = clientId;
    }
    setID(id:string){
        this.id = id;
    }
    setInc(inc:Map<string,Map<string,number>>){
        this.inc = inc;
    }
    setDec(dec:Map<string,Map<string,number>>){
        this.dec = dec;
    }
}
export { PNShoppingMap };