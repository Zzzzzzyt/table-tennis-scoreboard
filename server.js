"use strict";

const express = require("express");
const fs = require("fs");
const validate = require("jsonschema").validate;
const app = express();

global.data;

const test = {
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
    {
      title: "示例比赛2",
      names: ["甲", "乙"],
      scores: [[{ score: [1, 2], comment: "乙 vs 甲\n11:22" }]],
    },
  ],
};

if (!fs.existsSync("data.json")) {
  fs.writeFileSync("data.json", JSON.stringify(test));
}

var schema = {
  type: "object",
  required: ["data"],
  properties: {
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

function isDataCorrupted(data) {
  if (!validate(data, schema).valid) return true;
  console.log(data);
  for (let series of data.data) {
    var count = series.names.length;
    if (count === 0) {
      if (series.scores.length != 0) return false;
      else continue;
    }
    if (series.scores.length != count - 1) return true;
    for (var i = 0; i < count - 1; i++) {
      if (series.scores[i].length != i + 1) return true;
    }
  }
  return false;
}

try {
  global.data = JSON.parse(fs.readFileSync("data.json", "utf-8"));
  if (isDataCorrupted(global.data)) throw new Error("Data corrupted");
} catch (e) {
  console.error(e);
  global.data = null;
}

app.use("/assets", express.static("assets"));
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.get("/api", (req, res) => {
  if (global.data === null) {
    res.sendStatus(500);
  } else {
    res.json(global.data);
  }
});

app.use("/api", express.json());
app.post("/api", (req, res) => {
  try {
    if (!isDataCorrupted(req.body)) {
      global.data = req.body;
      fs.writeFileSync("data.json", JSON.stringify(global.data), "utf-8");
    } else {
      throw new Error("Malformed data");
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
