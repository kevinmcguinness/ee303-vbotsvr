const mmap = require('mmap-io')
const fs = require('fs-extra')


async function openMmap(filename) {
    const fd = await fs.open(filename, "r+")
    const stat = await fs.fstat(fd)
    const prot = mmap.PROT_WRITE | mmap.PROT_READ
    return await mmap.map(stat.size, prot, mmap.MAP_SHARED, fd)
}

var pins = null
openMmap("bots/001/pins.dat").then((result) => {
    pins = result
})

function analogRead(pin) {
    return pins.readUInt32LE(4 * pin)
}

function digitalRead(pin) {
    return pins.readUInt32LE(4 * pin)
}

function analogWrite(pin, value) {
    if (value >= 0 && value < 1024) {
        pins.writeUInt32LE(value, 4 * pin)
    } else {
        throw `Invalid value: ${value}`
    }
}

function digitalWrite(pin, value) {
    if (value == 0 || value == 1) {
        pins.writeUInt32LE(value, 4 * pin)
    } else {
        throw `Invalid value: ${value}`
    }
}

function loop() {
    var rightSensor = analogRead(8)
    // ...

    // go forward
    digitalWrite(37, 1)
    analogWrite(38, 200)
    digitalWrite(39, 1)
    analogWrite(40, 200)
}

setInterval(loop, 50)