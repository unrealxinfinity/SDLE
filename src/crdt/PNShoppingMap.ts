import OptOrSet from "./OptOrSet.js";
/**
 * PN counter tweaked to accept product key tracking using Optimized Observed Remove Set
 */
class PNShoppingMap{
    private inc: Map<string,Map<string,[number,number]>>
    private dec: Map<string,Map<string,[number,number]>>
    private id : string;
    private clientId : string;
    private printAnswers : boolean;
    private productKeySet:OptOrSet;
    
    constructor(clientId: string="",shoppingListId: string="", printAnswers : boolean= true){  
        this.printAnswers = printAnswers;
        this.inc = new Map();
        this.dec = new Map();
        this.id = shoppingListId;
        this.clientId = clientId;
        if(clientId){
            this.inc.set(this.clientId,new Map());
            this.dec.set(this.clientId,new Map());
            this.productKeySet = new OptOrSet(this.clientId,this.id);
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
        if(quantity<=0){
            console.log("Quantity must be positive");
            return;
        }
        if(this.inc.get(this.clientId).has(item)){
            const [notBought,bought] = this.inc.get(this.clientId).get(item);
            this.inc.get(this.clientId).set(item,[notBought+quantity,bought]);
            if(this.printAnswers)console.log("+" + quantity + " " + item + " was updated from the cart!");
        }else{
            this.productKeySet.add(item);
            this.inc.get(this.clientId).set(item,[quantity,0]);
            if(this.printAnswers)console.log(quantity + "x " + item + " was added to the cart!")
        }

    }
    /**
     * Removes an item by certain quantity for the shopping list belonging to this clientID, this is viewed the same as buying the item from the list.
     * @param item 
     * @param quantity 
     */
    remove(item:string,quantity:number = 1){
        if(quantity<=0){
            console.log("Quantity must be positive for client:" + this.clientId + "in cart: "+this.id);
            return;
        }
        
        if(this.dec.get(this.clientId).has(item)){
            const totalQuantity = this.calcTotal(item);
            if(totalQuantity-quantity<0){
                console.log("Can't remove more than what shopping list has for client:" + this.clientId + "in cart: "+this.id);
                return;
            }
            else if (totalQuantity-quantity===0){
                this.removeProduct(item);
                console.log("Deleted " + item + " from the cart!");
                return;
            }
            
            const [notBought,bought] = this.dec.get(this.clientId).get(item);
            this.dec.get(this.clientId).set(item,[notBought+Math.min(quantity, totalQuantity),bought]);
            if(this.printAnswers)console.log("-" + Math.min(quantity, totalQuantity) + " " + item + " was updated from the cart!");
        }else{
            const totalQuantity = this.calcTotal(item);
            if(quantity >= totalQuantity) this.removeProduct(item);
            else this.dec.get(this.clientId).set(item,[Math.min(quantity, totalQuantity),0]);
            if(this.printAnswers)console.log("-" + Math.min(quantity, totalQuantity) + " " + item + " was updated from the cart!");
        }
    }
    /**
     * Sets the number of bought items;
     */
    buy(item:string,quantity:number=1){
        let shoppingList = this.inc.get(this.clientId);
        if(shoppingList.has(item)){
            const [notBought,bought] = shoppingList.get(item);
            shoppingList.set(item,[notBought,bought+ quantity]);
            if(this.printAnswers)console.log("+" + quantity + " " + item + " was bought from the cart!");
        }
        else if(this.keySet.contains(item)){
            shoppingList.set(item,[0,quantity]);
            if(this.printAnswers)console.log("+" + quantity + " " + item + " was bought from the cart!");
        }
        else{
            if(this.printAnswers)console.log("Item not present in shopping list for buying for client:" + this.clientId + " in cart: "+this.id);
        }
        
    }
    /**
     * Refunds the number of items;
     */
    refund(item:string,quantity:number=1){
        let shoppingList = this.dec.get(this.clientId);
        let shoppingListInc = this.inc.get(this.clientId);
        if(shoppingListInc.has(item) && shoppingList.has(item)){
            const [notBoughtDec,refund] = shoppingList.get(item);
            const [notBoughtInc,bought] = shoppingListInc.get(item);
            if(refund > bought) throw new Error("Cant refund more than bought items!");
            shoppingList.set(item,[notBoughtDec,refund+ quantity]);
        }
        //there were no deletions of a product;
        else if (!shoppingList.has(item)){
            shoppingList.set(item,[0,quantity]);
        }
    }
    /**
     * Deletes the bought items from the shopping list
     * @param item 
     */
    /*cleanBought(item:string){
        for (let [key,shoppingList] of this.dec){
            let shoppingListInc = this.inc.get(key);
            let [_,boughtInc] = shoppingListInc.get(item);
            // If the item is not present in the inc map, then it was not bought
            if(!shoppingListInc.has(item)){
                throw new Error("Item not present and not bought in shopping list for client:" + this.clientId + "in cart: "+this.id);
            }
            // If the item is present in the dec map and has cleanBoughtDec, then the bought items were removed 
            else if (shoppingList.has(item)){
                const [notBoughtDec,cleanBoughtDec] = shoppingList.get(item);
                shoppingList.set(item,[notBoughtDec,cleanBoughtDec+boughtInc]);
            }
            // If the item isnt present in the dec map, means there werent any deletes from the list of not bought items and the bought items are to be deleted;
            else{
                shoppingList.set(item,[0,boughtInc]);
            }
        }
    }    */
    /**
     *   Method to convert a map to an object
     */
    private mapToObject(map: Map<string, Map<string, [number,number]>>): object {
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
        const vectorclock = Object.fromEntries(this.productKeySet.vectorclock_);
        return JSON.stringify({ inc: incObj, dec: decObj,vectorclock:vectorclock,productKeySet:Array.from(this.productKeySet.set_)});
    }
    /**
     *  Method to convert an object to a map
     */ 
    private static objectToMap(obj: object): Map<string, Map<string, [number,number]>> {
        const map = new Map<string, Map<string, [number,number]>>();
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
        const productKeySet = new OptOrSet(clientID,listID);
        productKeySet.set_= new Set([...(obj.productKeySet)]);
        productKeySet.vectorclock_ = new Map(Object.entries(obj.vectorclock))
        instance.keySet = productKeySet;
        return instance;
    }
    /**
     * Calculates the total amount of an item in the shopping list for the client of this PNShoppingMap
     * @param item 
     * @param readBought boolean to read the total amount of bought items or not
     * @returns {number} total amount of the item in the shopping list belonging to the client of this PNShoppingMap or total amount of item bought
     */
    calcTotal(item:string,readBought=false){
        let itemInc = 0;
        let itemIncBought = 0;
        let itemDec = 0;
        let itemDecBought = 0;
        //sum the incs of each client
        for (let shoppingList of this.inc.values()){
            if(shoppingList.size===0){
                continue;
            }
            if(shoppingList.has(item)){
                const [notBought,bought] = shoppingList.get(item);
                itemInc += notBought
                itemIncBought += bought;
            }
        }
        //sum the decs of each client
        for (let shoppingList2 of this.dec.values()){
            if(shoppingList2.size===0){
                continue;
            }
            if(!shoppingList2.has(item)){
                continue
            }
            const [notBought,bought] = shoppingList2.get(item);

            itemDec += notBought;
            itemDecBought += bought;
        }

        if(readBought){
            return (itemIncBought)-(itemDecBought);
        }
        else{
            return (itemInc)-(itemDec);
        }
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
        
        // Merge the existing products set for the keys
        this.keySet.merge(other.keySet)
        const toRemove:Set<string>=new Set();
        this.keySet.set_.forEach((productTuple)=>{
            const productName = productTuple[0];
            if(this.calcTotal(productName)<=0){
                if(!toRemove.has(productName)) toRemove.add(productName)
            }
        })
        // Remove the keys if there people bought too much of its kind
        toRemove.forEach((removeItem)=>{
            this.removeProduct(removeItem);
        });
    }

    /**
     * Custom max function to calculate the max pn counters for each item present in the list for 2 lists of the same cient
     * If the item is present in this clients counter array, stays the max, otherwise add the item from the other client for the same shopping list.
     * @param thisList 
     * @param other 
     */
    private max(thisList:Map<string,[number,number]>,other:Map<string,[number,number]>){
        // for each of the items in the other list, check if this itemlist has it, if yes chooses the max pn counter, else add the new item from the other list.
       if(other){
            other.forEach(([notBought,bought],item)=>{
                if(thisList.has(item)){
                    const [thisNotBought,thisBought] = thisList.get(item);
                    const maxNotBought = Math.max(notBought,thisNotBought);
                    const maxBought = Math.max(bought,thisBought);
                    thisList.set(item,[maxNotBought,maxBought]);
                }
                else{
                    thisList.set(item,[notBought,bought]);
                }
            });
       }
       else{
            //Means we have the list with info and the other doesnt have any info, so nothing new to add
            console.log("other is null, nothing to be done")
       }
      
    }

    read(item:string,readBought=false){
        if(this.productKeySet.contains(item)){
            return this.calcTotal(item,readBought) ?? 0;
        }
        else{
            console.log("Item doesn't exist in the list or previously deleted")
        }
    }
    /**
     * Removes a product from the counters and the key set (same as deleting a key in the list);
     * @param key 
     */
    removeProduct(key:string){
        this.productKeySet.remove(key);
        for (let shoppingList of this.inc.values()){
            if(shoppingList.get(key)!== undefined){
                shoppingList.delete(key);
            }
        }
        for (let shoppingList of this.dec.values()){
            if(shoppingList.get(key)!== undefined){
                shoppingList.delete(key);
            }
        }
    }
    getClientId(){
        return this.clientId;
    }
    getId(){
        return this.id;
    }
    getAllItems(){
        const allItems : Set<string> = new Set();
        for(const items of this.inc.values()){
            for(const [name, [quantity, boughtQuantity]] of items){
                allItems.add(name);
            }
        }
        return allItems;
    }
    setClientId(clientId:string){
        this.clientId = clientId;
    }
    setID(id:string){
        this.id = id;
    }
    setInc(inc:Map<string,Map<string,[number,number]>>){
        this.inc = inc;
    }
    addInc(clientID : string, item : string, quantity : number, quantityBought : number){
        if(!this.inc.has(clientID)){
            this.inc.set(clientID, new Map());
        }
        this.inc.get(clientID).set(item, [quantity, quantityBought]);
    }
    setDec(dec:Map<string,Map<string,[number,number]>>){
        this.dec = dec;
    }
    addDec(clientID : string, item : string, quantity : number, quantityBought : number){
        if(!this.dec.has(clientID)){
            this.dec.set(clientID, new Map());
        }
        this.dec.get(clientID).set(item, [quantity, quantityBought]);
    }
    public get keySet(){
        return this.productKeySet;
    }
    public set keySet(productKeySet:OptOrSet){
        this.productKeySet = productKeySet;
    }

}
export { PNShoppingMap };