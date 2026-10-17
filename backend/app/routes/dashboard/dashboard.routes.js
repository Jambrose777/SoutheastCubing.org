const express = require("express");

const router = express.Router();

router.use(require("./myInfo.routes.js"));
router.use(require("./teams.routes.js"));
router.use(require("./people.routes.js"));
router.use(require("./delegates.routes.js"));
router.use(require("./competitionPlanner.routes.js"));

module.exports = router;
