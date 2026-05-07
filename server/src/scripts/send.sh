#!/bin/bash

# ============================================================
# Simulator Sensor Jamur Kuping
# ============================================================
# - Suhu normal : 22-25°C
# - Spike : 30-35°C
# - Window spike : 13:00 - 15:00
# - Maks spike : 2x per hari
# - Humidity : 80-90%
# - Soil : smooth/random realistis
#   perubahan antar data maksimal ±80
# ============================================================

BROKER_HOST="mqtt.binatra.id"
BROKER_PORT=1883

MQTT_USERNAME="admin"
MQTT_PASSWORD="admin123"

TOPIC_MONITOR="jamur_kuping/monitoring"
TOPIC_HEARTBEAT="jamur_kuping/heartbeat"

DEVICE_CODE="SIMULATOR_01"

INTERVAL=5
HEARTBEAT_INTERVAL=300

LAST_HEARTBEAT=$(date +%s)

# ============================================================
# Spike State
# ============================================================

SPIKE_COUNT=0
SPIKE_ACTIVE=0
SPIKE_STEP=0
LAST_DATE=""

# ============================================================
# Soil Smooth State
# ============================================================

LAST_SOIL=$((1800 + RANDOM % 801))

echo "========================================"
echo " Simulator Sensor Jamur Kuping"
echo "========================================"

while true; do

    NOW=$(date +%s)
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    TODAY=$(date +"%Y-%m-%d")

    # ========================================================
    # Reset harian
    # ========================================================

    if [ "$TODAY" != "$LAST_DATE" ]; then

        SPIKE_COUNT=0
        SPIKE_ACTIVE=0
        SPIKE_STEP=0

        LAST_DATE="$TODAY"

        echo "[INFO] Hari baru - spike reset"
    fi

    CURRENT_HOUR=$((10#$(date +"%H")))
    CURRENT_MIN=$((10#$(date +"%M")))

    CURRENT_TOTAL_MIN=$(( CURRENT_HOUR * 60 + CURRENT_MIN ))

    WINDOW_START=$((13 * 60))
    WINDOW_END=$((15 * 60))

    IN_WINDOW=0

    if [ "$CURRENT_TOTAL_MIN" -ge "$WINDOW_START" ] && [ "$CURRENT_TOTAL_MIN" -lt "$WINDOW_END" ]; then
        IN_WINDOW=1
    fi

    # ========================================================
    # Trigger spike
    # ========================================================

    if [ "$IN_WINDOW" -eq 1 ] && [ "$SPIKE_ACTIVE" -eq 0 ] && [ "$SPIKE_COUNT" -lt 2 ]; then

        ROLL=$(( RANDOM % 10 ))

        if [ "$ROLL" -lt 3 ]; then

            SPIKE_ACTIVE=1
            SPIKE_STEP=1
            SPIKE_COUNT=$(( SPIKE_COUNT + 1 ))

            echo "[INFO] >>> SPIKE #$SPIKE_COUNT DIMULAI <<<"
        fi
    fi

    # ========================================================
    # LOGIKA SUHU
    # ========================================================

    if [ "$SPIKE_ACTIVE" -eq 1 ]; then

        if [ "$SPIKE_STEP" -eq 1 ]; then

            TEMPERATURE=$((30 + RANDOM % 6))
            TEMP_PHASE="🔥 SPIKE"

        elif [ "$SPIKE_STEP" -eq 2 ]; then

            TEMPERATURE=$((27 + RANDOM % 3))
            TEMP_PHASE="📉 TURUN"

        else

            SPIKE_ACTIVE=0
            SPIKE_STEP=0

            TEMPERATURE=$((22 + RANDOM % 4))
            TEMP_PHASE="✅ NORMAL"
        fi

        SPIKE_STEP=$(( SPIKE_STEP + 1 ))

    else

        TEMPERATURE=$((22 + RANDOM % 4))
        TEMP_PHASE="✅ NORMAL"
    fi

    # ========================================================
    # HUMIDITY
    # ========================================================

    HUMIDITY=$((80 + RANDOM % 11))

    # ========================================================
    # SOIL SMOOTH
    # ========================================================

    DELTA=$(( RANDOM % 161 - 80 ))

    SOIL=$(( LAST_SOIL + DELTA ))

    if [ "$SOIL" -lt 1800 ]; then
        SOIL=1800
    fi

    if [ "$SOIL" -gt 2600 ]; then
        SOIL=2600
    fi

    LAST_SOIL=$SOIL

    # ========================================================
    # PAYLOAD
    # ========================================================

    PAYLOAD="{\"temperature\":$TEMPERATURE,\"humidity\":$HUMIDITY,\"soil\":$SOIL}"

    mosquitto_pub \
        -h "$BROKER_HOST" \
        -p "$BROKER_PORT" \
        -u "$MQTT_USERNAME" \
        -P "$MQTT_PASSWORD" \
        -t "$TOPIC_MONITOR" \
        -m "$PAYLOAD"

    echo "[$TIMESTAMP] $TEMP_PHASE"
    echo "TEMP : $TEMPERATURE°C"
    echo "HUM  : $HUMIDITY%"
    echo "SOIL : $SOIL"
    echo "--------------------------"

    # ========================================================
    # HEARTBEAT
    # ========================================================

    if [ $(( NOW - LAST_HEARTBEAT )) -ge $HEARTBEAT_INTERVAL ]; then

        PAYLOAD_HB="{\"deviceCode\":\"$DEVICE_CODE\"}"

        mosquitto_pub \
            -h "$BROKER_HOST" \
            -p "$BROKER_PORT" \
            -u "$MQTT_USERNAME" \
            -P "$MQTT_PASSWORD" \
            -t "$TOPIC_HEARTBEAT" \
            -m "$PAYLOAD_HB"

        LAST_HEARTBEAT=$NOW
    fi

    sleep $INTERVAL

done