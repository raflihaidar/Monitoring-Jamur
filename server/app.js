import express from 'express'
import process from 'process'
import dotenv from 'dotenv'
import mqtt from 'mqtt'
import cors from 'cors'
import http from "http";
import { options } from './src/config/mqtt.js'
import { saveData, getChartData } from './src/services/data.service.js' 
import dataRoutes from './src/routes/data.route.js'
import { Server } from "socket.io";

dotenv.config()

const app = express()
const port = process.env.APP_PORT || 3000
const server = http.createServer(app);

const topic_monitor = "jamur_kuping/monitoring";
const topic_pump = "jamur_kuping/control/pump";
const topic_fan = "jamur_kuping/control/fan";
const topic_diffuser = "jamur_kuping/control/humidifier";

let temperature = 0
let humidity = 0
let soil = 0

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("client connected");
});

const mqttClient = mqtt.connect(options)

app.use(cors({
  origin : "*"
}))
app.use(express.json())
app.use('/api/data', dataRoutes)

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker')
  mqttClient.subscribe(topic_monitor, (err) => {
    if (!err) {
      console.log(`Subscribed to ${topic_monitor}`)
    }
  })

  mqttClient.subscribe(topic_pump, (err) => {
    if (!err) {
      console.log(`Subscribed to ${topic_pump}`)
    }
  })

  mqttClient.subscribe(topic_fan, (err) => {
    if (!err) {
      console.log(`Subscribed to ${topic_fan}`)
    }
  })

  mqttClient.subscribe(topic_diffuser, (err) => {
    if (!err) {
      console.log(`Subscribed to ${topic_diffuser}`)
    }
  })
})

// Menerima pesan dari MQTT dan memverifikasi sebelum dikirim ke WebSocket
mqttClient.on('message', async (topic, message) => {
  if (topic === topic_monitor) {
    try {
      // Parsing pesan MQTT menjadi JSON
      const data = JSON.parse(message.toString())

      temperature = data.temperature
      soil = data.soil
      humidity = data.humidity

      const payload = {
        temperature,
        soil,
        humidity
      }

      await saveData(payload)
      io.emit("monitoring", payload);

      const chartData = await getChartData();
      io.emit("chart_update", chartData);
    } catch (error) {
      console.error('Failed to parse JSON message:', error)
    }
  }

  if (topic === topic_pump || topic === topic_fan || topic === topic_diffuser) {
    try {
      console.log(message.toString())
    } catch (err) {
      console.log(err)
    }
  }
})

// Express route to publish MQTT messages
app.get('/publish/:message', (req, res) => {
  const { message } = req.params
  mqttClient.publish('esp32/sensor/ph', message)
  res.send(`Message "${message}" published to esp32/sensor/ph`)
})

// Route to fetch pH data
app.get('/api/ph', (req, res) => {
  res.json({
    data: {
      ph: phValue,
    },
    statusCode: 200,
    message: 'Get Data Successfully',
  })
})

// Route to control relay
app.post('/api/relay', (req, res) => {
  const { state } = req.body

  if (state === 'ON' || state === 'OFF') {
    mqttClient.publish('esp32/actuator/pump', state)
    res.json({
      statusCode: 200,
      message: `Relay turned ${state}`,
    })
  } else {
    res.status(400).json({
      statusCode: 400,
      message: 'Invalid relay state. Use "ON" or "OFF".',
    })
  }
})

// Express route to publish MQTT messages for PH sensor
// app.post('/publish/ph', (req, res) => {
//   const { ph } = req.body
//   if (ph !== undefined) {
//     mqttClient.publish('esp32/sensor/ph', JSON.stringify({ ph }))
//     res.json({
//       statusCode: 200,
//       message: `Message with pH value "${ph}" published to esp32/sensor/ph`,
//     })
//   } else {
//     res.status(400).json({
//       statusCode: 400,
//       message: 'pH value is required.',
//     })
//   }
// })

server.listen(port, () => {
  console.log(`Aeroponic app listening on port ${port}`)
})
