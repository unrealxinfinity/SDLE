import { DeltaORMap } from "./crdt/DeltaORMap.js";

let list1 = new DeltaORMap("list1");
let list2 = new DeltaORMap("list2");

list1.add("banana");
list2.join(list1);
console.log(list2.read("banana"));
console.log(list1.read("banana"));
