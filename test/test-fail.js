require("ava")("expect fail", t => t.assert(false));

require("ava")("expect fail", t => {throw new Error("foo")});
