import mqtt from 'mqtt'

export const client = mqtt.connect('mqtt://localhost:1883')

// Koneksi ke broker MQTT
client.on('connect', () => {
  console.log('Connected to MQTT Broker')
})
