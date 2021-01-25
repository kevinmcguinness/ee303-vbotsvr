

var app = new Vue({ 
    el: '#app',
    data() {
        return  {
            idField: '001',
            id: '',
            message: 'Hello Vue!',
            state: {},
            analogPin: null,
            analogValue: null,
            digitalPin: null,
            digitalValue: null,
            errorText: ''
        }
    },
    methods: {
        update() {
            var {x, y, orientation} = this.state

            // get the car
            const svg = d3.select('#track-svg')
            const car = svg.select('#car2')
            
            // calc loc of center of car
            const w = parseFloat(svg.attr('width').replace('mm', ''))
            const h = parseFloat(svg.attr('height').replace('mm', ''))
            x = (x / 902) * w
            y = (y / 524) * h

            // get orientation in degrees
            const degrees = orientation * (180 / Math.PI)
            
            // find bounding box of car
            const carBox = car.node().getBBox()

            // find top left loc of car
            const carX = x - carBox.width / 2 - carBox.x
            const carY = y - carBox.height / 2 - carBox.y

            // apply rotation and translation
            car.attr('transform', `
                rotate(${degrees} ${x} ${y}) 
                translate(${carX}, ${carY}) `) // 
            
        },

        setRobotId() {

            // leave old room
            if (this.id) this.socket.emit('leave', this.id)

            // update id
            this.id = this.idField

            // join new room
            this.socket.emit('join', this.id)

            // pull state
            axios.get('/api/state', {params: {id: this.id}}).then((response) => {
                this.errorText = ''
                this.state = response.data
                this.update()
            }).catch(this.createErrorHandler("Error retrieving robot state"))
        },

        clearError() {
            this.errorText = ''
        },

        createErrorHandler(message) {
            const self = this
            return function(error) {
                var text = message
                if (error.response && error.response.data) {
                    text += ': ' + error.response.data
                } else {
                    console.log(error)
                }
                self.errorText = text
            }
        },

        start() {
            axios.post('/api/start', {id: this.id})
                .then(this.clearError)
                .catch(this.createErrorHandler("Error starting robot"))
        },

        stop() {
            axios.post('/api/stop', {id: this.id})
                .then(this.clearError)
                .catch(this.createErrorHandler("Error stopping robot"))
        },

        analogRead() {
            axios.get('/api/analogRead', {
                params: {
                    id: this.id, pin: this.analogPin
                }
            }).then((response) => {
                this.analogValue = response.data.value
                this.errorText = ''
            }).catch(this.createErrorHandler("Analog read error"))
        },

        analogWrite() {
            axios.post('/api/analogWrite', {id: this.id, pin: this.analogPin, value: this.analogValue})
                .then(this.clearError)
                .catch(this.createErrorHandler("Analog write error"))
        },

        digitalRead() {
            axios.get('/api/digitalRead', {
                params: {
                    id: this.id, pin: this.digitalPin
                }
            }).then((response) => {
                this.digitalValue = response.data.value
                this.errorText = ''
            }).catch(this.createErrorHandler("Digital read error"))
        },

        digitalWrite() {
            axios.post('/api/digitalWrite', {id: this.id, pin: this.digitalPin, value: this.digitalValue})
                .then(this.clearError)
                .catch(this.createErrorHandler("Digital write error"))
        }
    },

    created() {
        // connect to web socket
        this.socket = io.connect('/')

        if (this.id) {
            // join room for this team id
            this.socket.on('connect', () => this.socket.emit('join', this.id))
        } 

        // listen for location changed events
        this.socket.on('state-changed', msg => {
            if (msg.id == this.id) {
                this.state = msg.state
                this.update()
            }
        })

    },

    mounted() {
        
    }
});