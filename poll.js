const ESSENTIALS = require('./ESSENTIALS.js')
const EMOJISETS = require('./emojisets.js').emojiSets
const MAXANSWERS = ESSENTIALS.maxanswers;
const MAXLIFETIMEHRS = ESSENTIALS.maxlifetimehrs;
const MAXANSWERCHAR = ESSENTIALS.maxanswerchar;
const fs = require('fs')
const path = require('path')
class Poll {
    constructor(creator, channel, question, answers) {
        this.channel = channel
        this.answers = answers
        this.creator = creator
        this.totalVotes = 0;
        this.active = true;
        this.emojiIndex = {}
        this.timestamp = Date.now()
        this.updating = false;
        
        if (question.length > 256)
            question = question.substr(0, 256)
        
        this.question = question
        
            this.message;
        
        if (this.validateAnswers()) {
            this.assignEmoji()
            this.createMessage()
        } else {
            this.channel.send("", {embed: generateErrorEmbed('Incorrect Parameters', true)})
            this.active = false;
        }
    }

    isActive(){
        return this.active;
    }

    getQuestion(){
        return this.question;
    }

    getAnswers(){
        return this.answers;
    }

    getTimestamp(){
        return this.timestamp
    }

    getTotalVotes(){
        return this.totalVotes
    }
    getEmojiIndex(){
        return this.emojiIndex;
    }
    isUpdating(){
        return this.updating;
    }

    assignEmoji() {
        this.emojiSet = Math.floor(Math.random() * EMOJISETS.length)
        // Temporary array to manipulate such that 
        // we don't have answers with duplicate emoji.
        let temp = EMOJISETS[this.emojiSet]
        for (var ans of this.answers) {
            let eIndex = Math.floor(Math.random() * temp.length)
            let emoji = temp[eIndex]
            // console.log(ans)
            this.emojiIndex[emoji] = {
                answer: ans,
                count: 0
            }
            temp.splice(eIndex, 1)
        }

    }

    createMessage() {
        this.channel.send("", { embed: this.generateEmbed() }).then((m) => {
            this.message = m;
            let emojis = Object.keys(this.emojiIndex);
            for (var e of emojis){
                this.message.react(e).then().catch(console.error)
            }

        }).catch((e) => {
            this.active = false;
        })
    }

    updateMessage(){
        if (this.message){
            this.message.edit("", { embed: this.generateEmbed() }).then().catch((e) => {
                console.error(e)
                this.active = false;
                this.writeLog()
            })
            this.updating = false;
        }
    }

    generateEmbed(){
        var embed = {
            color: 3447003,
            author: {
                name: this.question,
                icon_url: "http://pollster.xyz/img/white_barchart.png"
            }
        }

        var desc = `Vote with the appropriate emoji!\n`

        for (var key in this.emojiIndex){
            if (this.emojiIndex.hasOwnProperty(key)){
                let count = this.emojiIndex[key].count
                let answer = this.emojiIndex[key].answer
                desc += `\n` + key + ': ' + answer + '\n' 
                + this.generatePercentageBar(count) + '\n' 
            }
        }

        if (!this.active) desc = desc.concat(`\n**This poll has ended!**\n`)

        desc += `\nTotal votes: ` + this.totalVotes + `\n`
        // desc = desc.concat('\n' + POLLURL + this.timestamp)
        var viewstr = (this.active) ? "View live online" : "View online"
        desc += '\n[' + viewstr +'](' + ESSENTIALS.url + this.timestamp + ")"

        embed.description = desc
        embed.footer = { text: this.timestamp + " | bot by 343N#7482"  }
        return embed;

    }

    generatePercentageBar(count){
        if (count <= 0)
            return "|░░░░░░░░░░| 0 votes (0%)"
        let bar = ""
        let percentage = Math.round((count / this.totalVotes) * 10)
        let votestr = (count == 1) ? "vote" : "votes"
        // console.log("percentage:",percentage)
        for (var i = 0; i < percentage; i++)
        bar = bar.concat("▓");
        for (var i = percentage; i < 10; i++)
        bar = bar.concat("░");
        return "|" + bar + "| " + count + " " + votestr + " (" + (Math.round((count / this.totalVotes) * 100)) + "%)"
    }

    validateAnswers(){
        let remove = []
        for (var i = 0; i < this.answers.length; i++){
            //trim all answers whitespace at beginning/end
            this.answers[i] = this.answers[i].trim()
            
            // test for empty entries
            if (this.answers[i].length == 0 || this.answers[i].length > MAXANSWERCHAR) {
                remove = remove.concat(i)
                continue;
            }
        }

        for (var i = 0; i < remove.length; i++)
            this.answers.splice(remove[i] - i, 1);

        if (this.answers.length > MAXANSWERS)
            this.answers.splice(MAXANSWERS, this.answers.length - MAXANSWERS)

        //return false if after truncation there is only one answer
        if (this.answers.length <= 1) return false;

        return true;
        
    }

    endPoll(){
        if (this.active){
            this.active = false;
            console.log('Ending poll: ' + this.question)
            //file system writing stuff
            this.writeLog()
            this.updateMessage()
        }
    }

    writeLog(){
        var txtStream = fs.createWriteStream(path.join(__dirname, 'log', (this.timestamp + '.txt')))
        txtStream.write(this.generateLog())
        txtStream.end()

        var botTxtStream = fs.createWriteStream(path.join(__dirname, 'log', (this.timestamp + '_bot.txt')))
        botTxtStream.write(this.generateBotLog())
        botTxtStream.end()

        // var jsonStream = fs.createWriteStream(path.join(__dirname, 'log', (this.timestamp + '.json')))
        // jsonStream.write(this.generateJSON())
        // jsonStream.end()

        
    }

    addReaction(emoji){
        if (!this.isActive()) return;
        this.totalVotes += 1
        this.emojiIndex[emoji].count += 1
        this.updating = true;
        // this.updateMessage()
    }

    removeReaction(emoji){
        if (!this.isActive()) return;
        this.totalVotes -= 1
        this.emojiIndex[emoji].count -= 1
        this.updating = true;
        // this.updateMessage()
    }

    generateLog(){
        var str;
        var curtime = new Date()
        var starttime = new Date(this.timestamp)

        if (this.message.guild.available)
            str = "Server: " + this.message.guild.name + " - " + this.message.guild.id + '\n'

        str = str.concat('Channel: ' + this.message.channel.name + ' - ' + this.message.channel.id + '\n')
        str = str.concat('Creator: ' + this.creator.username + ' - ' + this.creator.id + '\n')
        str = str.concat('\nTime created: ' + starttime.toLocaleDateString() + ', ' + starttime.toLocaleTimeString() + 
        '\nTime finished: ' + curtime.toLocaleDateString() + ', ' + curtime.toLocaleTimeString()) +'\n\n' + 'Poll: ' + this.question + '\n';
        let keys = Object.keys(this.emojiIndex);
        let count = 1;
        for (var key of keys){
            str = str.concat("Answer " + count + ": " + key + " - " + this.emojiIndex[key].answer + ' - ' + this.emojiIndex[key].count + ' votes (' + Math.round((this.emojiIndex[key].count/this.totalVotes) * 100) + '%)\n')
            count++
        }
        str = str.concat('\nTotal votes: ' + this.totalVotes);     
        return str;
    }

    generateBotLog(){
        var str = this.question;
        let keys = Object.keys(this.emojiIndex);
        for (var key of keys){
            str += "|" + key + "|" + this.emojiIndex[key].answer + "|" + this.emojiIndex[key].count
        }
        return str;
    }



}

function generateErrorEmbed(title, error) {
    let hrs = (MAXLIFETIMEHRS == 1) ? "hour" : "hours"
    let col = (error) ? 0xB00020 : 3447003
    return {
        color: col,
        author: {
            name: title,
            icon_url: "http://116.240.152.165/static/img/materialicons/white_barchart.png"
        },
        description: "To use this bot, you must type your query in the following format: \n-poll <question>|<answer1>|<answer2>... \nExample: `-poll Do you like cookies?|Yes|Nope` \n\nYou must have at least 2 answers, and you may only have up to " + MAXANSWERS + " answers per question.\nThe question may be no longer than 256 characters long, and answers may be no longer than 100 characters long each.\nPolls will only last " + MAXLIFETIMEHRS + " " + hrs + " before automatically closing."
    }
}


exports.new = Poll;
exports.MAXLIFETIMEHRS = MAXLIFETIMEHRS
exports.MAXANSWERS = MAXANSWERS
exports.generateErrorEmbed = generateErrorEmbed