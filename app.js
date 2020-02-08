const { canonicalDocumentId } = require("./util");
const createError = require("http-errors");
const debug = require("debug")("wg14-link:app");
const express = require("express");
const morgan = require("morgan");
const path = require("path");
const process = require("process");

// Load data.
const routes = require("./build/routes.json");
debug("Loaded data file build/routes.json");

//
// General app configuration.
//

const app = express();
module.exports = app;

app.disable("x-powered-by");

// Override content types to send YAML and BibTeX as plain text. This is less
// accurate from a technical perspective but it ensures browsers will display
// the text inline. `Content-Disposition: inline` doesn't always have that
// effect.
//
// Note that the `mime` instance hanging off of the send package is the global
// one used by both Express and serve-static so it will change everything.
require("send").mime.define({ "text/plain": ["yml", "yaml", "bib"] }, true);

// We use both checks in case NODE_ENV is not set because, for example, we only
// want to show details on error pages when it's "development" but not unknown,
// which may mean we're actually deployed to production but accidentally didn't
// set the environment variable.
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

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

const embedBotList = [
  "Twitterbot",
  "Discordbot",
  "Facebot",
  "facebookexternalhit",
  "Slackbot-LinkExpanding",
  "TelegramBot",
  "Discouse Forum Onebox",
];

const embedBotRegexp = new RegExp(`(${embedBotList.join("|")})`, "i")

const isEmbedBot = ua => {
  if (!ua) return false;
  return embedBotRegexp.test(ua);
};

//
// Error helpers.
//

const makeRenderTemplateError = (tmpl, contentType) => (err, res) => {
  const status = err.status || 500;

  if (err.expose || isDevelopment) {
    res.locals.message = err.message;
    res.locals.description = err.description;
  } else if (status === 500) {
    res.locals.message = "Internal server error";
    res.locals.description = null;
  } else {
    res.locals.message = "Unknown error";
    res.locals.description = null;
  }

  res.locals.status = status;
  res.locals.stack = isDevelopment ? err.stack : null;

  res.header("Content-Type", contentType);
  res.status(status);
  res.render(tmpl);
};

const makeRenderJsonError = contentType => (err, res) => {
  const status = err.status || 500;
  const result = {};

  if (err.expose || isDevelopment) {
    result.error = `${err.message} - ${err.description}`;
  } else if (status === 500) {
    result.error = "Internal server error";
  } else {
    result.error = "Unknown error";
  }

  result.stack = isDevelopment ? err.stack.split("\n") : null;

  res.status(status);
  res.header("Content-Type", contentType);
  res.send(JSON.stringify(result, null, 2));
};

const renderHtmlError = makeRenderTemplateError("error-html", "text/html");
const renderTextError = makeRenderTemplateError("error-plain", "text/plain");
const renderJsonError = makeRenderJsonError("application/json");
const renderYamlError = makeRenderJsonError("text/plain");

const documentNotFoundError = () =>
  createError(404, "Page not found", { expose: true });

const unassignedIdError = () =>
  createError(404, "Unassigned document ID", { expose: true });

const missingDocumentLinkError = () =>
  createError("404", "Document file missing", {
    expose: true,
    description:
      "The document ID you provided is valid but we do not have a link " +
      "to the document file. It has probably been lost to the sands of " +
      "time...",
  });

//
// Handlers.
//

// Host static files from `public` and `build/public`.
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "build", "public")));

// Main route.
app.get("/:id([a-zA-Z0-9]+)", (req, res, next) => {
  let id = req.params.id.toUpperCase();

  // Canonicalize the ID if it looks like a document number.
  if (id.match("^n[0-9]+$")) {
    id = canonicalDocumentId(id);
  }

  const route = routes[id];

  if (route === undefined) {
    next(documentNotFoundError());
  } else if (route.status === "missing") {
    next(missingDocumentLinkError());
  } else if (route.status === "unassigned") {
    next(unassignedIdError());
  } else {
    if (isEmbedBot(req.headers["user-agent"])) {
      res.locals.id = route.id;
      res.locals.idLower = route.id.toLowerCase();
      res.locals.title = route.title;
      res.locals.author = route.author;
      res.locals.date = route.date;
      res.render("bot-embed");
    } else {
      res.redirect(303, route.mirror || route.url);
    }
  }
});

// Metadata route.
app.get("/:file([Nn][0-9]+.(bib|ya?ml))", (req, res, next) => {
  let [filename, ext] = req.params.file.split(".");
  const id = canonicalDocumentId(filename);

  if (ext === "yaml") ext = "yml";

  const route = routes[id];

  if (route === undefined) {
    next(documentNotFoundError());
  } else if (route.status === "unassigned") {
    next(unassignedIdError());
  } else {
    res.sendFile(path.join(__dirname, "build", "public", `${id}.${ext}`));
  }
});

// 404 handler.
app.use((req, res, next) => {
  next(documentNotFoundError());
});

// Default error handler (must have four parameters).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const segments = req.path.split(".");
  const extension = segments.length == 1 ? "" : segments[segments.length - 1];

  switch (extension) {
    case "yml":
    case "yaml":
      renderYamlError(err, res);
      break;
    case "json":
      renderJsonError(err, res);
      break;
    case "bib":
      renderTextError(err, res);
      break;
    default:
      renderHtmlError(err, res);
      break;
  }
});
