const router = require("express").Router();

router.use(require("./access-routes"));
router.use(require("./pick-lifecycle-routes"));
router.use(require("./force-pick-routes"));
router.use(require("./maintenance-routes"));
router.use(require("./repair-routes"));

module.exports = router;
