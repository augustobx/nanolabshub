"use strict";
process.exit(require("./release-catalog.cjs").heartbeatHealthy(process.env.DATA_DIR||"/app/data")?0:1);
