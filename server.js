"use strict";

const express = require("express");
const fs = require("fs");
const Validator = require("jsonschema").Validator;
const app = express();

global.data;

var versionSchema = {
  id: "/VersionSchema",
  type: "object",
  required: ["time", "comment", "data"],
  properties: {
    time: {
      type: "string",
    },
    comment: {
      type: "string",
    },
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "names", "scores"],
        properties: {
          title: {
            type: "string",
          },
          names: {
            type: "array",
            minItems: 0,
            items: {
              type: "string",
            },
          },
          scores: {
            type: "array",
            minItems: 0,
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["score", "comment"],
                properties: {
                  score: {
                    type: "array",
                    items: {
                      type: "integer",
                    },
                    minItems: 2,
                    maxItems: 2,
                  },
                  comment: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

var dataSchema = {
  type: "object",
  required: ["current", "history"],
  properties: {
    current: {
      $ref: "/VersionSchema",
    },
    history: {
      type: "array",
      items: {
        $ref: "/VersionSchema",
      },
    },
  },
};

const validator = new Validator();
validator.addSchema(versionSchema, "/VersionSchema");

function isVersionCorrupted(version) {
  for (let series of version.data) {
    var count = series.names.length;
    if (count === 0) {
      if (series.scores.length !== 0) return true;
      else continue;
    }
    if (series.scores.length !== count - 1) return true;
    for (var i = 0; i < count - 1; i++) {
      if (series.scores[i].length != i + 1) return true;
    }
  }
  return false;
}

function isDataCorrupted(data) {
  if (!validator.validate(data, dataSchema).valid) return true;
  if (isVersionCorrupted(data.current)) return true;
  for (let version of data.history) {
    if (isVersionCorrupted(version)) return true;
  }
  console.log(data);
  return false;
}

const fallback = {
  current: {
    time: "2022-01-28 12:56:31",
    comment: "测试备份",
    data: [
      {
        title: "示例比赛",
        names: ["甲", "乙", "丙"],
        scores: [
          [{ score: [1, 2], comment: "乙 vs 甲\n11:22" }],
          [
            { score: [3, 4], comment: "丙 vs 甲\n33:44" },
            { score: [5, 6], comment: "丙 vs 乙\n55:66" },
          ],
        ],
      },
      { title: "示例比赛2", names: ["甲", "乙"], scores: [[{ score: [1, 2], comment: "乙 vs 甲\n11:22" }]] },
    ],
  },
  history: [
    {
      time: "2022-01-28 12:56:31",
      comment: "测试备份",
      data: [
        {
          title: "示例比赛",
          names: ["甲", "乙", "丙"],
          scores: [
            [{ score: [1, 2], comment: "乙 vs 甲\n11:22" }],
            [
              { score: [3, 4], comment: "丙 vs 甲\n33:44" },
              { score: [5, 6], comment: "丙 vs 乙\n55:66" },
            ],
          ],
        },
        { title: "示例比赛2", names: ["甲", "乙"], scores: [[{ score: [1, 2], comment: "乙 vs 甲\n11:22" }]] },
      ],
    },
  ],
};

function deepCopy(object) {
  return JSON.parse(JSON.stringify(object));
}

function writeToDisk(object) {
  fs.writeFileSync("data.json", JSON.stringify(object || global.data));
}

if (!fs.existsSync("data.json")) {
  writeToDisk(fallback);
}

try {
  global.data = JSON.parse(fs.readFileSync("data.json", "utf-8"));
  if (isDataCorrupted(global.data)) throw new Error("Data corrupted");
} catch (e) {
  console.error(e);
  process.exit(-1);
}

app.use("/assets", express.static("assets"));
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});
app.get("/backup", (req, res) => {
  res.sendFile("backup.html", { root: __dirname });
});

app.get("/api", (req, res) => {
  res.json(global.data.current);
});

app.use("/api", express.json());
app.post("/api", (req, res) => {
  try {
    if (!isVersionCorrupted(req.body)) {
      global.data.current = req.body;
      writeToDisk();
    } else {
      throw new Error("Malformed data");
    }
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(400);
  }
});

app.get("/history", (req, res) => {
  res.json(global.data);
});

app.use("/history", express.json());
app.post("/history", (req, res) => {
  try {
    console.log(req.body);
    if (req.body.choice !== undefined) {
      const val = parseInt(req.body.choice);
      if (val < 0 || val >= global.data.history.length) {
        throw new Error("Invalid request");
      }
      global.data.current = deepCopy(global.data.history[val]);
      writeToDisk();
    } else if (req.body.comment !== undefined) {
      global.data.current.time = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
      global.data.current.comment = req.body.comment;
      global.data.history.push(global.data.current);
      writeToDisk();
    } else {
      throw new Error("Invalid request");
    }
    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(400);
  }
});

// var server = require("greenlock-express");
// server.init({
//   packageRoot: __dirname,
//   configDir: "./greenlock.d",
//   maintainerEmail: "zzzyt205@gmail.com",
//   cluster: false,
// }).serve(app);

var server = app.listen(7777, function () {
  var port = server.address().port;
  console.log(`Server started on port ${port}`);
});
