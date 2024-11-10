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
  //adds a new delta value to the context (delta positive);
  add(item:string, delta:number = 1){
    /*if(!this.delta.has(item)){
      this.delta.set(item,new DeltaContext(item,this.causalContext.get(this.id)));
    }
    this.delta.get(item).add(delta);*/
    if(!this.causalContext.get(this.id)[1].has(item)){
      this.causalContext.get(this.id)[0] = 1;
      this.causalContext.get(this.id)[1].set(item,delta);
    }
    else{
      this.causalContext.get(this.id)[0]++;
      this.causalContext.get(this.id)[1].set(item,this.causalContext.get(this.id)[1].get(item)+delta);
    }
  }
  //removes an item and updates the delta context by adding a removal delta (delta negative);
  remove(item:string,delta:number = 1){
    /*if(!this.delta.has(item)){
      throw new Error("Item not found for removal");
    }
    this.delta.get(item).add(-delta);*/
    if(!this.causalContext.get(this.id)[1].has(item)){
      throw new Error("Item not found for removal");
    }
    else if( this.causalContext.get(this.id)[1].get(item)-delta < 0){
      throw new Error("Can't remove more items than exist");
    }
    else{
      this.causalContext.get(this.id)[0]++;
      this.causalContext.get(this.id)[1].set(item,this.delta.get(item)-delta);
    }
  }
  // Method to join two DeltaORMap instances
  join(other: DeltaORMap) {
    this.sortCausalContextByKey();
    other.sortCausalContextByKey();
    let thisEntries = Array.from(this.causalContext.entries());
    let otherEntries = Array.from(other.getCausal().entries());
    this

    let thisIter = 0;
    let otherIter = 0;
    do{
      let [thisListID, thisContext] = thisEntries[thisIter] || [];
      let [otherListID, otherContext] = otherEntries[otherIter] || [];

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
  insertContext(listID:string,otherCausal:Map<string,[number,Map<string,number>]>){
    this.causalContext.set(listID,otherCausal.get(listID));
  }
  // Checks of context is in this context (comparing indexes the higher the more recent);
  contextInList(listID:string,other:DeltaORMap){
    if(!this.causalContext.has(listID)){
      return false;
    }
    let [thisContext,deltaMap] = this.causalContext.get(listID);
    
    let [otherContext,otherDeltaMap] = other.getCausal().get(listID);
    return thisContext>=otherContext;
  }
  deleteContext(listID:string){
    if(!this.causalContext.has(listID)){
      throw new Error("List not found for deletion");
    }
    else{
      this.causalContext.delete(listID);
    }
  }
  sortCausalContextByKey() {
    const sortedEntries = Array.from(this.causalContext.entries()).sort(([keyA], [keyB]) => {
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });
    this.causalContext = new Map(sortedEntries);
  }
  joinDelta (other:DeltaORMap){
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
    
    this.mergeDeltaProductList(this.products,this.getCausal().get(this.getName())[1]);
    
  }
  
  changeDeltaMapAt(listID:string,deltaMap:[number,Map<string,number>]){
    let [otherVersion,otherDeltaMap] = deltaMap;
    this.causalContext.set(listID,[otherVersion,otherDeltaMap]);
  }
  changeDeltaMapWithInc(listID:string,deltaMap:[number,Map<string,number>]){
    let [otherVersion,otherDeltaMap] = deltaMap;
    this.causalContext.set(listID,[otherVersion+1,otherDeltaMap]);
  }
  mergeDeltaProductList(productList:Map<string,number>,deltaMap:Map<string,number>){
  let entries = Array.from(deltaMap.entries());
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
        productList.set(product,productQuantity+value);
      }
    }
  }   
  copyMap(originalMap: Map<string, number>): Map<string, number> {
    return new Map(originalMap);
  }
  read(product:string){
    const productViewer = this.copyMap(this.products);    
    const delta = this.getCausal().get(this.getName())[1];
    this.mergeDeltaProductList(productViewer,delta);
    return productViewer.get(product);
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