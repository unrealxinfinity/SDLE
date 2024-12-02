class PNShoppingMap{
    private inc: Map<string,Map<string,number>>
    private dec: Map<string,Map<string,number>>
    private id : string;
    private clientId : string;
    constructor(clientId: string,shippingListId: string=""){  
        this.inc = new Map();
        this.dec = new Map();
        this.id = shippingListId;
        this.clientId = clientId;
        this.inc.set(this.clientId,new Map());
        this.dec.set(this.clientId,new Map());
    }

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
    remove(item:string,quantity:number = 1){
        if(quantity<0){
            throw new Error("Quantity must be positive for client:" + this.clientId + "in cart: "+this.id);
        }
        if(this.dec.get(this.clientId).has(item)){
            const currentQuantity = this.dec.get(this.clientId).get(item);
            this.dec.get(this.clientId).set(item,currentQuantity+quantity);
        }else{
            this.dec.get(this.clientId).set(item,quantity);
        }
    }
    join(other: PNShoppingMap){
        other.inc.forEach((shoppingListOther,clientId)=>{
            // If the shopping list from other client isnt present in this pn counter, just add the counter of the other client;
            if(!this.inc.has(clientId)){
                this.inc.set(clientId,shoppingListOther);
            }
        });
        other.dec.forEach((shoppingListOther,clientId)=>{
            // If the shopping list from other client isnt present in this pn counter, just add the counter of the other client;
            if(!this.dec.has(clientId)){
                this.dec.set(clientId,shoppingListOther);
            }
        });
        let thisOtherIncList = this.inc.get(other.clientId);
        let otherIncList = other.inc.get(other.clientId);

        let thisIncList = this.inc.get(this.clientId);
        let otherThisIncList = other.inc.get(this.clientId);

        thisOtherIncList = this.sortMapByKey(thisOtherIncList);
        otherIncList = this.sortMapByKey(otherIncList);
        thisIncList = this.sortMapByKey(thisIncList);
        otherThisIncList = this.sortMapByKey(otherThisIncList);

        
        
        thisIncList.forEach((quantity,item)=>{
            //If this item set contains item that the other item set contains then take the max of the two quantities
            if(otherThisIncList.has(item)){
                const max = Math.max(quantity,otherThisIncList.get(item));
                thisIncList.set(item,max);
            }
            // else means we already have more information than the other client so we dont need to do anything
        })
        
       
    }
    mergeShoppingLists(thisList,other){
        thisList.forEach((quantity,item)=>{
            //If this item set contains item that the other item set contains then take the max of the two quantities
            if(other.has(item)){
                const max = Math.max(quantity,other.get(item));
                thisList.set(item,max);
            }
            // else means we already have more information than the other client so we dont need to do anything
        })
        
    }
    sortMapByKey(map: Map<string, number>): Map<string, number> {
        const sortedEntries = Array.from(map.entries()).sort(([keyA], [keyB]) => {
          if (keyA < keyB) return -1;
          if (keyA > keyB) return 1;
          return 0;
        });
        return new Map(sortedEntries);
    }
    getClientId(){
        return this.clientId;
    }
    getId(){
        return this.id;
    }
}