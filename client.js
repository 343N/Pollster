class Client {
    constructor(id, pollId){
        this.id = id,
        this.pollId = pollId
    }

    getId(){
        return this.id
    }

    getPollId(){
        return this.pollId
    }
}

exports.new = Client;