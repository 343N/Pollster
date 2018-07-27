//modifies prototypes
require('./prototypes.js');


const ESSENTIALS = require('./ESSENTIALS.js')
const CLIENTS = []
const POLLS = [];
const PRESENCEINTERVAL = 30
const Poll = require('./poll.js')
const WebClient = require('./client.js')
const Discord = require('discord.js');
const DBL = require('dblapi.js');
const fs = require('fs')
const path = require('path')
const identifier = ESSENTIALS.prefix
var io = require('socket.io')(ESSENTIALS.port);
var TERMINATING = false;
var SERVERCOUNT = 0;
var UPDATECOUNT = 0;
var DISCONNECTED = true;
var dbl;


const client = new Discord.Client({
    autoreconnect: true
});

if (ESSENTIALS.dblkey)
    dbl = new DBL(ESSENTIALS.dblkey)


setInterval(() =>{
if (dbl)
    dbl.postStats(client.guilds.size).then(() =>{
        console.log("Updated DBL stats")
    }).catch(console.error)
}, 60 * 1000 * 60)






client.on('message', (message) => {
    if (TERMINATING) return;
    if (message.author.id == client.user.id) return;
    if (message.isMentioned(client.user))
        message.channel.send('', { embed: Poll.generateErrorEmbed('Pollster Guide', false) }).then().catch()
    // print(message.content)

    if (message.author.id == "132300806442582017" ) {
        if (message.guild.id == '345776249815171103') {
            if (message.content == identifier + "stoppollster") {
                message.channel.send('TERMINATING')
                endBot()
            }
        }
    }
    // console.log()
    if (message.content.startsWith(identifier)) {
        let splitMsg = message.content.split(' ')
        let cmd = splitMsg[0]
        // print("SplitMSG length: " + splitMsg.length)
        if (cmd === identifier + 'poll') {
            // message.channel.startTyping()
            let query = message.content.split('|')
            let question = query[0].substring(cmd.length + 1).trim()
            if (query.length <= 1 || question.length == 0 || splitMsg.length <= 1) {
                message.channel.send('', { embed: Poll.generateErrorEmbed('Incorrect Parameters', true) }).then().catch(console.error)
                return;
            }
            query.splice(0, 1)
            POLLS[POLLS.length] = new Poll.new(message.author, message.channel, question, query)
            
        }

        if (cmd === identifier + 'phelp') {
            message.channel.send('', { embed: Poll.generateErrorEmbed('Pollster Guide', false)})
        }
        // message.channel.stopTyping()
    }
});

setInterval(() => {
    updatePresence()
    // let counter = 1;
    POLLS.filterMe((e) =>{
        let hrs = Date.now() / 1000 / 60 / 60
        let pollHrs = e.getTimestamp() / 1000 / 60 / 60
        if (Poll.MAXLIFETIMEHRS < hrs - pollHrs || e.isActive()) {
            console.log('Removed poll: ' + e.getQuestion())
            removeAllPollWebClients(e.getTimestamp())
            e.endPoll()
            return true;
        }

        return false;
    })
}, PRESENCEINTERVAL * 1000);



function updatePolls(){
    if (DISCONNECTED) return;
    if (UPDATECOUNT % 100 == 0) 
        print("Updating polls every " + (Math.max(4, POLLS.length) * 0.5) + " seconds.")

    for (var poll of POLLS){
        if (poll.isUpdating())
        poll.updateMessage()
    }
    UPDATECOUNT++;
    setTimeout(updatePolls, Math.max(4, POLLS.length) * 0.5 * 1000)
}

client.on('messageReactionRemove', (mr, user) => {
    if (!mr.me) return;
    if (client.user.id === user.id) return;
    for (var poll of POLLS) {
        if (poll.message && poll.message.id == mr.message.id) {
            poll.removeReaction(mr.emoji.toString())
            for (var c of CLIENTS) {
                if (c.getPollId() == poll.getTimestamp())
                    io.to(c.getId()).emit('graphData', packageLivePollData(poll))
            }
        }
    }
});

client.on('messageReactionAdd', (mr, user) => {
    if (!mr.me) return;
    if (client.user.id === user.id) return;
    for (var poll of POLLS) {
        if (poll.message && poll.message.id == mr.message.id) {
            poll.addReaction(mr.emoji.toString())
            for (var c of CLIENTS) {
                if (c.getPollId() == poll.getTimestamp())
                    io.to(c.getId()).emit('graphData', packageLivePollData(poll))
            }
        }
    }
});

client.on('messageReactionRemoveAll', (message) => {
    for (var i = 0; i < POLLS.length; i++) {
        if (POLLS[i].message.id == message.id) {
            // console.log('Removed poll ' + (i + 1) + ': ' + POLLS[i].getQuestion() + 
            // " (all reactions removed)")
            POLLS[i].endPoll()
            removeAllPollWebClients(POLLS[i].timestamp)
    //         POLLS.splice(i, 1)
        }
    }
})

client.on('messageDelete', (message) => {
    for (var i = 0; i < POLLS.length; i++) {
        if (POLLS[i].message.id == message.id) {
            console.log('Removed poll: ' + (i + 1) + ': ' + POLLS[i].getQuestion() + 
            " (message deleted)")
            POLLS.splice(i, 1)
        }
    }
})

client.on('ready', () => {
    DISCONNECTED = false;
    print("Ready!")    
    updatePresence()
    updatePolls()
    // client.user.setAvatar('./avatar.png').then(console.log('Avatar uploaded!')).catch(console.error)
})

// client.on('reconnecting', () => {
//     DISCONNECTED = true;
// })

client.on('error', (e) => {
    console.log("WebSocket error.")
    DISCONNECTED = true;
});

client.login(ESSENTIALS.key).then().catch((err) => {
    console.log(err)
    console.log("client.login error")
})


io.sockets.on('connection', (socket) => {
    console.log('someone connected!')

    socket.on('requestData', (data) => {
        console.log(socket.handshake.address + ' has requested data for ' + data)
        let livepoll = getPackagedLivePollData(data)
        
        if (livepoll) {
            CLIENTS.push(new WebClient.new(socket.id, data))
            io.to(socket.id).emit('graphData', livepoll)
            console.log('clients: ' + CLIENTS.length + ' clients connected')
            console.log('added client ' + socket.handshake.address)
            console.log('sending live poll (' + livepoll.question + ') data to ' + socket.handshake.address)
            return;
        }

        let logPoll = getPackagedLogPollData(data)
        
        if (logPoll){
            io.to(socket.id).emit('graphData', logPoll)
            console.log('sending log poll (' + logPoll.question + ') data to ' + socket.handshake.address)
        } else
            console.log(socket.handshake.address + ', no poll data found')

        console.log('disconnecting ' + socket.handshake.address)
        
        socket.disconnect()

        
        
        
        
    });

    socket.on('disconnect', (data) => {
        for (var i = 0; i < CLIENTS.length; i++){
            if (CLIENTS[i].getId() == socket.id)
                CLIENTS.splice(i, 1)
            console.log('removed client ' + socket.handshake.address)
            console.log('clients: ' + CLIENTS.length + ' clients connected')
        }
    })

});

function endBot() {
    TERMINATING = true;
    var timeout = (POLLS.length == 0) ? 500 : PRESENCEINTERVAL * 1000 * 2
    console.log('BOT TERMINATING IN ' + (timeout / 1000) + ' SECONDS')
    for (var poll of POLLS) {
        poll.endPoll()
        removeAllPollWebClients(poll.timestamp)
    }
    POLLS.splice(0, POLLS.length);
    setTimeout(() => {
        client.destroy()
        console.log('BOT TERMINATED!')
        process.exit()
    }, timeout);
    
}

function removeAllPollWebClients(pollId){
    for (var i=0; i < CLIENTS.length; i++){
        if (CLIENTS[i].getPollId() == pollId){
            var socket = io.sockets.connected[CLIENTS[i].getId()]
            if (socket) {
                socket.disconnect()
                console.log('disconnecting/removing ' + socket.handshake.address + ", live poll has ended")
            }
            CLIENTS.splice(i, 1);
            i--;
        }
    }
}

function updatePresence(){
    SERVERCOUNT = client.guilds.size
    if (DISCONNECTED) return;
    let votes = getTotalVoteCount()
    let active = getTotalActivePollCount()

    let activestr = (active == 1) ? active + ' poll (for ' : active +  ' polls (for '
    let votestr = (votes == 1) ? votes + ' vote) across ' : votes + ' votes) across '
    let serverstr = (SERVERCOUNT == 1) ? SERVERCOUNT + ' server.' : SERVERCOUNT + ' servers.'
    // console.log((new Date()).toLocaleDateString() + ' ' +(new Date()).toLocaleTimeString() + '\nServers: ' + SERVERCOUNT + ' - Polls: ' + active + ' - Votes: ' + votes)
    
    client.user.setPresence({ game: { name: identifier +'phelp. Monitoring ' + activestr + votestr + serverstr, type: 2 } }).then().catch(console.error)
}

function getTotalVoteCount(){
    var count = 0;
    for (var poll of POLLS){
        if (poll.isActive())
            count += poll.getTotalVotes()
    }
    return count;
}

function getTotalActivePollCount(){
    var count = 0;
    for (var poll of POLLS){
        if (poll.isActive()) count += 1;
    }
    return count;
}

function print(s) {
    console.log(s)
}


function findLogPoll(id){
    var accessible = true;

    try {
        fs.accessSync(path.join(__dirname, 'log', (id + '_bot.txt')), fs.constants.F_OK | fs.constants.R_OK)
    } catch (err){
        accessible = false;
    }

    console.log('accessible? ' + accessible)
    return accessible;
}

function packageLogPollData(id){
    var log;
    log = fs.readFileSync(path.join(__dirname, 'log', (id + '_bot.txt')),
        {encoding: `utf8`}
    )
    if (!log) return null;
    console.log('unpackaged poll data: ' + log)
    var data = log.split('|')
    var parsed = {
        labels: [],
        counts: [],
        question: ""
    }

    parsed.question = data[0];

    for (var i = 1; i < data.length; i+=3){
        parsed.labels.push(data[i+1] + " - " + data[i])
        parsed.counts.push(data[i+2]);
    }

    return parsed;
}

function getPackagedLogPollData(id){
    if (!findLogPoll(id)) return null
    return packageLogPollData(id)
}

function packageLivePollData(poll){
    if (!poll) return null;

    var emojiIndex = poll.getEmojiIndex()
    var keys = Object.keys(emojiIndex)
    var data = {}
    
    data.labels = [];
    data.counts = [];
    data.question = poll.getQuestion();
    
    for (var key of keys){
        data.labels.push(emojiIndex[key].answer + ' - ' + key)
        data.counts.push(emojiIndex[key].count)
    }

    return data;
}

function findLivePoll(id){
    for (var poll of POLLS)
        if (id == poll.timestamp) return poll

    return null
}


function getPackagedLivePollData(id){
    return packageLivePollData(findLivePoll(id))
}