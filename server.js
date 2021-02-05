/**
 * EE303: Mobile Robotics. Simulation Server.
 * 
 * (c) Kevin McGuinness 2020 <kevin.mcguinness@dcu.ie>
 */
const express = require('express')
const bodyParser = require('body-parser')
const socketio = require('socket.io')
const http = require('http')
const cors = require('cors')
const mmap = require('mmap-io')
const fs = require('fs-extra')
const path = require('path')
const {spawn} = require('child_process');

// pull in .env if exists
require('dotenv').config()

// config
const port = process.env.EE303_VBOT_SERVER_PORT || 8082
const simulatorTimeout = process.env.EE303_VBOT_TIMEOUT || 20*60

// app
const app = express()
const server = http.createServer(app)
const io = socketio(server)

// plugins
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors())
app.use(express.static('public'))

// disable x-powered-by
app.disable("x-powered-by")


var bots = {}

async function openMmap(filename, mode) {
    const fd = await fs.open(filename, mode)
    const stat = await fs.fstat(fd)
    const priv = mmap.MAP_SHARED
    var prot = mmap.PROT_READ
    if (mode == "r+") {
        prot = prot | mmap.PROT_WRITE
    }
    const buffer = await mmap.map(stat.size, prot, priv, fd)
    return buffer
}

async function loadBots() {
    const result = {}
    const dir = await fs.promises.opendir("bots");
    for await (const dirent of dir) {
        var id = dirent.name

        // skip hidden files (.DS_store, etc.)
        if (id.startsWith(".")) {
            continue
        }

        var botpath = path.join(dir.path, id)
        var pins = path.join(botpath, 'pins.dat')
        var state = path.join(botpath, 'state.dat')
        pins = await openMmap(pins, "r+")
        state = await openMmap(state, "r")
        result[id] = {id, pins, state, path: botpath, oldState: {x:0, y:0, orientation: 0}}
    }
    return result
}

loadBots().then((res) => {
    bots = res
    console.log('loaded bots:', Object.keys(bots))
})

function parsePin(pin) {
    pin = parseInt(pin, 10)
    if (isNaN(pin)) {
        return -1
    }
    if (pin < 0 || pin > 40) {
        return -1
    }
    return pin
}

function parseAnalogValue(value) {
    value = parseInt(value, 10)
    if (isNaN(value)) {
        return value
    }
    if (value < -1024 || value > 1024) {
        return NaN
    }
    return value
}

function parseDigitalValue(value) {
    value = parseInt(value, 10)
    if (isNaN(value)) {
        return value
    }
    return value ? 1 : 0
}

function getState(bot) {
    const state = bot.state
    const x = Math.round(state.readDoubleLE(0))
    const y = Math.round(state.readDoubleLE(8))
    const orientation = Math.round(state.readDoubleLE(16) * 100) / 100
    return {x, y, orientation}
}


app.post('/api/start', (req, res) => {
    var id = req.body.id

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    const bot = bots[id]

    var pidFile = path.join(bot.path, "pid")
    if (fs.existsSync(pidFile)) {
        return res.status(400).send(`bot ${id} already running`)
    }


    const process = spawn("python", 
        ["simulate.py", "--timeout", simulatorTimeout, '--bot-id', id], 
        {stdio: "inherit"})
    bot.process = process

    process.on('exit', function(code) {
        console.log(`bot ${bot.id} terminated with code ${code}`)
        delete bot.process
    })

    console.log(`starting bot ${id} pid: ${bot.process.pid} timeout: ${simulatorTimeout}`)
    res.sendStatus(200)
})

app.post('/api/stop', (req, res) => {
    var id = req.body.id

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    const bot = bots[id]

    var pidFile = path.join(bot.path, "pid")
    if (fs.existsSync(pidFile)) {
        console.log(`stopping bot ${id}`)
        fs.unlink(pidFile)
    }  

    res.sendStatus(200)
})

app.post('/api/pause', (req, res) => {
    var id = req.body.id

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    const bot = bots[id]
    bot.pins.writeInt32LE(1, 4 * 5)

    res.sendStatus(200)
})

app.post('/api/resume', (req, res) => {
    var id = req.body.id

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    const bot = bots[id]
    bot.pins.writeInt32LE(0, 4 * 5)

    res.sendStatus(200)
})

app.get('/api/state', (req, res) => {
    var id = req.query.id

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    const bot = bots[id]
    res.status(200).json(getState(bots[id]))
})

app.get('/api/digitalRead', (req, res) => {
    var {id, pin} = req.query
    
    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    if ((pin = parsePin(pin)) < 0) {
        return res.status(400).send('invalid pin')
    }

    const bot = bots[id]
    const value = bot.pins.readInt32LE(4 * pin)
    
    //console.log("digitalRead", id, pin, value)
    res.status(200).send(value.toString())
})

app.get('/api/analogRead', (req, res) => {
    var {id, pin} = req.query

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    if ((pin = parsePin(pin)) < 0) {
        return res.status(400).send('invalid pin')
    }

    const bot = bots[id]
    const value = bot.pins.readInt32LE(4 * pin)

    //console.log("analogRead", id, pin, value)
    res.status(200).send(value.toString())
})

app.post('/api/digitalWrite', (req, res) => {
    var {id, pin, value} = req.body

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    if ((pin = parsePin(pin)) < 0) {
        return res.status(400).send('invalid pin')
    }

    value = parseDigitalValue(value)
    if (isNaN(value)) {
        return res.status(400).send('invalid value for digital write')
    }

    const bot = bots[id]
    bot.pins.writeInt32LE(value, 4 * pin)

    //console.log("digitalWrite", id, pin, value)
    res.sendStatus(200)
})

app.post('/api/analogWrite', (req, res) => {
    var {id, pin, value} = req.body

    if (!(id in bots)) {
        return res.status(400).send(`no robot with id ${id}`)
    }

    if ((pin = parsePin(pin)) < 0) {
        return res.status(400).send('invalid pin')
    }

    value = parseAnalogValue(value)
    if (isNaN(value)) {
        return res.status(400).send('invalid value for analog write')
    }

    const bot = bots[id]
    bot.pins.writeInt32LE(value, 4 * pin)

    //console.log("analogWrite", id, pin, value)
    res.sendStatus(200)
})

function stateChanged(id, state) {
    io.to(id).emit('state-changed', {id, state})
}

// websockets for UI
io.on('connection', socket => {

    // join and leave rooms
    socket.on('join', id => socket.join(id))
    socket.on('leave', id => socket.leave(id))
})


// fire her up
server.listen(port, () => {
    console.log(`EE303 simulation server running on http://localhost:${port}`)

    setInterval(function() {
        for (var key in bots) {
            var bot = bots[key]
            var state = getState(bot)
            if (bot.oldState.x != state.x ||
                bot.oldState.y != state.y ||
                bot.oldState.orientation != state.orientation
            ) {
                bot.oldState = state
                //console.log(state)
                stateChanged(key, state)
            }
        }
    }, 100)
})