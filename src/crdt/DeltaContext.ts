
//IDEA: each product keeps a vector of updating deltas for each instance for each add or remove operation.
// On merge,the same product of different shopping lists will check for each instance and sum their operations(deltas) so the quantity maintains correct in a final vector of instances,
// and if one vector(instances) have extra entries more than the other vector, the new values are added to the final vector of instances,
// at the end the sum of all deltas are calculated and kept in a final vector of instances with an only entry of delta, for both the same product from diff shopping lists. 
// This way one single instance is kept at the end of each merge for memory efficiency.
class DeltaContext{
    private id:string;
    private causalContext:number[];
    constructor(item:string){
        this.id = item;
        //initialize causal context with for the instance 0 (index 0);
        this.causalContext = [0];
    }
    //adds a new delta value to the context (delta can be negative or positive);
    add(delta:number){
        this.causalContext.push(delta);
    }
    merge(other:DeltaContext){
        const finalContext = [];
        // if the operations are the same, we don't need to join them for idempotence
        if (this.isSameOperation(other)) {
            return;
        } 
        // Checks for the smallest context to know when to add new elements from the bigger context;
        const minContext = this.causalContext.length < other.causalContext.length ? this.causalContext: other.causalContext;

        for (let i = 0; i < Math.max(this.causalContext.length, other.causalContext.length); i++) {
            // if the index is smaller than the smallest context, we merge sum from both contexts at instance i
            if(i<minContext.length){
                finalContext.push(this.causalContext[i]+other.causalContext[i]);
            }
            else{
                // if the index is bigger than the smallest context, we add the rest of the bigger context to the final context
                if(minContext === this.causalContext){
                    finalContext.push(this.causalContext[i]);
                }
                else{
                    finalContext.push(other.causalContext[i]);
                }
            }
        }
        const sum = finalContext.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        this.setCausalContext([sum]);
        other.setCausalContext([sum]);
    }
    //checks if the operations are the same for idempotence
    isSameOperation(other: DeltaContext): boolean {
        return (
          this.id === other.id &&
          this.causalContext.length === other.causalContext.length &&
          this.causalContext.every((value, index) => value === other.causalContext[index])
        );
      }
    //Sets the causal context for the product;
    setCausalContext(causalContext:number[]){
        this.causalContext = causalContext;
    }
    //returns the causal context for the product;
    getCausalContext(){
        return this.causalContext;
    }
    //returns the causal context for the instance 0, after merged!!;
    getDelta(){
        return this.causalContext[0];
    }
}
export {DeltaContext};