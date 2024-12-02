// No approach for idempotence was implemented in the DeltaORMap class.
class DeltaORMap {
  private delta:Map<string,number>;
  private id:string;
  private causalContext:Map<string,[number,Map<string,number>]>;
  private products:Map<string,number>;
  constructor(name:string) {
    this.id = name;
    this.delta = new Map<string,number>();
    this.products = new Map<string,number>();
    this.causalContext = new Map<string,[number,Map<string,number>]>;
    this.causalContext.set(this.id,[0,new Map<string,number>()]);
  }

  setID(id: string) {
    this.id = id;
  }

  static fromString(serialized: string) {
    const crdt = new DeltaORMap('');
    crdt.causalContext.clear();
    const json = JSON.parse(serialized);

    for (const key in json) {
      const innerMap: Map<string,number> = new Map();
      for (const innerkey in json[key][1]) {
        innerMap.set(innerkey, json[key][1][innerkey]);
      }
      crdt.causalContext.set(key, [json[key][0], innerMap]);
    }

    return crdt;
  }

  toString() {
    const serialized = {};

    for (const [key, value] of this.causalContext) {
      const inner = {};
      for (const [key1, value1] of value[1]) {
        inner[key1] = value1;
      }
      serialized[key] = [value[0], inner];
    }

    return JSON.stringify(serialized);
  }

  /**
   * adds a new delta value to the context (delta positive);
   * @param {string} item - the item to be added
   * @param {number} delta - the quantity of the item to be added
   */
  add(item:string, delta:number = 1){
    /*if(!this.delta.has(item)){
      this.delta.set(item,new DeltaContext(item,this.causalContext.get(this.id)));
    }
    this.delta.get(item).add(delta);*/

    if (!this.causalContext.has(this.id)) {
      this.causalContext.set(this.id,[0,new Map<string,number>()]);
    }

    if(!this.causalContext.get(this.id)[1].has(item)){
      this.causalContext.get(this.id)[1].set(item,delta);
    }
    else{
      this.causalContext.get(this.id)[1].set(item,this.causalContext.get(this.id)[1].get(item)+delta);
    }
  }
  /**
   * removes an item and updates the delta context by adding a removal delta (delta negative);
   * @param {string} item - the item to be removed
   * @param {number} delta - the quantity of the item to be removed
   * @throws {Error} - if the item is not found for removal
   * @throws {Error} - if the quantity of the item to be removed is greater than the quantity of the item
  */
  remove(item:string,delta:number = 1){
    /*if(!this.delta.has(item)){
      throw new Error("Item not found for removal");
    }
    this.delta.get(item).add(-delta);*/

    if (!this.causalContext.has(this.id)) {
      this.causalContext.set(this.id,[0,new Map<string,number>()]);
    }

    if(!this.causalContext.get(this.id)[1].has(item)){
      throw new Error("Item not found for removal");
    }
    else if( this.causalContext.get(this.id)[1].get(item)-delta < 0){
      throw new Error("Can't remove more items than exist");
    }
    else{
      this.causalContext.get(this.id)[1].set(item,this.delta.get(item)-delta);
    }
  }
  /**
   * Method to join two DeltaORMap instances
   * @param {DeltaORMap} other - the other DeltaORMap instance to be joined
   */

  join(other: DeltaORMap) {
    this.sortCausalContextByKey();
    other.sortCausalContextByKey();
    let thisEntries = Array.from(this.causalContext.entries());
    let otherEntries = Array.from(other.getCausal().entries());

    let thisIter = 0;
    let otherIter = 0;
    do{
      let [thisListID, thisContext] = thisEntries[thisIter] ?? [];
      let [otherListID, otherContext] = otherEntries[otherIter] ?? [];

      if (!(thisIter === thisEntries.length) && ( otherIter===otherEntries.length || thisListID < otherListID)) {
        if (other.contextInList(thisListID, this)) {
          this.deleteContext(thisListID);
        }
        thisIter++;
      } else if (!(otherIter===otherEntries.length) && (thisIter===thisEntries.length || otherListID < thisListID)) {
        if (!this.contextInList(otherListID, other)) {
          this.insertContext(otherListID, other.getCausal());
        }
        otherIter ++;
      } else if (!(thisIter===thisEntries.length) && !(otherIter===otherEntries.length)) {
        thisIter ++;
        otherIter ++;
      }
    } while (!(thisIter === thisEntries.length)|| !(otherIter===otherEntries.length));

    this.joinDelta(other);
  }
  private insertContext(listID:string,otherCausal:Map<string,[number,Map<string,number>]>){
    this.causalContext.set(listID,otherCausal.get(listID));
  }
  /**
   * Checks of context is in this context (comparing indexes the higher the more recent);
   * @param {string} listID - the list id to be checked
   * @param {DeltaORMap} other - the other DeltaORMap instance to be compared
   */ 
  private contextInList(listID:string,other:DeltaORMap){
    if(!this.causalContext.has(listID)){
      return false;
    }
    let [thisContext,deltaMap] = this.causalContext.get(listID);
    
    let [otherContext,otherDeltaMap] = other.getCausal().get(listID);
    return thisContext>=otherContext;
  }
  /**
   * Deletes the context associated with listID from this instance's causal context
   * @param {string} listID - the list id to be deleted
   */
  private deleteContext(listID:string){
    if(!this.causalContext.has(listID)){
      throw new Error("List not found for deletion");
    }
    else{
      this.causalContext.delete(listID);
    }
  }
  /**
   * Sorts the causal context by key
   */
  private sortCausalContextByKey() {
    const sortedEntries = Array.from(this.causalContext.entries()).sort(([keyA], [keyB]) => {
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });
    this.causalContext = new Map(sortedEntries);
  }
  /**
   * Aux func to join two DeltaORMap instances
   * @param other - the other DeltaORMap instance to be joined
   */
  private joinDelta (other:DeltaORMap){
    this.sortCausalContextByKey();
    other.sortCausalContextByKey();
    const otherCausal = other.getCausal();
    const thisEntries = Array.from(this.causalContext.entries());
    const otherEntries = Array.from(otherCausal.entries());

    let thisIter = 0
    let otherIter = 0

    let deltaToMerge = null;
   do{
      let [thisListID,thisDeltaContext] = thisEntries[thisIter]|| [];
      let [otherListID,otherDeltaContext] = otherEntries[otherIter]|| [];

      if(!(thisIter===thisEntries.length) && ((otherIter===otherEntries.length) || thisListID < otherListID)){
        thisIter++;
      }
      else if(!(otherIter===otherEntries.length) && ((thisIter===thisEntries.length) || otherListID < thisListID)){
        this.insertContext(otherListID,otherCausal);
        otherIter++;
      }
      else if (!(thisIter===thisEntries.length) && !(otherIter===otherEntries.length)){
        let [version,thisDelta] = thisDeltaContext;
        let [otherVersion,otherDelta] = otherDeltaContext;
      
        if(version>otherVersion){
          deltaToMerge = [version,thisDelta];
          this.changeDeltaMapAt(thisListID,deltaToMerge);
        }
        else{
          deltaToMerge = [otherVersion,otherDelta];
          this.changeDeltaMapAt(otherListID,deltaToMerge);
        }
        thisIter++;
        otherIter++;
      }
    }  while (!(thisIter===thisEntries.length) || !(otherIter===otherEntries.length));
      //this.products = this.mergeDeltaProductList(this.causalContext.get(this.id),this.causalContext.get(other.getName()));
  }
  /**
   * Changes the delta map at the listID with the new deltaMap and the version associated;
   * @param {string} listID - the list id to be changed
   * @param {[number,Map<string,number>]} deltaMap - the new delta map to be set
   */
  private changeDeltaMapAt(listID:string,deltaMap:[number,Map<string,number>]){
    let [otherVersion,otherDeltaMap] = deltaMap;
    this.causalContext.set(listID,[otherVersion,otherDeltaMap]);
  }
  
  private changeDeltaMapWithInc(listID:string,deltaMap:[number,Map<string,number>]){
    let [otherVersion,otherDeltaMap] = deltaMap;
    this.causalContext.set(listID,[otherVersion+1,otherDeltaMap]);
  }
  /**
   * Merges the delta product list of two contexts and returns the merged list;
   * @param {[number,Map<string,number>]} context - the first context to be merged
   * @param {[number,Map<string,number>]} context2 - the second context to be merged
   * @returns {Map<string,number>} - the merged product list
   * @throws {Error} - if the quantity of the item to be removed is greater than the quantity of the item
   */
  private mergeDeltaProductList(context:[number,Map<string,number>],context2:[number,Map<string,number>]){
  let productList = new Map<string,number>();
  let deltaMap = context[1];
  let stubDeltaMap = this.copyMap(deltaMap);
  let deltaMap2 = context2[1];
  for (let [product, value] of deltaMap2) {
    if(!stubDeltaMap.has(product)){
      stubDeltaMap.set(product,value);
    }
    else{
      stubDeltaMap.set(product,stubDeltaMap.get(product)+value);
    }
  }
  context[0]++;
  let entries = Array.from(stubDeltaMap.entries());
  for (let [product, value] of entries) {
      if(!productList.has(product)){
        if(value<0){
          throw new Error("Non existent products can't be removed");
        }
        else{
          productList.set(product,value);
        }
      }
      else{
        const productQuantity = this.products.get(product);
        if(productQuantity+value<0){
          throw new Error("Can't remove more items than exist");
        }
        productList.set(product,productQuantity+value);
      }
    }
    return productList;
  }   
  /**
   *  Copies a map
   * @param {Map<string,number>} originalMap 
   * @returns {Map<string,number>} - A new copied map
   */
  private copyMap(originalMap: Map<string, number>): Map<string, number> {
    return new Map(originalMap);
  }
  /**
   * Reads the quantity of a product
   * @param {string} product 
   * @returns {number} - the quantity of the product
   */
  read(product:string){
    return this.products.get(product);
  }

  readAll(){
    for(const [name, [causal_number, itemMap]] of this.causalContext.entries()){
      for(const [item_name, quantity] of itemMap.entries()){
        console.log(item_name + ": " + quantity + "(" + causal_number + ")")
      }
    }
  }
  /*
  joinDelta(other:DeltaORMap){
    // NEED TO IMPLEMENT IDEMPOTENCE CHECK
    const minDeltaMap = this.getDelta().size < other.getDelta().size ? this.getDelta() : other.getDelta();
    const maxDeltaMap = this.delta.size < other.delta.size ? other.delta : this.delta;
    
    for (let [product, value] of maxDeltaMap) {
      if(minDeltaMap.has(product)){
        minDeltaMap.get(product).merge(maxDeltaMap.get(product));
      }
      else{
        minDeltaMap.set(product,value);
      }
    }
    this.setProductsQuantity();
    other.setProductsQuantity();
  }
  setProductsQuantity(){
    //For each product of the delta map, update the product list; Including adding new entries;
    for (let [product,value] of this.getDelta()) {
      if(!this.products.has(product)){
        if(value.getDelta() < 0){
          throw new Error("Non existent products can't be removed");
        }
        else{
          this.products.set(product,value.getDelta());
        }
      }
      else{
        const productQuantity = this.products.get(product);
        this.products.set(product,productQuantity+value.getDelta());
      }
    }
  }*/
  /*
  isSame(other: DeltaORMap): boolean {
      let res = false;
      if (this.id === other.id && this.products.size === other.products.size && this.delta.size === other.delta.size) res = true;
      for (let [product, value] of this.getDelta()) {
        if (!value.isSameOperation(other.getDelta().get(product))) {
          res = false;
          break;
        }
      }
      return res;
  }*/

  getCausal(){
    return this.causalContext;
  }

  getDelta(){
    return this.delta;
  }
  getProducts(){
    return this.products;
  }
  getName(){
    return this.id;
  }
 
  
}
export { DeltaORMap };