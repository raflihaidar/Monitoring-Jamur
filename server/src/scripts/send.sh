#!/bin/bash

# ============================================================
# Simulator Sensor Jamur Kuping
# ============================================================
# - Suhu normal      : 22-25°C
# - Spike            : 30-35°C (humidity turun ke 60-79%)
# - Window spike     : 13:00 - 15:00 WIB
# - Maks spike       : 2x per hari
# - Humidity normal  : 80-84%
# - Humidity spike   : 60-79%
# - Soil             : smooth random ±80 (range 1800-2600)
# - Penyiraman auto  : 07:00 WIB (15 detik = 3 slot)
# - Actuator status  : VERYLOW | LOW | NORMAL | HIGH | VERYHIGH
# ============================================================

BROKER_HOST="mqtt.binatra.id"
BROKER_PORT=1883

MQTT_USERNAME="admin"
MQTT_PASSWORD="admin123"

TOPIC_MONITOR="jamur_kuping/monitoring"
TOPIC_HEARTBEAT="jamur_kuping/heartbeat"
TOPIC_PUMP="jamur_kuping/control/pump"
TOPIC_FAN="jamur_kuping/control/fan"
TOPIC_HUMIDIFIER="jamur_kuping/control/humidifier"

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

# ============================================================
# Watering State
# ============================================================

WATERING_DONE_TODAY=0
WATERING_ACTIVE=0

# ============================================================
# Previous actuator state (untuk detect perubahan)
# ============================================================

PREV_PUMP=""
PREV_FAN=""
PREV_HUMIDIFIER=""

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
        WATERING_DONE_TODAY=0
        WATERING_ACTIVE=0
        LAST_DATE="$TODAY"
        echo "[INFO] Hari baru - spike & watering reset"
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
    # Penyiraman otomatis jam 07:00 (durasi 15 detik = 3 slot)
    # ========================================================

    WATERING_SLOTS=3

    if [ "$CURRENT_HOUR" -eq 7 ] && [ "$CURRENT_MIN" -eq 0 ] && [ "$WATERING_DONE_TODAY" -eq 0 ]; then
        WATERING_ACTIVE=$WATERING_SLOTS
        WATERING_DONE_TODAY=1
        echo "[INFO] 💧 PENYIRAMAN OTOMATIS JAM 07:00 DIMULAI (15 detik)"
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
    # Spike → 60-79% | Normal → 80-84%
    # ========================================================

    if [ "$SPIKE_ACTIVE" -eq 1 ]; then
        HUMIDITY=$((60 + RANDOM % 20))
        HUM_PHASE="🌵 RENDAH"
    else
        HUMIDITY=$((80 + RANDOM % 5))
        HUM_PHASE="💧 NORMAL"
    fi

    # ========================================================
    # SOIL SMOOTH
    # ========================================================

    DELTA=$(( RANDOM % 161 - 80 ))
    SOIL=$(( LAST_SOIL + DELTA ))

    if [ "$SOIL" -lt 1800 ]; then SOIL=1800; fi
    if [ "$SOIL" -gt 2600 ]; then SOIL=2600; fi

    LAST_SOIL=$SOIL

    # ========================================================
    # MAPPING STATE
    # ========================================================

    if   [ "$TEMPERATURE" -lt 22 ]; then TEMP_STATE="cold"
    elif [ "$TEMPERATURE" -le 25 ]; then TEMP_STATE="normal"
    else                                 TEMP_STATE="hot"
    fi

    if   [ "$HUMIDITY" -lt 80 ]; then HUM_STATE="low"
    elif [ "$HUMIDITY" -le 90 ]; then HUM_STATE="normal"
    else                              HUM_STATE="high"
    fi

    if   [ "$SOIL" -gt 2600 ]; then SOIL_STATE="low"
    elif [ "$SOIL" -gt 1800 ]; then SOIL_STATE="normal"
    else                            SOIL_STATE="high"
    fi

    # ========================================================
    # FUZZY RULE
    # ========================================================

    PUMP="VERYLOW"
    FAN="VERYLOW"
    HUMIDIFIER="VERYLOW"

    # Override saat penyiraman otomatis
    if [ "$WATERING_ACTIVE" -gt 0 ]; then
        PUMP="VERYHIGH"
        FAN="VERYLOW"
        HUMIDIFIER="VERYLOW"
        WATERING_ACTIVE=$(( WATERING_ACTIVE - 1 ))
        echo "[INFO] 💧 PENYIRAMAN slot tersisa: $WATERING_ACTIVE"
        if [ "$WATERING_ACTIVE" -eq 0 ]; then
            echo "[INFO] ✅ PENYIRAMAN SELESAI"
        fi
    else
        if   [ "$SOIL_STATE" = "high"   ] && [ "$TEMP_STATE" = "cold"   ] && [ "$HUM_STATE" = "high"   ]; then PUMP="VERYLOW";  FAN="VERYLOW"; HUMIDIFIER="VERYLOW"
        elif [ "$SOIL_STATE" = "high"   ] && [ "$TEMP_STATE" = "cold"   ] && [ "$HUM_STATE" = "normal" ]; then PUMP="VERYLOW";  FAN="VERYLOW"; HUMIDIFIER="VERYLOW"
        elif [ "$SOIL_STATE" = "high"   ] && [ "$TEMP_STATE" = "cold"   ] && [ "$HUM_STATE" = "low"    ]; then PUMP="VERYLOW";  FAN="VERYLOW"; HUMIDIFIER="HIGH"
        elif [ "$SOIL_STATE" = "normal" ] && [ "$TEMP_STATE" = "cold"   ] && [ "$HUM_STATE" = "high"   ]; then PUMP="VERYLOW";  FAN="VERYLOW"; HUMIDIFIER="VERYLOW"
        elif [ "$SOIL_STATE" = "normal" ] && [ "$TEMP_STATE" = "normal" ] && [ "$HUM_STATE" = "normal" ]; then PUMP="VERYLOW";  FAN="VERYLOW"; HUMIDIFIER="VERYLOW"
        elif [ "$SOIL_STATE" = "normal" ] && [ "$TEMP_STATE" = "hot"    ] && [ "$HUM_STATE" = "low"    ]; then PUMP="VERYLOW";  FAN="HIGH";    HUMIDIFIER="HIGH"
        elif [ "$SOIL_STATE" = "low"    ] && [ "$TEMP_STATE" = "hot"    ] && [ "$HUM_STATE" = "low"    ]; then PUMP="VERYHIGH"; FAN="HIGH";    HUMIDIFIER="VERYHIGH"
        elif [ "$SOIL_STATE" = "low"    ] && [ "$TEMP_STATE" = "cold"   ] && [ "$HUM_STATE" = "high"   ]; then PUMP="HIGH";     FAN="VERYLOW"; HUMIDIFIER="VERYLOW"
        elif [ "$SOIL_STATE" = "low"    ] && [ "$TEMP_STATE" = "normal" ] && [ "$HUM_STATE" = "normal" ]; then PUMP="HIGH";     FAN="VERYLOW"; HUMIDIFIER="VERYLOW"
        elif [ "$SOIL_STATE" = "normal" ] && [ "$TEMP_STATE" = "hot"    ] && [ "$HUM_STATE" = "high"   ]; then PUMP="VERYLOW";  FAN="HIGH";    HUMIDIFIER="VERYLOW"
        fi
    fi

    # ========================================================
    # PUBLISH MONITORING
    # ========================================================

    PAYLOAD="{\"temperature\":$TEMPERATURE,\"humidity\":$HUMIDITY,\"soil\":$SOIL,\"pump\":\"$PUMP\",\"fan\":\"$FAN\",\"humidifier\":\"$HUMIDIFIER\"}"

    mosquitto_pub \
        -h "$BROKER_HOST" -p "$BROKER_PORT" \
        -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
        -t "$TOPIC_MONITOR" -m "$PAYLOAD"

    # ========================================================
    # PUBLISH CONTROL ACTUATOR (hanya jika status berubah)
    # ========================================================

    if [ "$PUMP" != "$PREV_PUMP" ]; then
        mosquitto_pub \
            -h "$BROKER_HOST" -p "$BROKER_PORT" \
            -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
            -t "$TOPIC_PUMP" -m "{\"status\":\"$PUMP\"}"
        echo "[CONTROL] 🚰 PUMP → $PUMP"
        PREV_PUMP="$PUMP"
    fi

    if [ "$FAN" != "$PREV_FAN" ]; then
        mosquitto_pub \
            -h "$BROKER_HOST" -p "$BROKER_PORT" \
            -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
            -t "$TOPIC_FAN" -m "{\"status\":\"$FAN\"}"
        echo "[CONTROL] 🌀 FAN → $FAN"
        PREV_FAN="$FAN"
    fi

    if [ "$HUMIDIFIER" != "$PREV_HUMIDIFIER" ]; then
        mosquitto_pub \
            -h "$BROKER_HOST" -p "$BROKER_PORT" \
            -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
            -t "$TOPIC_HUMIDIFIER" -m "{\"status\":\"$HUMIDIFIER\"}"
        echo "[CONTROL] 💨 HUMIDIFIER → $HUMIDIFIER"
        PREV_HUMIDIFIER="$HUMIDIFIER"
    fi

    # ========================================================
    # LOG
    # ========================================================

    echo "[$TIMESTAMP] $TEMP_PHASE | HUM $HUM_PHASE"
    echo "TEMP       : $TEMPERATURE°C  ($TEMP_STATE)"
    echo "HUM        : $HUMIDITY%      ($HUM_STATE)"
    echo "SOIL       : $SOIL           ($SOIL_STATE)"
    echo "PUMP       : $PUMP"
    echo "FAN        : $FAN"
    echo "HUMIDIFIER : $HUMIDIFIER"
    echo "--------------------------"

    # ========================================================
    # HEARTBEAT
    # ========================================================

    if [ $(( NOW - LAST_HEARTBEAT )) -ge $HEARTBEAT_INTERVAL ]; then
        mosquitto_pub \
            -h "$BROKER_HOST" -p "$BROKER_PORT" \
            -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
            -t "$TOPIC_HEARTBEAT" \
            -m "{\"deviceCode\":\"$DEVICE_CODE\"}"
        LAST_HEARTBEAT=$NOW
    fi

    sleep $INTERVAL

done