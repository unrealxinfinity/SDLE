export default class BoughtKey {
    private _product: string;
    private _bought: boolean;
  
    constructor(product: string, bought: boolean) {
      this._product = product;
      this._bought = bought;
    }
  
    get product(): string {
      return this._product;
    }
  
    set product(value: string) {
      this._product = value;
    }
  
    get bought(): boolean {
      return this._bought;
    }
  
    set bought(value: boolean) {
      this._bought = value;
    }
  
    equals(other: BoughtKey): boolean {
      return this._product === other.product && this._bought === other.bought;
    }
  
    hashCode(): number {
      let hash = 5381;
      for (let i = 0; i < this._product.length; i++) {
        hash = (hash * 33) ^ this._product.charCodeAt(i);
      }
      hash = hash ^ (this._bought ? 1 : 0);
      return hash >>> 0; // Ensure the hash is a positive integer
    }
  }
