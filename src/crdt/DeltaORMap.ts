import { DeltaContext } from "./DeltaContext";

class DeltaORMap {
  private delta:Map<string,DeltaContext>;
  private name:string;
  private products:Map<string,number>;
  constructor(name:string) {
    this.name = name;
    this.delta = new Map<string,DeltaContext>();
    this.products = new Map<string,number>();
  }
  //adds a new delta value to the context (delta positive);
  add(item:string, delta:number = 1){
    if(!this.delta.has(item)){
      this.delta.set(item,new DeltaContext(item));
    }
    this.delta.get(item).add(delta);
  }
  //removes an item and updates the delta context by adding a removal delta (delta negative);
  remove(item:string,delta:number = 1){
    if(!this.delta.has(item)){
      throw new Error("Item not found for removal");
    }
    this.delta.get(item).add(-delta);
  }
  join(other:DeltaORMap){
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
  }
  getDelta(){
    return this.delta;
  }
  getProducts(){
    return this.products;
  }
  getName(){
    return this.name;
  }
  
  
}
export { DeltaORMap };