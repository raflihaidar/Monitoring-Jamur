#!/bin/bash
# ============================================================
# Simulator Sensor Jamur Kuping
# Logic:
#   - Jam 13:00 - 15:00 : Window waktu spike suhu
#   - Dalam window itu  : Suhu hanya naik 2 kali (30-35°C)
#   - Setelah 2x spike  : Suhu turun ke normal meski masih jam 13-15
#   - Tiap spike        : Naik beberapa pengiriman lalu turun
#   - Selain window     : Suhu normal 22-26°C
#   - Humidity          : random normal 80-90%
#   - Soil              : random normal 1800-2600
#   - Interval kirim    : setiap 5 detik
# ============================================================

BROKER_HOST="mqtt.binatra.id"
BROKER_PORT=1883
INTERVAL=5
HEARTBEAT_INTERVAL=300
MQTT_USERNAME="admin"
MQTT_PASSWORD="admin123"
TOPIC_MONITOR="jamur_kuping/monitoring"
TOPIC_HEARTBEAT="jamur_kuping/heartbeat"
DEVICE_CODE="SIMULATOR_01"
LAST_HEARTBEAT=$(date +%s)

# Counter spike — hanya boleh 2 kali per hari
SPIKE_COUNT=0         # sudah berapa kali spike terjadi
SPIKE_ACTIVE=0        # apakah sedang dalam kondisi spike
SPIKE_STEP=0          # langkah dalam satu siklus spike (naik → turun)
LAST_DATE=""          # untuk reset counter tiap hari baru

echo "========================================"
echo " Simulator Sensor Jamur Kuping"
echo " Broker  : $BROKER_HOST:$BROKER_PORT"
echo " Topik   : $TOPIC_MONITOR"
echo " Window  : Jam 13:00 - 15:00"
echo " Spike   : Maksimal 2x per hari (30-35°C)"
echo " Normal  : 22-26°C"
echo "========================================"
echo ""

while true; do
    NOW=$(date +%s)
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    TODAY=$(date +"%Y-%m-%d")

    # Reset counter spike setiap hari baru
    if [ "$TODAY" != "$LAST_DATE" ]; then
        SPIKE_COUNT=0
        SPIKE_ACTIVE=0
        SPIKE_STEP=0
        LAST_DATE="$TODAY"
        echo "[INFO] Hari baru - spike counter direset"
    fi

    CURRENT_HOUR=$((10#$(date +"%H")))
    CURRENT_MIN=$((10#$(date +"%M")))
    CURRENT_TOTAL_MIN=$(( CURRENT_HOUR * 60 + CURRENT_MIN ))

    WINDOW_START=$(( 15 * 60 ))   # 13:00
    WINDOW_END=$(( 16 * 60 ))     # 15:00
    IN_WINDOW=0
    if [ "$CURRENT_TOTAL_MIN" -ge "$WINDOW_START" ] && [ "$CURRENT_TOTAL_MIN" -lt "$WINDOW_END" ]; then
        IN_WINDOW=1
    fi

    # ===== Trigger spike baru jika dalam window & belum 2x =====
    # Spike baru dimulai secara acak ~30% peluang tiap pengiriman (jika tidak sedang spike)
    if [ "$IN_WINDOW" -eq 1 ] && [ "$SPIKE_ACTIVE" -eq 0 ] && [ "$SPIKE_COUNT" -lt 2 ]; then
        ROLL=$(( RANDOM % 10 ))
        if [ "$ROLL" -lt 3 ]; then   # ~30% chance tiap 5 detik untuk mulai spike
            SPIKE_ACTIVE=1
            SPIKE_STEP=1
            SPIKE_COUNT=$(( SPIKE_COUNT + 1 ))
            echo "[INFO] >>> SPIKE ke-$SPIKE_COUNT dimulai! <<<"
        fi
    fi

    # ===== Logika suhu =====
    if [ "$SPIKE_ACTIVE" -eq 1 ]; then
        if [ "$SPIKE_STEP" -eq 1 ]; then
            # Step 1: suhu naik 30-35°C (1 pengiriman saja)
            TEMPERATURE=$(( 30 + RANDOM % 6 ))
            TEMP_PHASE="🔥 SPIKE #$SPIKE_COUNT (naik)"
        elif [ "$SPIKE_STEP" -eq 2 ]; then
            # Step 2: suhu turun 27-29°C (1 pengiriman)
            TEMPERATURE=$(( 27 + RANDOM % 3 ))
            TEMP_PHASE="📉 TURUN #$SPIKE_COUNT"
        else
            # Step 3: selesai, kembali normal
            SPIKE_ACTIVE=0
            SPIKE_STEP=0
            TEMPERATURE=$(( 22 + RANDOM % 5 ))
            TEMP_PHASE="✅ NORMAL (setelah spike #$SPIKE_COUNT)"
        fi
        SPIKE_STEP=$(( SPIKE_STEP + 1 ))
    else
        TEMPERATURE=$(( 22 + RANDOM % 5 ))   # 22-26°C
        if [ "$IN_WINDOW" -eq 1 ] && [ "$SPIKE_COUNT" -lt 2 ]; then
            TEMP_PHASE="✅ NORMAL (menunggu spike, sudah $SPIKE_COUNT/2)"
        elif [ "$IN_WINDOW" -eq 1 ] && [ "$SPIKE_COUNT" -ge 2 ]; then
            TEMP_PHASE="✅ NORMAL (kuota spike habis)"
        else
            TEMP_PHASE="✅ NORMAL"
        fi
    fi

    HUMIDITY=$(( 80 + RANDOM % 11 ))
    SOIL=$(( 1800 + RANDOM % 801 ))

    PAYLOAD="{\"temperature\":$TEMPERATURE,\"humidity\":$HUMIDITY,\"soil\":$SOIL}"

    mosquitto_pub \
        -h "$BROKER_HOST" -p "$BROKER_PORT" \
        -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
        -t "$TOPIC_MONITOR" -m "$PAYLOAD"

    echo "[$TIMESTAMP] $TEMP_PHASE"
    echo "  Suhu     : ${TEMPERATURE}°C | Humidity: ${HUMIDITY}% | Soil: $SOIL"
    echo "  Payload  : $PAYLOAD"
    echo "----------------------------"

    # Heartbeat setiap 5 menit
    if [ $(( NOW - LAST_HEARTBEAT )) -ge $HEARTBEAT_INTERVAL ]; then
        PAYLOAD_HB="{\"deviceCode\":\"$DEVICE_CODE\"}"
        mosquitto_pub \
            -h "$BROKER_HOST" -p "$BROKER_PORT" \
            -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
            -t "$TOPIC_HEARTBEAT" -m "$PAYLOAD_HB"
        echo "[HEARTBEAT] $PAYLOAD_HB"
        echo "----------------------------"
        LAST_HEARTBEAT=$NOW
    fi

    sleep $INTERVAL
done