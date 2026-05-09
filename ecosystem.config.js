module.exports = {
  apps: [{
    name: "app",
    script: "src/index.js",
    cwd: "/var/www/Monitoring-Jamur/server",
    env: {
      DATABASE_URL: "mysql://binatra:binatrA40_@localhost:3306/aeroponic_db"
    }
  }]
}