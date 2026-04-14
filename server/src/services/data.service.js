import { prisma } from "../config/prisma.js";

const fuzzyRule = (soil_state, temp_state, hum_state) => {

  let pump_state = "OFF";
  let fan_state = "OFF";
  let diffuser_state = "OFF";

  if (soil_state=="high" && temp_state=="cold" && hum_state=="high"){
    pump_state="OFF"; diffuser_state="OFF"; fan_state="OFF";
  }
  else if (soil_state=="high" && temp_state=="cold" && hum_state=="normal"){
    pump_state="OFF"; diffuser_state="ON"; fan_state="OFF";
  }
  else if (soil_state=="high" && temp_state=="cold" && hum_state=="low"){
    pump_state="OFF"; diffuser_state="ON"; fan_state="OFF";
  }
  else if (soil_state=="normal" && temp_state=="cold" && hum_state=="high"){
    pump_state="ON"; diffuser_state="OFF"; fan_state="OFF";
  }
  else if (soil_state=="normal" && temp_state=="normal" && hum_state=="normal"){
    pump_state="OFF"; diffuser_state="OFF"; fan_state="OFF";
  }
  else if (soil_state=="normal" && temp_state=="hot" && hum_state=="low"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }
  else if (soil_state=="low" && temp_state=="hot" && hum_state=="low"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }
  else if (soil_state=="low" && temp_state=="cold" && hum_state=="high"){
    pump_state="ON"; diffuser_state="ON"; fan_state="OFF";
  }
  else if (soil_state=="low" && temp_state=="normal" && hum_state=="normal"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }
  else if (soil_state=="normal" && temp_state=="hot" && hum_state=="high"){
    pump_state="ON"; diffuser_state="ON"; fan_state="ON";
  }

  return {
    pump: pump_state,
    fan: fan_state,
    humidifier: diffuser_state
  };
};

export const saveData = async (payload) => {

    const actuator = fuzzyRule(
        payload.soil_state,
        payload.temp_state,
        payload.hum_state
    );

    const data = await prisma.data.create({
        data : {
            temperature : payload.temperature,
            humidity : payload.humidity,
            soil : payload.soil,
            pump: actuator.pump,
            fan: actuator.fan,
            humidifier: actuator.humidifier,
            date : new Date()
        }
    })

    return data
}

export const getLastData = async () => {
  const lastData = await prisma.data.findFirst({
    orderBy: {
      date: "desc",
    },
  });

  return lastData;
};

export const getChartData = async () => {
  const rows = await prisma.data.findMany({
    orderBy: {
      date: "desc"
    },
    take: 7
  })

  const reversed = rows.reverse()

  return {
    labels: reversed.map(item =>
      new Date(item.date).getHours().toString()
    ),
    temp: reversed.map(item => item.temperature),
    hum: reversed.map(item => item.humidity),
    soil: reversed.map(item => item.soil)
  }
}