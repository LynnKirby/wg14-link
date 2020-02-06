const assert = require("assert");
const fs = require("fs");
const path = require("path");
const createError = require("http-errors");
const express = require("express");
const morgan = require("morgan");
const process = require("process");
const debug = require("debug")("wg14-link:app");

const app = express();

// We use both checks in case NODE_ENV is not set because, for example, we only
// want to show details on error pages when it's "development" but not unknown,
// which may mean we're actually deployed to production but accidentally didn't
// set the environment variable.
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

// Load redirect data.
const dataPath = path.join(__dirname, "build", "redirect.json");
const redirects = JSON.parse(fs.readFileSync(dataPath));
debug(`Loaded data file ${dataPath}`);

// Set EJS as the view engine.
app.set("views", "./views");
app.set("view engine", "ejs");

// Log errors to stdout. Use the standard Apache combined log output for
// production and a concise colored output for development.
if (isProduction) {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Host static files from `public`.
app.use(express.static(path.join(__dirname, "public")));

// Main redirect route.
app.get("/:id([a-zA-Z0-9]+)", (req, res, next) => {
  let { id } = req.params;
  assert(id !== undefined);
  id = id.toLowerCase();

  // Fixup numbered document ID by removing leading zeroes.
  if (id.match("^n[0-9]+$")) {
    id = "n" + Number.parseInt(id.substr(1), 10);
  }

  const redirect = redirects[id];

  if (redirect === undefined) {
    // Unknown ID.
    next(createError(404, "page not found"));
  } else if (redirect.status === "missing") {
    // Known ID but is missing the document.
    next(createError("404", "document file missing", {
      description: "the document ID you provided is valid but we do not have a link to the document file. it has probably been lost to the sands of time...",
    }));
  } else if (redirect.status === "unassigned") {
    // Known ID but is unassigned.
    next(createError(404, "unassigned document ID"));
  } else {
    // Known ID for redirection.
    assert(redirect.url);
    res.writeHead(303, {
      Location: redirect.url
    }).end();
  }
});

// 404 handler.
app.use((req, res, next) => {
  next(createError(404, "page not found"));
});

// Error handler.
app.use((err, req, res, next) => {
  const status = err.status || 500;

  res.locals.message = err.message;
  res.locals.status = status;
  res.locals.description = err.description;

  // Only show stack in development.
  res.locals.stack = isDevelopment ? err.stack : null;

  res.status(status);
  res.render("error");
});

module.exports = app;
