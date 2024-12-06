import { PNShoppingMap } from "./crdt/PNShoppingMap.js";

let list1 = new PNShoppingMap("Client1","list1");
let list2 = new PNShoppingMap("Client2","list1");
list1.add("banana");
list2.add("banana");
list2.add("apple");
list1.join(list2);
console.log(list1.setBought("banana"));

list2.add("banana");
list2.join(list1);
console.log(list2.toJSON());
console.log(list1.read("banana"));
console.log(list2.read("banana",true));
console.log(list2.read("banana"));
console.log(list1.read("banana",true));
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