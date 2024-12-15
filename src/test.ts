import { PNShoppingMap } from "./crdt/PNShoppingMap.js";
import OptOrSet from "./crdt/OptOrSet.js";

/*let list1 = new PNShoppingMap("Client1","list1");
let list2 = new PNShoppingMap("Client2","list1");
list1.add("banana");
list2.add("apple");
list2.join(list1);
list1.remove("banana");
list2.remove("banana");
list1.join(list2);
list2.buy("apple");
console.log(list1.toJSON())

let test:any = PNShoppingMap.fromJSON(list1.toJSON())
console.log("ola");*/
let list1 = new PNShoppingMap("Client1","list1");
let list2 = new PNShoppingMap("Client2","list2");

list1.add("banana", 2);

let message = list1.toJSON(); //A push

list2.join(PNShoppingMap.fromJSON(message)); //B pull

list1.add("banana",1);
list2.removeProduct("banana");
message = list2.toJSON();// B push
list1.join(PNShoppingMap.fromJSON(message))//A pull
console.log("wowo");
/*
list2.add("banana");
list2.join(list1);
console.log(list2.toJSON());
console.log(list1.read("banana"));
console.log(list2.read("banana",true));
console.log(list2.read("banana"));
console.log(list1.read("banana",true));*/
/*
list1.join(list2);
list2.join(list1);
list2.join(list1);
list2.add("banana");
list1.join(list2);
//list2.join(list1);
console.log(list2.read("banana"));
console.log(list1.read("banana"));
console.log(list1.toString());*/


/*let client1  = new OptOrSet("client1");
let client2 = new OptOrSet("client2");

client1.add("banana");
client2.add("banana");
client1.merge(client2);
client2.merge(client1);

client1.remove("banana");
client2.merge(client1)*/

