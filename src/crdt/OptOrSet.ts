export default class OptOrSet{
    private vectorclock: Map<string,number>;
    private set: Set<[string,number,string]>;
    private clientId;
    private listId;

    constructor(clientId:string="",listId:string=""){
        this.vectorclock= new Map();
        this.set = new Set();
        this.clientId = clientId;
        this.listId = listId;
    }
    public get set_():Set<[string,number,string]>{
        return this.set;
    }
    public get vectorclock_():Map<string,number>{
        return this.vectorclock;
    }
    public set set_(otherSet:Set<[string,number,string]>){
        this.set = otherSet
    }
    public set vectorclock_(otherVectorclock:Map<string,number>){
        this.vectorclock = otherVectorclock;
    }

    public add(item:string){
        const myId=this.clientId;
        const tuple:[string,number,string] = [item,0,myId]
        if(!this.vectorclock.has(myId)){
            this.vectorclock.set(myId,0);
            this.set.add(tuple);
        }
        else{
            const currVer = this.vectorclock.get(myId);
            tuple[1] = currVer+1;
            this.vectorclock.set(myId,currVer+1);
            const obsoletes = this.getObsolete(tuple,this.set);
            obsoletes.forEach((obsoleteTuple)=>{
                this.set.delete(obsoleteTuple);
            })
            this.set.add(tuple);
        }
    }
    public remove(item:string){
        const removeSet:[string,number,string][] = [];
        this.set.forEach((setTuple)=>{
            if(setTuple[0] === item){
                removeSet.push(setTuple);
            }
        })
        removeSet.forEach((toRemove)=>{
            this.set.delete(toRemove)
        })
    }
    public contains(item:string){
        let res = false;
        this.set.forEach((elem)=>{
            const product = elem[0]
            if(item===product) res = true;
        });
        return res;
    }
    /**
     * Checks if two tuples of a set are equal
     * @param a 
     * @param b 
     * @returns {boolean} 
     */
    private equals(a:[string,number,string],b:[string,number,string]){
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    }
    /**
     * Checks if a vector clock point is in the other vector clock
     * @param elem key as clientId
     * @param vectorclock
     * @returns {boolean}
     */
    private inVectorClock(elem:string,vector:Map<string,number>){
        const client= elem[0];
        if(vector.get(client) !== undefined ) return true;
        return false;
    }
    /**
     * Checks if a tuple is in a set
     * @param elem 
     * @param set 
     * @returns {boolean}
     */
    private inSet(elem:[string,number,string],set:Set<[string,number,string]>){
        set.forEach((setElem)=>{
            if(this.equals(elem,setElem)){
                return true;
            }
        });
        return false;
    }
    private hasObsolete(elem:[string,number,string],set:Set<[string,number,string]>){
        set.forEach((setTuple)=>{
            const item = setTuple[0];
            const timestamp = setTuple[1];
            const client = setTuple[2];
            
            const elemItem = elem[0];
            const elemTimeStamp = elem[1];
            const elemClient = elem[2];

            if(item === elemItem && timestamp<elemTimeStamp && client === elemClient){
                return true;
            }
        })
        return false
    }
    private getObsolete(elem:[string,number,string],set:Set<[string,number,string]>){
        const obsoletes:[string,number,string][]=[]
        set.forEach((setTuple)=>{
            const item = setTuple[0];
            const timestamp = setTuple[1];
            const client = setTuple[2];
            
            const elemItem = elem[0];
            const elemTimeStamp = elem[1];
            const elemClient = elem[2];
            if(item === elemItem && timestamp<elemTimeStamp && client === elemClient){
                obsoletes.push(setTuple)
            }
        });
        return obsoletes;
    }
    
    public merge(other:OptOrSet){
        const commonElems:Set<[string,number,string]> = new Set();
        let inThisnotInOther:Set<[string,number,string]> = new Set();
        let inOthernotInThis:Set<[string,number,string]> = new Set();
        this.set.forEach((thisSetTuple)=>{
            if(this.inSet(thisSetTuple,other.set_)){
                commonElems.add(thisSetTuple);
            }
        })
        this.set.forEach((thisSetTuple)=>{
            if(!this.inSet(thisSetTuple,commonElems)){
                inThisnotInOther.add(thisSetTuple);
            }
        })
        inThisnotInOther = new Set(Array.from(inThisnotInOther).filter((elem)=>{
            const timestamp = elem[1];
            const client = elem[2];
            const otherThisClientTimestamp = other.vectorclock_.get(client);
            if(otherThisClientTimestamp!==undefined){
                return timestamp>otherThisClientTimestamp;

            }
            return true;
        }))
        other.set_.forEach((otherSetTuple)=>{
            if(!this.inSet(otherSetTuple, commonElems)){
                inOthernotInThis.add(otherSetTuple);
            }
        });

        inOthernotInThis = new Set(Array.from(inOthernotInThis).filter((elem)=>{
            const timestamp = elem[1];
            const client = elem[2];
            const thisClientTimeStamp = this.vectorclock.get(client);
            if(thisClientTimeStamp!==undefined){
                return timestamp>thisClientTimeStamp;

            }
            return true;
        }))

        let unionAll:Set<[string,number,string]> = new Set([...inThisnotInOther,...inOthernotInThis,...commonElems]);
        let noObsoleteSet:Set<[string,number,string]> = new Set(Array.from(unionAll).filter((elem)=>{
            return !this.hasObsolete(elem,unionAll)
        }));

        this.set = noObsoleteSet;
        this.vectorMax(this.vectorclock,other.vectorclock_);
    }   
    private vectorMax(vectorclockA:Map<string,number>,vectorclockB:Map<string,number>){
        vectorclockB.forEach((otherVersion,otherClient)=>{
            if(vectorclockA.get(otherClient)!==undefined){
                let thisVersion = vectorclockA.get(otherClient)
                const maxVer = Math.max(thisVersion,otherVersion)
                vectorclockA.set(otherClient,maxVer);
            }
            else{
                vectorclockA.set(otherClient,otherVersion);
            }
        });
    }
}
