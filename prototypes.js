
//  a function that works like .filter() but
//  modifies the existing array rather than returning
//  a new one

Array.prototype.filterMe = function(callback) {

    if (typeof callback != "function") 
        throw new Error(callback + ' is not a function') 

    for (let i = 0; i < this.length; i++){
        // based on array.filter()'s callback functions
        if (!callback(this[i], i, this)) {
            // console.log(`filterMe: removing ${this[i]} at index ${i} from ${this}`)
            this.splice(i, 1)   
            i--;
        }
    }
}