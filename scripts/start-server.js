const app = require("../app");
const debug = require("debug")("wg14-link:server");
const http = require("http");

// Get port from environment and store in Express.
let port = parseInt(process.env.PORT, 10);

if (isNaN(port) || port <= 0) {
  port = 3000;
}

app.set("port", port);

// Create HTTP server.
const server = http.createServer(app);
server.listen(port);

// Event listener for HTTP server "error" event.
server.on("error", error => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string"
    ? "Pipe " + port
    : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Event listener for HTTP server "listening" event.
server.on("listening", () => {
  const addr = server.address();
  const bind = typeof addr === "string"
    ? "pipe " + addr
    : "http://localhost:" + addr.port;
  debug("Listening on " + bind);
});
