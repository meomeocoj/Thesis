const express = require('express');
const jrpcRouter = require('./jrpc');

const router = express.Router();
router.use('/', jrpcRouter);

module.exports = router;
